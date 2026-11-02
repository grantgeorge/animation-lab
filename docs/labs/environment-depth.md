# Environment & Depth lab

`/labs/environment-depth`. One procedural forest, seven depth cues and three ways to build the same shot. The question comes from the brief: how do you make a flat screen feel like a believable, expansive world? Pip, a 1.05 m child, stands on a mossy path among 62 m redwood-scale trunks. Behind them a clearing opens onto hills and three mountain ranges. Turn the cues off and the forest reads as a theatre flat. Run the same camera move through a painted plate, a stack of depth layers and the real geometry, and the lab measures how much of each frame the move had to reveal. That number is the link to AI video: the bigger the reveal, the more a model has to invent and keep consistent.

It complements `/labs/animation-camera` (experiment 3), which teaches the three camera *types* on the doorway set. This lab is about depth cues, world-building in a large environment, and the reveal and occlusion problem.

## The forest (all metres)

- **Path:** straight down −Z through Pip at (0.35, 0, −6), bending left after z = −58 into the clearing. The camera stands 1.05 m right of the path centre at 24 mm, with its eye at 1.1 m.
- **Giants:** ten hand-placed hero trunks (radius 1.7–3.1 m, height 58–72 m), with five-lobed buttress root flare, bark ridges, baked ground AO and moss on the shady side. About 240 instanced fill trunks are scattered by seeded rejection sampling. They are kept off the path, out of the camera corridor (every lens and move position) and out of the vista wedge.
- **Canopy:** instanced lumpy leaf clumps from 70 % of each tree's height upward, so the trunks read as bare columns for the first ~40 m.
- **Undergrowth and props:** about 340 ferns (arched, serrated, backlit), bushes, rocks and a fallen log.
- **Foreground set:** a trunk and dark ferns that ride with the base camera, so every lens keeps a foreground frame.
- **Far:** a valley, rolling hills with about 1100 instanced conifers, three mountain ridges at 1.5, 2.35 and 3.4 km, and a painted sky dome.
- **Air:** sun shafts and fireflies. The shafts scale with the haze, because shafts are only visible when the air scatters light.
- **Scale references:** a log cabin (4.6 m to the ridge), a split-rail fence (1.1 m) and a deer (1.6 m), plus Pip.
- **Look:** stylised, not photoreal. Albedo lives in vertex colours, with a soft cel band on the sun term, canopy dapple, rim light and value noise. One custom forest shader carries the haze, the parallax squash and the occlusion switch. Pip keeps his own GLTF materials (cloned, then patched with the same haze).

Everything lives on one canvas. Draws are instanced or merged, so there are about 25 draw calls for the world. The forest runs at 60 fps on a laptop GPU and about 8 fps under `?e2e=1` (SwiftShader, lite Pip).

## The seven cues

Each cue has a control and a one-line explanation that changes when the cue is off.

| Cue | Control | What it does in the renderer |
|---|---|---|
| **Parallax** | Strength 0–100 % | A *squash* relative to the frame-0 camera. Every vertex's depth along that camera's axis is pulled toward Pip's plane, D + (d − D)·k, keeping its frame-0 screen position. At 100 % the forest is true 3D. At 0 % it's a painting on one plane: frame 0 is identical, and only the motion changes. It's floored at k = 1.5 % so the renderer can still sort surfaces. Pip is squashed as an object, and the 2.5D cards use the same formula. |
| **Atmospheric depth** | Strength 0–100 %, four haze colours | Aerial perspective per pixel: seen = local·T + haze·(1 − T). Optical depth = amount·(ρa·L + ρh·∫e^(−y/H) ds), a thin uniform air (ρa = 0.0005/m) plus a ground mist (ρh = 0.0085/m at y = 0, scale height 28 m), capped at 95 %. Far things get lighter, lower in contrast (two surfaces keep (1 − f) of their difference) and bluer. Ridge tops stay clearer than the valley. |
| **FG / MG / BG layering** | On / off | Shows or hides the foreground framing set (the dark trunk and ferns near the lens). The *FG / MG / BG* overlay tints pixels by distance: < 5 m, 5–45 m, > 45 m. |
| **Scale cues** | On / off, references (Pip, cabin, fence, deer), story (Giant ×1, Ordinary ×2.2, Small ×4) | The trees never change. The references are scaled about their feet, and the viewer assumes their familiar size, so the same 62 m tree *reads* as 62 m, 28 m or 16 m. `impliedFromPixels` proves this from projected sizes. |
| **Occlusion** | On / off | Off turns every solid (trunks, canopy, ferns, props) into one flat, unlit value. Overlapping shapes merge, so the overlap edge no longer says which is in front. Haze, if on, still separates them, like layered paper cut-outs. |
| **Depth of field** | On / off, f/1.2–f/11 | A thin-lens circle of confusion on the full-frame gate, focused on Pip, as a gather blur in post. It's honest optics: at 24 mm focus is deep, and at 50–85 mm the foreground melts. |
| **Perspective** | Focal length 18–135 mm, converging-line overlay | Matched subject size: the camera backs off along a fixed heading so Pip always fills 12 % of the frame height (d = f·H / (0.12·h)), with the tilt re-aimed at the same point on Pip's plane. Wide and close gives converging trunks and a big foreground. Long and far (58 m at 135 mm) gives compression. The overlay draws the path edges to their vanishing point, plus the horizon. |

