// Publish approved Animation History media: delivery derivatives in public/history/, a sanitized
// manifest (src/history/content/published-assets.json) and the experiment record (experiment.json).
// Raw outputs and private job records stay in media-work/. No provider URLs or keys are published.
// Usage: node scripts/history-media/publish.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const W = "media-work";
const OUT = "public/history";
const SCENE_VERSION = "lab-hd-cast-wave-v3@2026-11-01";
for (const d of ["stills", "clips", "posters", "layers", "refs", "experiment"]) mkdirSync(`${OUT}/${d}`, { recursive: true });

const job = (id) => JSON.parse(readFileSync(`${W}/jobs/${id}.json`, "utf8"));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const dims = (f) => run("magick", ["identify", "-format", "%w %h", `${f}[0]`]).split(" ").map(Number);
const vdur = (f) => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));

const MODEL = {
  "openai/gpt-image-2.5/sunburst/edit": "GPT Image 2.5 Sunburst (edit)",
  "google/nano-banana-2.1/edit": "Nano Banana 2.1 (edit)",
  "bytedance/seedance-2.5/us/image-to-video": "Seedance 2.5 US (image-to-video)",
  "bytedance/seedance-2.5/us/text-to-video": "Seedance 2.5 US (text-to-video)",
  "bytedance/seedance-2.5/us/reference-to-video": "Seedance 2.5 US (reference-to-video)",
  "fal-ai/birefnet/v2": "BiRefNet v2 (background removal)",
  "minimax/h3-max/image-to-video": "MiniMax H3 Max (image-to-video)",
  "minimax/h3-max/text-to-video": "MiniMax H3 Max (text-to-video)",
  "minimax/h3-max/reference-to-video": "MiniMax H3 Max (reference-to-video)",
};

/** Sanitized generation step: no URLs, only labeled inputs and scalar parameters. */
function step(label, id, inputs) {
  const j = job(id);
  const params = {};
  for (const [k, v] of Object.entries(j.input)) {
    if (k === "prompt" || /url/.test(k)) continue;
    params[k] = typeof v === "object" ? JSON.stringify(v).replace(/"/g, "") : v;
  }
  if (j.returnedSeed !== undefined) params.returned_seed = j.returnedSeed;
  return { label, endpointId: j.endpointId, model: MODEL[j.endpointId] ?? j.endpointId, date: (j.completedAt ?? j.createdAt).slice(0, 10), prompt: j.input.prompt ?? "(no prompt)", inputs, parameters: params };
}

const assets = [];
const provenance = [];
const cost = { estimated: 0 };

function webp(src, dest, { width = 1920, alpha = false } = {}) {
  run("magick", [src, "-resize", `${width}x>`, "-quality", alpha ? "88" : "84", ...(alpha ? ["-define", "webp:alpha-quality=95"] : []), dest]);
  return dims(dest);
}
function mp4(src, dest) {
  // Keep the source cadence: no retiming, interpolation or trimming.
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-an", "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dest]);
}
function poster(src, dest) {
  const tmp = `${W}/tmp-poster.png`;
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-frames:v", "1", tmp]);
  return webp(tmp, dest, { width: 1280 });
}
function addVideo({ id, src, alt, provenanceId, beatMarkers }) {
  const url = `/history/${id.startsWith("exp") ? "experiment" : "clips"}/${id}.mp4`;
  const posterUrl = `/history/posters/${id}.webp`;
  mp4(src, `public${url}`);
  poster(`public${url}`, `public${posterUrl}`);
  const [w, h] = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", `public${url}`]).split(",").map(Number);
  assets.push({ id, kind: "video", origin: "ai-recreation", url, posterUrl, width: w, height: h, durationSeconds: Number(vdur(`public${url}`).toFixed(3)), frameRate: 24, beatMarkers, alt, sceneVersion: SCENE_VERSION, approval: "approved", provenanceId });
}
function addImage({ id, src, alt, provenanceId, dir = "stills", origin = "ai-recreation", alpha = false }) {
  const url = `/history/${dir}/${id}.webp`;
  const [w, h] = webp(src, `public${url}`, { alpha });
  assets.push({ id, kind: "image", origin, url, width: w, height: h, alt, sceneVersion: SCENE_VERSION, approval: "approved", provenanceId });
}

