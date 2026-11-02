# Animation Camera lab

`/labs/animation-camera`. One scene (the doorway: Bram, Pip, the lantern, the doorway, the back wall, the clock tower) filmed five ways. The thesis comes from the brief: in animation the camera is virtual, so you want a cinematographer's controls plus an animator's freedom to break physical rules. Every experiment ends in a one-line Seedance prompt.

## What it teaches

| # | Experiment | What changes | What to notice |
|---|---|---|---|
| 1 | **Perspective vs orthographic** | The same animated set through a three.js `PerspectiveCamera` (30 mm, three-quarter street view) and an `OrthographicCamera` matched so Bram is the same size and in the same place. There's also a true isometric preset: ortho at 45° around and arctan(1/√2) = 35.264° down. | Cyan floor rulers converge to a vanishing point in perspective and stay parallel in ortho. Three identical 1.78 m amber poles (at Bram's, Pip's and the back wall's depth) shrink with depth in perspective and match in ortho. Pip ÷ Bram reads 0.52 in perspective and 0.63 (the true ratio) in ortho. |
| 2 | **24 / 50 / 100 mm, matched framing** | The camera dollies so Bram's head-and-shoulders box always fills 78 % of the frame height (distance ∝ focal length). A focal slider covers 18 to 135 mm, and a dolly-zoom (vertigo) sweep runs 24 → 100 → 24 mm. | Nose ÷ ear magnification falls from 1.29× (24 mm, 1.2 m) to 1.06× (100 mm, 4.9 m). The doorway grows from 0.97× to 1.89× Bram's box and the window from 0.47× to 1.29×. The back wall in frame narrows from 10.6 m to 3.9 m. |
| 3 | **2D vs 2.5D vs 3D movement** | One camera move (a lateral track with a push-in, or a 64° orbit) applied to (a) one flat painting with the characters on the same plane, (b) a seven-card multiplane stack hung at real depths, and (c) the real 3D set. | 2D slides as one, with no parallax. 2.5D cards slide at 1/depth (the lantern 4.4× faster than the sky). On an orbit the cut-outs give themselves away, and the 3D set turns real volumes. Inspect shows the stack from the side, like a Disney multiplane stand diagram, with live slide bars. |
| 4 | **Photoreal vs stylized camera** | A 75 mm shot that holds on Bram, whip-pans to Pip for the wave and hop, then pans back. Photoreal adds physical depth of field (thin-lens CoC, f/1.4 to f/16, a rack focus that follows the aim) and motion blur integrated across a 180° shutter. Anime keeps everything sharp, steps the characters on ones, twos or threes while the camera stays on ones (optionally on twos), and adds speed lines on fast moves and a cel look (on by default): flat colour in two tones with a cool shadow tint and clean ink. Split shows both looks of the same instant. | The dope-sheet strip shows new drawings vs held frames. Character clock vs camera clock readouts. The pan peaks at about 133°/s. |
| 5 | **The impossible camera** | Five shots, each beside its closest physical version: a **perspective cheat** (three monitors: a real 14 mm from 0.55 m gives a dramatic world but a big-nosed face, nose ÷ ear 1.80×; a real 135 mm from 5.3 m gives a flattering face, 1.05×, in a flat cropped world; the cheat renders the world through the 14 mm and Bram alone through the 135 mm); a **fisheye push** (a 35 → 14 mm push with an art-directed barrel bulge); a **scale cheat** (Pip scaled up about his feet as the camera pulls away); **through the wall** (the camera glides past Bram's shoulder and through brick); and an **impossible whip** (3.8 m and about 130° in a quarter second). | Readouts name the rule each shot breaks. The whip's peak acceleration is computed from the path (tens of g, against well under 1 g for the physical whip pan). Inspect draws the physical path (cyan) against the impossible one (pink). |

## Controls

- **Modes:** Watch (full-frame result, caption, prompt), Inspect (the stage view with frustums, layer stacks, paths and the focus plane, plus readout tables) and Experiment (controls plus a comparison row of two or three monitors; click one to select it). Keys `W` `I` `E`.
- **Experiments:** the picker or keys `1` to `5`.
- **Per experiment:** `P` / `V` / `C` switch projection, isometric and wipe (exp 1). `[` / `]` step through the lenses (exp 2). `M` / `O` cycle the style and switch orbit/track (exp 3). `S` cycles the look (exp 4). `D` picks the next impossible shot (exp 5).
- **Time:** `Space` plays or pauses, `,` `.` step one frame (1/24 s). There's a scrub bar under the picture.
- **Deep links:** `?exp=1–5` (or `projection`, `lens`, `multiplane`, `style`, `impossible`) and `?mode=watch|inspect|experiment`, plus `proj=persp|ortho|iso`, `compare=wipe`, `focal=18–135`, `sweep=1`, `move=2d|2.5d|3d`, `kind=track|orbit`, `style=photoreal|anime|split`, `step=1|2|3`, `demo=cheat|push|scale|wall|whip`. The address bar is kept in sync (replaceState), so it's always a shareable link. `freeze=<s>` pauses at a time, and `e2e=1` installs `window.__animCamLab` and loads the lite characters.
- **Test hooks:** the lab root carries `data-testid="lab-root"` with `data-mode`, `data-exp`, `data-projection`, `data-view`, `data-compare`, `data-focal`, `data-move`, `data-move-kind`, `data-style`, `data-step`, `data-demo`, plus `data-camera-type` (the three.js camera type actually rendered into the main slot, e.g. `OrthographicCamera` or `PerspectiveCamera|OrthographicCamera` during a wipe) and `data-ready`.

## Prompts and model notes

`engine/prompt.ts` writes one deterministic phrase per state (e.g. "Orthographic isometric view, 45° around and 35° down, miniature diorama…, no perspective convergence" or "2.5D multiplane parallax: lateral track with a slow push-in through flat painted layers…"). The prompt box also carries **What video models understand**: field notes, not a benchmark, sorting each idea as reliable, hit-or-miss or rarely.
- **Reliable:** lens looks, shallow DoF, dolly zoom, orbit, whip pan, anime and speed lines.
- **Hit-or-miss:** isometric/orthographic ("isometric diorama" beats "orthographic camera"), multiplane parallax (describe the layers sliding), passing through walls.
- **Rarely:** on twos/threes (models interpolate smoothly, so step-print in the edit), per-layer focal length and scale cheats (describe the feeling, or composite two generations).

## Architecture

- `engine/` is pure math (three math classes only), covered by Vitest in `engine.test.ts` (24 tests):
  - `common.ts`: subjects from the doorway performance, ortho projection, and `matchOrtho`, which matches a subject's size and position.
  - `projection.ts`: presets, vanishing points, ruler segments, convergence, pole sizes.
  - `lens.ts`: matched distance, nose/ear, doorway/window ratios, wall width, sweep.
  - `multiplane.ts`: reference camera, layer table, card placement, the move, per-layer parallax.
  - `timing.ts`: stepping, shutter offsets, CoC, the exp 4 shot, angular velocity.
  - `impossible.ts`: the five demos, physical twins, path stats in g.
  - `prompt.ts`.
  - It borrows `lookAtPose`, `rotateAboutY`, `ease` and `makeSubjectFn` from Camera Movement, and `distanceForFraction` / `hfovDeg` from `src/engine/optics.ts`.
- `runtime/Orchestrator.tsx` is the lab's only positive-priority `useFrame`. Each frame it:
  1. ticks the clock;
  2. poses the cast;
  3. asks `exps.ts` for a plan (cameras, readouts, viz);
  4. runs the plan's captures;
  5. renders the stage, every DOM slot (scissored), then the inset stage.
- `runtime/kit.ts` holds pooled cameras and render targets, slot viewports, the cel holdout capture, and the post chain:
  - N sub-frame renders accumulated into a half-float target (shutter);
  - a single-pass gather depth of field;
  - a final look pass with three's tone mapping and colour-space chunks, a gap-filling directional blur along the camera motion, cel bands, depth outlines, tapered speed lines and the fisheye.
- `runtime/post.ts` holds the shaders, including a Kuwahara "paint" pass for the 2D/2.5D layers.
- **2.5D layers:** the static set slices are cut from the real set once, using the capture camera's near/far planes. The capture camera is the reference pose with overscan (1.55×, 2.4× for the sky). Bram casts his shadow into the ground slice through a cast-only layer, then the slices are painted. The two character cels are re-rendered every frame with the set as a depth-only holdout matte, so Pip stays hidden inside the doorway. Cards use premultiplied alpha in painter's order, on their own layers (5 for 2.5D, 7 for 2D, 8 for outlines). Exp 1 guides sit on layer 4, and the cast-only layer is 6, enabled on the key light's shadow camera.
- **Cel look (exp 4):** the anime pass separates colour from light, as a cel painter does.
  - An unlit albedo pass (textures read slightly blurred, then an edge-preserving bilateral smooth) gives flat colour.
  - A key-light-only white Lambert pass (cast shadows kept) is blurred, then thresholded on a narrow ramp into one crisp two-tone mask that follows smooth contours.
  - A fill pass (every other light, heavily blurred) only carries hue and gentle brightness, so warm practicals survive without banding.
  - The shadow tone is tinted cool and the lit tone slightly warm.
  - Ink comes from the second derivative of 1/z (zero on planes, so floors stay clean) plus very strong creases in a smooth-normal pass, at a fixed pixel width.
- **Perspective cheat:** the background pass renders with Bram on the cast-only layer, so he still casts his shadow. Then Bram alone is drawn through the tele camera after a depth clear. The scene background is dropped for that pass, because a colour background forces a clear in three.

## What is approximate

- Depth of field is a post gather on the centre sample's depth (after motion blur), not a ray-traced lens. Motion blur is 10 sub-frame renders (3 under `e2e`/low quality) plus a short directional fill along the camera motion. Object motion between samples is real, but the fill assumes camera-dominant motion at ~5 m.
- Nose ÷ ear uses Bram's rest-pose facing and the measured landmarks. When he turns toward Pip (2.3–5.5 s), the number is a rest-pose estimate.
- 2.5D cards are captured once at t = 3.5 s (door open). The door leaf and Bram's baked shadow are frozen in the painting, and the shadow detaches from him when the camera moves (an honest cut-out artefact). The sky card is captured at a lower texel density than the others.
- The perspective cheat aligns Bram on his framing box. Contact points aren't solved, which is why the shot is head-and-shoulders.
- The cel look is a screen-space approximation, not hand-drawn: some low-frequency coat texture survives the smoothing, and band edges follow the 3D geometry rather than an animator's chosen shapes. It costs four extra renders per anime view.
- The scale cheat scales Pip about his mark, so his small root offsets during the performance scale too.
- The model notes are prompting heuristics, not measured results.

## Known limits

- Doorway scene only (no scene picker). The alley and workshop would need their own layer tables.
- Orbiting the 2.5D stack or the 2D painting deliberately runs toward the edges of the painted cards. That's the lesson, but the far left can show the painting's edge at the extreme of the arc.
- Exp 4 Split renders the shot twice through the post chain, plus the two comparison monitors. It's the heaviest view (about 30 scene renders a frame at high quality, with cel on).
- Speed lines are screen-space strokes driven by camera angular speed. They aren't drawn per character, and there are no smear frames on the characters themselves.
- Phone layout stacks the panels but hasn't been reviewed as carefully as desktop.

## Review

- Screenshots (1440×900) are in `docs/screenshots/animation-camera/`, captured by `node scripts/animation-camera/shots.mjs` against the dev server (GPU flags).
- `scripts/animation-camera/probe.mjs <url>` prints console errors for one state.
- E2E: `e2e/28-animation-camera.spec.ts`.