**Take-apart:**
- **Flatten** turns every cue off: an 85 mm lens, no haze, no foreground, no references, merged silhouettes, a pinhole and no parallax. The result reads as one theatre flat.
- **Add next cue** rebuilds the frame in the order occlusion → lens → layers → scale → haze → parallax → focus. The new cue is highlighted, and a caption under the picture names it.
- **All** turns every cue back on.

## The signature experiment: one move, three constructions

| Move | Definition (u = 0 is always the base frame) |
|---|---|
| Push in | 4.2 m straight down the heading, orientation fixed |
| Track + push | 3.4 m right plus 1.6 m forward, orientation fixed |
| Arc | 28° orbit about the vertical through Pip's frame centre, always looking at it |

*Move size* scales all three (×0.4–×2). One loop is 12 s: hold, out, hold, back, hold.

The constructions:
- **2D:** one plate, rendered once from the frame-0 camera (overscan 1.5×) and hung at Pip's depth. The move pans and zooms it. On an arc you see it obliquely, and past its edge you see the void hatch.
- **2.5D:** the same frame-0 picture is cut into 2–6 depth layers. Boundaries are geometric between 4.5 and 220 m, and each card hangs at the median depth of its pixels, squashed by the parallax strength. By default each layer is cut from the one picture by its depth buffer, which is what an AI depth split gives you: nothing exists behind the foreground. When a move uncovers that area, the backdrop shows a purple hatch (*never painted*), and the card edges show a dark hatch (*off the card*). **Paint behind layers (clean plates)** re-renders each slice with the camera's near/far planes at the slice edges, as a multiplane painter would. The holes go away, but card edges and flat cut-outs remain.
- **3D:** the real geometry. Trunks turn and the forest behind them is revealed correctly.

### Revealed area (the metric)

Every frame, the lab renders the true forest's depth (log-encoded into RGBA8 so it works on software WebGL) at 240 × 135 from the current camera. It already has the same buffer from the move's first frame. For each pixel it lifts the depth to a world point and reprojects it into frame 0:
- **Edge:** the point lands outside frame 0, or behind that camera.
- **Behind objects (disoccluded):** something nearer covered that spot in frame 0. The test uses the max of the 2×2 neighbourhood, with a 3.5 % + 6 cm tolerance, so silhouettes don't count.

Revealed = edge + disoccluded, as a share of the frame. It's shown as a live two-colour bar and as a pink/cyan *Revealed* overlay with outlines. The end-of-move value grades the move for AI video: under 10 % safe, under 28 % watch it, otherwise risky.

The metric is measured on the *real* forest in every construction, because it's a property of the move: how much new picture it demands. 3D renders that picture, 2.5D shows holes there, and 2D can't show it at all.

| At the end of the move (24 mm, all cues) | Revealed | Behind objects |
|---|---|---|
| Push in | ≈ 16 % | ≈ 16 % (the camera passes the foreground ferns) |
| Track + push | ≈ 48 % | ≈ 20 % |
| Arc | ≈ 57 % | ≈ 24 % |

With parallax at 0 % the world is a plane, so it can't hide anything: the reveal is edges only. Flat is easy for a model, but it looks flat.

## Inspect

- The picture, with the depth-band overlay available.
- **Plan:** an SVG floor plan with trunks (and root flare), the path, the references, the base and current frustums, the move path and the 5 m / 45 m band rings.
- **Layer stack:** card depths on a log axis with FG/MG/BG bands, speed relative to the backdrop (∝ 1/depth) and a live slide bar since frame 0.
- **Haze curve:** contrast left vs distance (1 m to 3 km), with a strip of bark and moss as seen through the air, and markers at Pip, the trunks, the forest, the hills and the ridge.
- **Live readouts:** camera height, distance to Pip, lens and field of view, tilt, frame width at Pip, tree height (true, in Pips, and as it reads), Pip's share of the frame, revealed now and at the end, haze at four distances, and the squash.

## Prompt

`engine/prompt.ts` writes one deterministic Seedance phrase from the state. For example: "towering ancient forest of giant redwoods, a tiny child on a mossy path for scale, layered foreground ferns framing the shot, overlapping trunks receding into depth, soft blue atmospheric haze on distant ridges, 24mm wide-angle, trunks converging upward, shallow depth of field, focus on the subject, slow lateral tracking shot behind the foreground ferns with strong parallax". Under it, a guidance line turns the measured end-of-move reveal into advice. Short notes say which cues to name: haze words, all three bands, one familiar object, focal-length words, and small moves that reveal little.

## Modes, keys, deep links, hooks