const LAB_INPUT = "Frame-zero render of the Lens & Framing lab, HD cast (24 mm, t = 2.40 s) + close-up crops of Bram and Pip";
const ERAS = {
  drawings: "Pencil-test treatment of the lab scene: Bram and Pip by the doorway, graphite on paper",
  multiplane: "Painted-cel treatment: inked, flat-painted characters over a watercolor street painting",
  television: "Limited-animation TV treatment: flat colors and bold outlines",
  "digital-2d": "Digital ink-and-paint treatment: clean colored lines and crisp fills",
  cg: "Early-CG treatment: plastic materials and hard shadows",
  simulation: "Contemporary CG treatment: soft bounced light and a knitted scarf",
  stylization: "Illustrated comic-style CG treatment: ink lines and halftone shading",
};

/** Editorial selections (v2): still job + chosen candidate, and the chosen clip take. */
const PICKS = {
  drawings: { still: ["still-drawings-r1", 1], clip: "a", tried: "2 takes: b colorized the pencil test" },
  multiplane: { still: ["still-multiplane-r1", 0], clip: "b" },
  television: { still: ["still-television-r1", 0], clip: "a" },
  "digital-2d": { still: ["still-digital-2d-r1", 0], clip: "a" },
  cg: { still: ["still-cg-r1", 0], clip: "a" },
  simulation: { still: ["still-simulation-r1", 0], clip: "a" },
  stylization: { still: ["still-stylization-r1", 0], clip: "b" },
};
for (const [era, alt] of Object.entries(ERAS)) {
  const pick = PICKS[era];
  const stillJob = pick.still[0];
  const clipJob = `clip-${era}-${pick.clip}`;
  const pid = `prov-clip-${era}`;
  provenance.push({
    id: pid,
    steps: [
      step(`1 · Era still (candidate ${pick.still[1] + 1} of 3${pick.stillNote ? `; ${pick.stillNote}` : ""})`, stillJob, [LAB_INPUT]),
      step(`2 · Draft clip from the approved still (take ${pick.clip}${pick.tried ? `; ${pick.tried}` : " of 2"})`, clipJob, ["Approved era still (start frame)"]),
    ],
    edits: ["Still: converted to WebP", "Clip: re-encoded to H.264 at 1280 px wide for delivery; no trim, retime, interpolation or audio"],
    note: "Draft tier: MiniMax H3 Max. A final pass may re-render the approved stills with Seedance 2.5.",
  });
  addImage({ id: `still-${era}`, src: `${W}/approved/still-${era}.png`, alt, provenanceId: pid });
  addVideo({ id: `clip-${era}`, src: `${W}/raw/${clipJob}.mp4`, alt: `${alt}, animated: Bram notices Pip, turns and waves back while Pip waves`, provenanceId: pid });
  cost.estimated += job(stillJob).estimatedCost + job(clipJob).estimatedCost;
}

// Director's-note edits (real outputs).
for (const ch of ["multiplane", "television"]) {
  const id = `note-${ch}-blue-scarf`;
  provenance.push({ id: `prov-${id}`, steps: [step("Director's note applied to the approved still", id, [`Approved ${ch} still`])], edits: ["Converted to WebP"] });
  addImage({ id, src: `${W}/raw/${id}.png`, alt: `The ${ch === "multiplane" ? "painted-cel" : "TV"} still with Bram's scarf repainted blue`, provenanceId: `prov-${id}` });
  cost.estimated += job(id).estimatedCost;
}

