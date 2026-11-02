// Minimal FAL queue client with durable job records for the Animation History media.
// No SDK dependency: storage upload + queue submit/status/result over REST.
// Run scripts with `node --env-file=.env.local ...` so FAL_KEY (or FAL_API_KEY) is in the environment.
//
// Job lifecycle (application states, not FAL status strings):
//   draft -> submitting -> queued -> result_received -> needs_review
//   failures: submission_unknown | failed | validation_failed
// A record is written BEFORE submission. If a request_id exists we resume polling and never resubmit.
// If submission failed without a request_id, the record is marked submission_unknown and is not retried
// automatically (reconcile by hand in the FAL dashboard first).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

export const WORK = process.env.HISTORY_MEDIA_DIR ?? "media-work";
const JOBS = join(WORK, "jobs");
const RAW = join(WORK, "raw");
const UPLOADS = join(WORK, "uploads.json");
mkdirSync(JOBS, { recursive: true });
mkdirSync(RAW, { recursive: true });

function key() {
  const k = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!k) throw new Error("FAL_KEY / FAL_API_KEY not set. Run with node --env-file=.env.local");
  return k;
}
const auth = () => ({ Authorization: `Key ${key()}` });

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4" };

/** Upload a local file to FAL storage once (cached by content hash). Returns a fetchable URL. */
export async function upload(file) {
  const buf = readFileSync(file);
  const sha = createHash("sha256").update(buf).digest("hex");
  const cache = existsSync(UPLOADS) ? JSON.parse(readFileSync(UPLOADS, "utf8")) : {};
  if (cache[sha]) return cache[sha].url;
  const content_type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  const init = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ content_type, file_name: basename(file) }),
  });
  if (!init.ok) throw new Error(`upload initiate ${init.status}: ${await init.text()}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": content_type }, body: buf });
  if (!put.ok) throw new Error(`upload PUT ${put.status}: ${await put.text()}`);
  cache[sha] = { url: file_url, file, uploadedAt: new Date().toISOString() };
  writeFileSync(UPLOADS, JSON.stringify(cache, null, 2));
  return file_url;
}

const recPath = (id) => join(JOBS, `${id}.json`);
export const readJob = (id) => (existsSync(recPath(id)) ? JSON.parse(readFileSync(recPath(id), "utf8")) : null);
const save = (r) => writeFileSync(recPath(r.id), JSON.stringify(r, null, 2));

/**
 * Run (or resume) one logical job. `id` is the stable logical item id: re-running the same id never
 * creates a second paid request.
 */
export async function runJob({ id, endpointId, input, meta = {}, estimatedCost }) {
  let r = readJob(id);
  if (r?.state === "needs_review" || r?.state === "approved") return r;
  if (r?.state === "submission_unknown") throw new Error(`${id}: submission_unknown — reconcile before retrying`);
  if (r?.state === "failed" || r?.state === "validation_failed") {
    if (!process.env.RETRY_FAILED) return r;
    r = null;
  }
  if (!r) {
    r = { id, provider: "fal", endpointId, schemaCheckedAt: "2026-11-01", createdAt: new Date().toISOString(), input, meta, estimatedCost, currency: "USD", state: "draft", rawOutputs: [] };
    save(r);
  }
  if (!r.requestId) {
    r.state = "submitting";
    save(r);
    let res;
    try {
      res = await fetch(`https://queue.fal.run/${endpointId}`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch (e) {
      r.state = "submission_unknown";
      r.error = String(e);
      save(r);
      throw e;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.request_id) {
      r.state = "failed";
      r.error = `submit ${res.status}: ${JSON.stringify(body).slice(0, 800)}`;
      save(r);
      return r;
    }
    Object.assign(r, { requestId: body.request_id, statusUrl: body.status_url, responseUrl: body.response_url, state: "queued", submittedAt: new Date().toISOString() });
    save(r);
    console.log(`[${id}] queued ${r.requestId}`);
  }
  // Poll the returned status URL (never reconstructed).
  for (;;) {
    const s = await fetch(r.statusUrl, { headers: auth() }).then((x) => x.json());
    if (s.status === "COMPLETED") break;
    if (s.status !== "IN_QUEUE" && s.status !== "IN_PROGRESS") {
      r.state = "failed";
      r.error = JSON.stringify(s).slice(0, 800);
      save(r);
      return r;
    }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  const res = await fetch(r.responseUrl, { headers: auth() });
  const out = await res.json();
  if (!res.ok) {
    r.state = "failed";
    r.error = `result ${res.status}: ${JSON.stringify(out).slice(0, 800)}`;
    save(r);
    return r;
  }
  r.state = "result_received";
  r.output = out;
  r.completedAt = new Date().toISOString();
  save(r);
  // Ingest every returned media file before review.
  const media = [...(out.images ?? []), ...(out.video ? [out.video] : []), ...(out.image ? [out.image] : []), ...(out.audio?.url ? [out.audio] : [])];
  for (const [i, m] of media.entries()) {
    const ext = extname(new URL(m.url).pathname) || (out.video ? ".mp4" : out.audio ? ".mp3" : ".png");
    const file = join(RAW, `${id}${media.length > 1 ? `-${i}` : ""}${ext}`);
    const buf = Buffer.from(await fetch(m.url).then((x) => x.arrayBuffer()));
    if (buf.length < 1000) {
      r.state = "validation_failed";
      r.error = `tiny output ${buf.length} bytes`;
      save(r);
      return r;
    }
    writeFileSync(file, buf);
    r.rawOutputs.push({ file, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length, providerUrl: m.url, width: m.width, height: m.height });
  }
  r.returnedSeed = out.seed;
  r.state = "needs_review";
  save(r);
  console.log(`[${id}] done → ${r.rawOutputs.map((o) => o.file).join(", ")}`);
  return r;
}

/** Run jobs with bounded concurrency. Failures are recorded, not thrown, so a batch can partially complete. */
export async function runBatch(jobs, concurrency = 4) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < jobs.length) {
        const j = jobs[i++];
        try {
          results.push(await runJob(j));
        } catch (e) {
          console.error(`[${j.id}]`, e.message);
        }
      }
    }),
  );
  return results;
}