- **Watch:** the full-frame move, caption, the cues that are on, prompt and transport. **Inspect:** as above. **Experiment:** construction, move, 2.5D options, the seven cues, take-apart and overlay. Keys:
  - `W` `I` `E` switch mode;
  - `1` `2` `3` switch construction;
  - `P` `T` `A` switch move;
  - `F` flattens and `N` adds the next cue;
  - `R` / `B` toggle the overlays;
  - `Space` plays or pauses, and `,` `.` step one frame.
- **Deep links:**
  - `?mode=` and `?construct=2d|25d|3d`;
  - `?move=push|track|arc` and `?size=`;
  - `?cue=flat|all|<cue>` (isolate one cue) and `?step=0–7`;
  - `?overlay=reveal|bands`, `?layers=2–6` and `?clean=1`;
  - `?parallax=`, `?haze=`, `?focal=`, `?hazeColor=`, `?story=`, `?refs=pip,cabin,…`, `?guides=1`;
  - `?u=0–1` freezes the move at a progress.

  The address bar stays in sync.
- **Test hooks:**
  - The root `data-testid="lab-root"` carries `data-mode`, `data-construct`, `data-move`, `data-overlay`, `data-step`, `data-cue-parallax|haze|layers|scale|occlusion|dof|perspective`, `data-scale-story`, `data-cues-on`, `data-revealed` and `data-ready`.
  - `?e2e=1` (or `?debug=1`) installs `window.__envLab` with `getState`, `set(patch)`, `live()`, `frames(n)`, `seek(t)`, `setU(u)`, `pause`, `play` and `revealed()`.
  - `live()` includes the reveal, the end-of-move reveal, the per-layer depths and slides, construction coverage (content / hole / void plus hole sample points), probes, readouts and capture counts.

## Architecture

- **`engine/`** is pure math with three math classes only (30 Vitest tests in `engine.test.ts`):
  - `world.ts`: layout, ground, seeded scatter, path.
  - `camera.ts`: matched framing, moves, loop, plan bounds.
  - `haze.ts`: optical depth, transmittance, contrast, curve, colours.
  - `scale.ts`: references, stories, implied height.
  - `layers.ts`: slicing, median card depth, squash, parallax ∝ 1/depth, anchor slides, bands.
  - `reveal.ts`: depth packing, reprojection, revealed area, mask bounds.
  - `prompt.ts`.
- **`runtime/Orchestrator.tsx`** is the lab's only positive-priority `useFrame`. Each frame it:
  1. ticks the clock;
  2. places the camera on its move;
  3. updates the shared cue uniforms;
  4. places the foreground set, references and Pip;
  5. poses Pip;
  6. re-captures plates when the look changes (2D/2.5D only);
  7. refreshes the frame-0 reference depth when the geometry changes;
  8. measures the reveal (and the end-of-move reveal on change), plus construction coverage;
  9. renders the main picture through post into its DOM slot.
- **`runtime/pipeline.ts`:** pooled targets, plate and slice captures, cards, the depth and mask passes, the post pass.
- **`runtime/shaders.ts`:** the forest, sky, shaft, decal, firefly, depth, card and post materials, plus `patchHaze` for the character.
- **`stage/`:** procedural geometry and the forest builder (plain three objects, built once and disposed on unmount), plus Pip's look-up clip.
- **`ui/`:** chrome, picture HUD, controls, inspect diagrams and prompt.
- **Scripts:**
  - `scripts/environment-depth/shots.mjs` captures the screenshot set (GPU; `E2E=1` for the software path).
  - `probe.mjs` captures one state with a state patch and prints live readouts.
  - `perf.mjs` reports load time and frame rate.

## What is approximate, and known limits

- **Stylised, not physical.** Lighting is a custom cel-ish Lambert with fake canopy dapple. There are no real shadow maps; Pip gets a soft contact decal. Light shafts are additive cards scaled by haze, not volumetrics.
- **Parallax strength is a teaching device.** Real cameras don't squash the world. It's the same maths as hanging multiplane cards closer together. It's floored at 1.5 % for depth sorting, and Pip is squashed as an object, not per vertex.
- **The haze is analytic** (exponential height fog plus uniform air along a straight ray). It has no multiple scattering and no sun-dependent in-scatter beyond a small glow toward the sun.
- **2D/2.5D plates freeze Pip** at the moment of capture. His idle look-up is subtle, but the plates don't animate. Air effects are baked into the plate (and only into the backdrop slice for clean plates).
- **Bands use the depth buffer of what is rendered.** In 2.5D that's card depth, so a whole layer takes one band.
- **The metric is low-resolution (240 × 135)** with a tolerance tuned for this scene. Thin foliage can flicker between seen and disoccluded, and a few percent of noise is normal. On software WebGL it updates every second frame while playing.
- **Depth of field at 24 mm is subtle by design** (honest full-frame optics). The blur radius is capped at 2.6 % of the picture height (1.2 % on software WebGL).
- **The risk thresholds** (10 % / 28 %) are heuristics for prompting, not measurements of any model.
- **The fully flattened frame is deliberately stark.** Merged silhouettes plus a long lens and no haze turn the forest into one painted wall, with the hills seen through a gap.