// Multiplane layers (registered to the approved painted still).
provenance.push({
  id: "prov-layers",
  steps: [step("Background clean plate", "layer-multiplane-bg", ["Approved painted still"]), step("Foreground lantern (transparent)", "layer-multiplane-fg", ["Approved painted still"]), step("Character matte", "layer-multiplane-chars-birefnet", ["Approved painted still"])],
  edits: ["Character cel = approved still × BiRefNet matte (the Sunburst character layer was rejected: misregistered)", "Blue cel = blue-scarf edit × the same matte"],
});
webp(`${W}/raw/layer-multiplane-bg.png`, `${OUT}/layers/multiplane-bg.webp`);
webp(`${W}/raw/layer-multiplane-fg.png`, `${OUT}/layers/multiplane-fg.webp`, { alpha: true });
webp(`${W}/raw/layer-multiplane-chars-birefnet.png`, `${OUT}/layers/multiplane-chars.webp`, { alpha: true });
webp(`${W}/layer-chars-blue.png`, `${OUT}/layers/multiplane-chars-blue.webp`, { alpha: true });
for (const id of ["layer-multiplane-bg", "layer-multiplane-fg", "layer-multiplane-chars", "layer-multiplane-chars-birefnet"]) cost.estimated += job(id).estimatedCost;

// Reference package (authored + approved).
addImage({ id: "ref-lab-master", src: `${W}/refs/master-frame.png`, alt: "Frame zero rendered from the Lens & Framing lab", dir: "refs", origin: "authored-demo" });
webp(`${W}/refs/master-frame.png`, `${OUT}/refs/lab-master.webp`);
addImage({ id: "ref-paint-bram", src: `${W}/refs/paint-bram.png`, alt: "Painted-cel reference: Bram", dir: "refs", provenanceId: "prov-clip-multiplane" });
addImage({ id: "ref-paint-pip", src: `${W}/refs/paint-pip.png`, alt: "Painted-cel reference: Pip", dir: "refs", provenanceId: "prov-clip-multiplane" });
{
  const url = "/history/refs/lab-animatic.mp4";
  mp4(`${W}/refs/lab-animatic-24mm.mp4`, `public${url}`);
  poster(`public${url}`, `${OUT}/posters/ref-lab-animatic.webp`);
  assets.push({ id: "ref-lab-animatic", kind: "video", origin: "authored-demo", url, posterUrl: "/history/posters/ref-lab-animatic.webp", width: 1280, height: 720, durationSeconds: 6, frameRate: 24, alt: "Six-second 3D animatic rendered from the Lens & Framing lab", sceneVersion: SCENE_VERSION, approval: "approved" });
}

// Experiment: every take, published.
const review = JSON.parse(readFileSync("scripts/history-media/experiment-review.json", "utf8"));
const takes = [];
for (const cond of ["text", "refs"]) {
  for (let i = 1; i <= 4; i++) {
    const id = `exp-${cond}-${i}`;
    const j = job(id);
    cost.estimated += j.estimatedCost;
    const condition = cond === "text" ? "text" : "references";
    if (j.state !== "needs_review" && j.state !== "approved") {
      takes.push({ id, condition, index: i, assetId: "", failed: j.error ?? j.state, observations: [] });
      continue;
    }
    const pid = `prov-${id}`;
    provenance.push({ id: pid, steps: [step(`Take ${cond === "text" ? "A" : "B"}${i}`, id, cond === "text" ? ["Text brief only"] : ["Painted key frame (@Image1)", "Bram reference (@Image2)", "Pip reference (@Image3)", "Lab 3D animatic (@Video1)"])], edits: ["Re-encoded to H.264 for delivery; no trim or retime"] });
    addVideo({ id, src: `${W}/raw/${id}.mp4`, alt: `Experiment take ${cond === "text" ? "A" : "B"}${i}`, provenanceId: pid });
    takes.push({ id, condition, index: i, assetId: id, observations: review.takes[id] ?? [] });
  }
}
// Hero = the chosen reference take (no separate AI hero is generated).
const hero = assets.find((a) => a.id === review.heroTake);
assets.push({ ...hero, id: "exp-hero" });
assets.push({ ...hero, id: "exp-revision-source" });

