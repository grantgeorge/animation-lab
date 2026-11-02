// Shared fal.ai helper for offline asset generation. Never imported by the app.
// Spend is logged in scripts/characters/ledger.json (tracked) and capped at $100 total.
import { fal } from "@fal-ai/client";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LEDGER = new URL("./ledger.json", import.meta.url);
export const CAP_USD = 100;

if (!process.env.FAL_API_KEY) throw new Error("FAL_API_KEY missing: run with `node --env-file=.env.local …`");
fal.config({ credentials: process.env.FAL_API_KEY });

export function ledger() {
  return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { spentUsd: 0, runs: [] };
}

export function spent() {
  return ledger().spentUsd;
}

/** Run one fal job if its estimated cost fits under the cap; records the estimate in the ledger. */
export async function runJob(endpoint, input, estimateUsd, label) {
  const l = ledger();
  if (l.spentUsd + estimateUsd > CAP_USD) throw new Error(`budget: $${l.spentUsd.toFixed(2)} spent + $${estimateUsd} > $${CAP_USD}`);
  if (process.env.DRY_RUN) {
    console.log(`[dry-run] ${label}: ${endpoint} (~$${estimateUsd})`);
    return null;
  }
  console.log(`→ ${label}: ${endpoint} (~$${estimateUsd})`);
  const t0 = Date.now();
  const res = await fal.subscribe(endpoint, {
    input,
    logs: true,
    onQueueUpdate: (u) => {
      if (u.status === "IN_PROGRESS") process.stdout.write(".");
    },
  });
  process.stdout.write("\n");
  // Re-read before writing: other jobs may have logged spend while this one ran.
  const now = ledger();
  now.spentUsd = Math.round((now.spentUsd + estimateUsd) * 100) / 100;
  now.runs.push({ at: new Date().toISOString(), label, endpoint, estimateUsd, seconds: Math.round((Date.now() - t0) / 1000), requestId: res.requestId });
  writeFileSync(LEDGER, JSON.stringify(now, null, 2) + "\n");
  return res.data;
}

export async function download(url, path) {
  mkdirSync(dirname(path), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  return path;
}

export async function upload(path, type) {
  const blob = new Blob([readFileSync(path)], { type });
  return fal.storage.upload(blob);
}
