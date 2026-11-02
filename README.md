# Animation Lab

An interactive school for animated filmmaking. Labs: **Lens & Framing**, **Camera Movement**, **Lighting Studio** and **Timing & Spacing** (plus **Character Acting**, built in a parallel session).

A miniature animated set, two characters (Bram and Pip) performing a 6 s loop, and a virtual cinema camera on a dolly rail. Lens & Framing opens on the camera's 16:9 shot, with six live lens comparisons and an optional studio view. Turn on **Match framing** and the camera rolls along the rail to keep the subject the same size, making the change in perspective visible.

The lab also writes **shot language** for storyboards and AI video prompts (Seedance, Veo, Kling): shot size, lens, angle, distance, perspective, movement. The JSON export carries the camera for Blender and Unreal.

## Run it

```bash
mise install            # node 26.13.0, pnpm 10.33.0
pnpm install
pnpm exec playwright install chromium   # once, for e2e tests
pnpm dev                # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm lint` | ESLint (the engine may not import React, R3F, Next or zustand) |
| `pnpm test` | Vitest: optics, projection, matched framing, teaching configurations, export, clock, store, lessons |
| `pnpm test:e2e` | Playwright against a production build on :3100 (headless, SwiftShader) |
| `pnpm test:e2e:gpu` | Same specs on the Metal-backed Chromium channel |
| `pnpm check:bundle` | Fails if the home page ships three.js |
| `pnpm verify` | typecheck → lint → test → build → bundle check → e2e |
| `SCREENSHOTS=1 BASE_URL=http://localhost:3000 pnpm exec playwright test 12 --project=chromium-gpu` | Writes the review matrix to `docs/screenshots/` |
| `node scripts/shots.mjs <dir>` | Quick six-state screenshot run against a dev server (`BASE_URL`, `FREEZE=3.35`) |
| `node scripts/shots-lens-refined.mjs` | Lens workspace review: desktop, compact, phone, scenes and full screen |
| `node scripts/shots-facial.mjs` | Lip sync review: default, comparison, Inspect, Watch and mobile |

A green `verify` is necessary, never sufficient: read the screenshots too.

## Using the lab

| Key | Action |
|---|---|
| `1`–`6` | Lens presets 18 · 24 · 35 · 50 · 85 · 135 mm |
| `[` `]` | Focal length ∓1 mm (⇧ ±5) |
| `←` `→` | Dolly 0.1 m (Match: framing ±5 %) |
| `M` · `T` | Fixed / Match framing · framing target Bram → Pip → Both |
| `Space` · `Home` · `,` `.` | Play/pause · restart · frame step |
| `V` · `⇧F` | Swap main view · shot fullscreen |
| `F` `G` `O` `P` | Frustum · grid · monitor guides · perspective guide |
| `S` · `C` · `⇧C` · `X` | Save shot · copy shot language · copy JSON · export drawer |
| `?` · `⇧U` · `Esc` | Help · hide interface · close |

Drag the camera body in the stage to dolly it. Click a character to frame it. Drag the stage to orbit, scroll to zoom.

**Scenes.** The Scene bar at the top of the stage switches between three sets that share the rail and the cast. Each set teaches a different lens lesson. You can deep-link one with `?scene=alley`.

| Scene | Genre | Lesson |
|---|---|---|
| The Doorway | Gentle drama | Matched framing: the doorway grows behind Bram at long lenses |
| The Long Alley | Action | Telephoto compression of a sprint: at 85 mm Pip barely gains ground, at 24 mm he explodes |
| The Workshop | Comedy | Close quarters: a long lens from the back stacks Pip onto Bram's shoulder |

## Camera Movement lab

`/labs/camera-movement` uses the same scenes and performances. It offers ten moves (locked off, dolly in and out, zoom, pan, tilt, truck, crane, orbit, tracking) and two experiments: **Dolly vs zoom** shows the same framing reached two ways on side-by-side monitors, and **Dolly zoom** is the vertigo effect. Drag the amber rings on the stage to move a key, and Shift-drag to raise it. The lab decomposes your path into operator vocabulary, such as "dolly in, slight pan left", and writes a shot prompt. Keys: `1`–`0` moves · `C` dolly vs zoom · `Z` dolly zoom · `R` reset path · `Space` · `,` `.`. See `docs/labs/camera-movement.md`.

## Facial Animation & Lip Sync lab

`/labs/facial-animation` shifts the mouth up to 300 ms early or late against six recorded dialogue deliveries. Compare a synced reference, inspect the audio envelope and mouth shapes, scale articulation, and isolate the upper face. Playback, slow motion, scrubbing and frame stepping share one audio clock. The direction card writes the matching prompt. See `docs/labs/facial-animation.md` for the controls and pending browser QA.

## Regenerating the characters

Concepts and models are generated offline (never at runtime) and the optimized GLBs are committed under `public/models/`:

```bash
node --env-file=.env.local scripts/characters/concepts.mjs all 2        # GPT Image 2.5 Sunburst concept art
POLY=80000 PBR=1 OUT_SUFFIX=-hd node --env-file=.env.local scripts/characters/meshy.mjs bram <concept.png>  # Meshy 7.1 HD + PBR + rig
pnpm exec gltf-transform optimize assets-src/characters/bram-hd/rigged.glb public/models/bram.glb --compress meshopt --texture-compress webp --texture-size 2048 --simplify false
node scripts/characters/face-rig-data.mjs   # face landmarks → src/scene/characters/faces/*.json
```

**Animation review loop.** These scripts check the cast's acting against the dev server:

```bash
node scripts/review/capture-arms.mjs assets-src/review/arms [scene] [shot]   # frame strips per character
node scripts/review/face-shapes.mjs assets-src/review/shapes Pip             # every face shape, forced
node --env-file=.env.local scripts/review/gemini-review.mjs out.md sheet.jpg ...   # Gemini 4 Argon critique via fal (~$0.05)
```

**Arms.** The rig driver applies each shoulder rotation as twist, then raise, then swing. Elbow and wrist bends are re-expressed in the arms-down pose, so elbows hinge like elbows. Gestures are reusable functions in `src/scene/animation/performances/arms.ts`.

**Faces.** The Meshy models have painted faces and no blend shapes. `faceRig.ts` builds blink, wide, brow up, angry, sad, smile and mouth-open morph targets around the painted features. Clips drive them through the `eyes`, `brows` and `mouth` parts.

Spend is logged in `scripts/characters/ledger.json` and capped at $100 (`DRY_RUN=1` prints the plan without spending).

## Docs

- `docs/architecture.md` — module map and data flow
- `docs/labs/` — one page per lab, including the Lens & Framing workspace and rig correction, plus `scenes.md`
- `docs/shot-settings.md` — export schema, Blender/Unreal conversions, shot language
- `docs/limitations.md` — approximations and measured performance
- `docs/roadmap.md` — the six disciplines, the catalogue of labs and the build order
- `docs/acceptance.md` — the 15 acceptance criteria with evidence
- `docs/design/` — the approved plan, design dossiers (inputs) and `decisions.md`

## Deploy

Vercel, Node 26.x, pnpm 10 (pinned via `packageManager`). The lab is fully static; no environment variables are needed at runtime.