let revision = null;
const revId = `exp-revision-${review.heroTake}`;
const keyId = `rev-keyframe-${review.heroTake}`;
if (existsSync(`${W}/jobs/${revId}.json`) && job(revId).state === "needs_review") {
  const j = job(revId);
  cost.estimated += j.estimatedCost + job(keyId).estimatedCost;
  provenance.push({
    id: "prov-exp-revision",
    steps: [step("1 · Edit the source take's first frame", keyId, [`First frame of take ${review.heroTake}`]), step("2 · Regenerate from the edited frame, following the source take", revId, ["Edited first frame (start frame)", `Take ${review.heroTake} (Video 1, motion reference)`])],
    edits: ["Re-encoded to H.264 for delivery; no trim or retime"],
    note: "MiniMax H3 Max has no video-edit mode, so this revision is a keyframe edit plus reference-guided regeneration, not an in-place edit.",
  });
  addImage({ id: "exp-revision-keyframe", src: job(keyId).rawOutputs[0].file, alt: "The source take's first frame with the scarf recolored blue", provenanceId: "prov-exp-revision" });
  addVideo({ id: "exp-revision", src: j.rawOutputs[0].file, alt: "The reference take regenerated with a blue scarf", provenanceId: "prov-exp-revision" });
  revision = { sourceTakeId: review.heroTake, assetId: "exp-revision", keyframeAssetId: "exp-revision-keyframe", endpointId: j.endpointId, operation: "Keyframe edit (GPT Image 2.5 Sunburst) + reference-guided regeneration (H3 Max)", instruction: j.input.prompt, observations: review.revision };
}

// The exact text sent to the endpoints, read back from the job records.
const BRIEF_TEXT = job("exp-text-1").input.prompt;
const REF_ADDENDUM_TEXT = job("exp-refs-1").input.prompt.slice(BRIEF_TEXT.length).trim();
const experiment = {
  id: "conditioning-v1",
  look: "painted-cel",
  brief: BRIEF_TEXT,
  conditions: [
    { id: "text", title: "Description only", endpointId: "minimax/h3-max/text-to-video", inputs: ["Text brief"], parameters: { duration: 6, resolution: "768P", aspect_ratio: "16:9", prompt_expansion_mode: "disabled" } },
    { id: "references", title: "With references", endpointId: "minimax/h3-max/reference-to-video", inputs: ["Text brief", "Painted key frame (Image 1)", "Bram reference (Image 2)", "Pip reference (Image 3)", "Lab 3D animatic (Video 1)"], parameters: { duration: 6, resolution: "768P", aspect_ratio: "16:9", prompt_expansion_mode: "disabled" }, promptAddendum: REF_ADDENDUM_TEXT },
  ],
  references: [
    { assetId: "still-multiplane", label: "Image 1 · painted key frame (approved chapter 2 still)" },
    { assetId: "ref-paint-bram", label: "Image 2 · Bram" },
    { assetId: "ref-paint-pip", label: "Image 3 · Pip" },
    { assetId: "ref-lab-animatic", label: "Video 1 · lab 3D animatic (staging and timing)" },
  ],
  heroTakeId: review.heroTake,
  takes,
  revision,
  about: "Draft tier. Both conditions used MiniMax H3 Max on fal on 2026-11-01 with the same brief, duration, resolution and aspect ratio and prompt expansion disabled, but through different endpoints (text-to-video vs reference-to-video), so this is a workflow comparison, not a controlled benchmark of one parameter. No seeds were set. The reference images were upscaled 2× to meet the endpoint's 256 px minimum. Four takes per condition show behavior; they are not a success rate.",
  reviewStatus: review.reviewStatus,
};

writeFileSync("src/history/content/published-assets.json", JSON.stringify({ generatedAt: new Date().toISOString(), assets, provenance }, null, 1));
writeFileSync("src/history/content/experiment.json", JSON.stringify(experiment, null, 1));
console.log(`published ${assets.length} assets, ${provenance.length} provenance records; estimated generation cost of published set ≈ $${cost.estimated.toFixed(2)}`);
