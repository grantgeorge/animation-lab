# Grading & Finishing lab

`/labs/grading-finishing`. It uses the same three scenes, cast and performances as the other 3D labs, treated as the shots of a small show. The lab teaches the last two of the three stages an AI or CG shot passes through:

1. **Generation:** characters, lighting, set, camera (the render, or the Seedance clip).
2. **Grading / look development:** exposure, white balance, contrast, palette, film-stock character.
3. **Finishing / stylization:** grain, halation, bloom, lens, sharpening, delivery.

It ends on the production idea: **one show look applied to every shot, with small per-shot overrides**. It also covers the limits of that idea: grading can't fix light direction, character design or rendering style.

The colour-palette and colour-script ideas belong to the Color & Color Scripting lab (`/labs/color-scripting`). This lab is about grading and finishing a shot and a show.

## What it teaches

- **The simple layer (default view).** The four sliders from the original brief: Film grain 0 %, Color temperature 50 %, Contrast 50 % and Bloom 0 %, plus **Reset effects**. They act on the live animated shot, under the caption *"Stylized demonstration of grading and finishing, not a physically accurate film-stock simulation."* Temperature 50 % and contrast 50 % are exactly neutral.
- **The grade.** It sits before finishing and works on the clip as delivered: display-referred Rec.709/sRGB code values, which is what an AI clip is.
  - **Exposure and white balance** act on linear light. The WB gains are normalised to unit luminance, so a grey keeps its brightness and 50 % is exactly neutral. Display-referred clips have no headroom, so exposure pushed up clips the lamps unless a stock shoulder rolls them off. That is a real lesson for 8-bit AI footage.
  - **Contrast** is a power S-curve around a pivot (default 0.46 ≈ 18 % grey). The pivot stays fixed, black stays black and white stays white.
  - **Lift / gamma / gain** colour wheels, each with a master level.
  - **Split-toning**, with a one-click teal-shadows / orange-highlights preset.
  - **Saturation.**
  - **Film stocks, labelled "inspired":** Kodak Vision3 500T, Fujifilm Eterna, vintage reversal and bleach bypass. Each has its own crosstalk matrix, highlight shoulder, contrast, toe, per-channel crossover gamma, shadow and highlight tints, and saturation, plus a strength slider.
- **Finishing.**
  - **Film grain** has two octaves of smooth value noise from an integer hash, so it clumps and doesn't fizz. It is mostly monochrome, with an optional per-channel amount. It is strongest in the mids and nearly absent in clipped white and deep black. Each timeline frame (24 fps) gets new grain, and a paused frame keeps its grain.
  - **Halation** is a tight red-orange glow thresholded on the brightest edges. **Bloom / diffusion** is Pro-Mist style: a wide neutral glow, plus a "mist" amount that diffuses the whole picture and lifts the blacks. **Glow only** shows each layer on its own, which makes the difference obvious.
  - **Lens:** barrel distortion (normalised so the corners stay the corners), radial chromatic aberration and blue anamorphic streak flares.
  - **Vignette** applied in linear light.
  - **Sharpening** with an unsharp mask.
  - **Gate weave:** a per-frame jitter.
- **Stylization (famous treatments, "inspired").**
  - **Green code-world grade (Matrix-inspired)** is pure grade, so it fits in a LUT.
  - **Comic print (Spider-Verse-inspired)** adds halftone shading dots, Ben-Day light dots, ink-plate misregistration, Sobel ink lines, paper, and animation on twos: the scene updates at 12 fps while the grain stays at 24.
  - **Painterly (Arcane-inspired)** applies a Kuwahara filter with an edge wobble, directional brush grain, ink accents and paper. It is a **screen-space post effect**: it repaints the whole frame every time, and its strokes aren't attached to surfaces, so they swim when things move. The panel says so and points to `/labs/painterly-textures` for surface-attached paint.
  - No imagery from any film is used.
- **Pipeline order.** The strip under the picture reads Generate → Grade (LUT-able) → Finish (not in a LUT) → Deliver. Every node can be bypassed. In Inspect, each node has a thumbnail of the picture *after* that node, and selecting one explains what it does and why it sits there.
- **The show-look exercise (the payoff).** The three scenes are gallery stills ("shots"), each delivered with a deliberate drift, as if generated on different days or by different models:
  - doorway: too warm (temperature +0.75);
  - alley: a stop under and flat (exposure −1.1, contrast 0.66);
  - workshop: oversaturated (saturation 1.65).

  The exercise has three steps:
  - **(a) Balance:** per-shot sliders, or **Auto-balance all three**.
  - **(b) One show look:** your current look becomes the show look. You can build it in One shot or pick a preset.
  - **(c) Override one shot:** a small grade layer and halation/grain amounts. **Suggest** applies a warmer, brighter workshop for the comedy beat.

  A **cross-shot drift** meter tracks the steps. Under it, **What grading can't fix** shows the same doorway grade on two stills, one re-rendered with the key light mirrored. The cast, contrast and grain match, but the shadows still fall the wrong way.
- **Deliver.**
  - A deterministic **Seedance prompt phrase** built from the numbers, for example `warm Kodak 500T-inspired film look, soft halation on practicals, gentle Pro-Mist bloom, fine organic film grain, subtle vignette`.
  - A **33³ `.cube` LUT** of the grade only, generated by the pure engine. In the show view it holds the selected shot's balance, the show grade and its override.
  - The **show-look JSON**: the show default plus per-shot balance and overrides.
  - A note on what text-to-video models render well, and why consistent post is still the reliable unifier.

## Modes and URL

| Mode | What it shows |
|---|---|
| **Watch (`W`)** | The graded, finished shot full frame, with the look's one-line note and the caption |
| **Inspect (`I`)** | The draggable before/after wipe, pipeline thumbnails, the selected node's notes and four scopes from a 160×90 readback of the finished frame about five times a second: waveform, RGB parade, vectorscope (with a skin-tone line and 75 % targets) and histogram |
| **Experiment (`E`)** | The four sliders, **Advanced** (Looks / Grade / Finish), **Deliver**, the optional compare wipe, and the **Show look · 3 shots** view |

URL parameters:
- **State:** `mode=watch|inspect|experiment`, `look=<preset id>`, `shot=doorway|alley|workshop`, `view=show`, `step=raw|match|look|override`, `wipe=0–1`.
- **Review:** `freeze=<s>`, `nomotion=1`.
- **Testing and capture:** `e2e=1` (test hook, low quality, lite characters) and `capture=plate|flipped` (installs the hook at full quality; `flipped` mirrors the key and rim lights, and is used only to make the "can't fix" still).
- Mode, view, shot, look and step are kept in the URL as you work.

**Keys:** `W` / `I` / `E` switch modes, `Space` plays and pauses, `C` toggles the wipe, `1` / `2` / `3` pick shots, `?` opens the field guide and `Esc` closes it.

Preset ids: `clean`, `k500t`, `eterna`, `reversal`, `bleach`, `teal-orange`, `promist`, `anamorphic`, `matrix`, `comic`, `painterly`.

## Architecture

- **`engine/`** is pure TypeScript, renderer-free, tested in `engine.test.ts`:
  - `color.ts`: sRGB transfer functions, luma, the zero-sum colour-wheel basis, three's ACES filmic fit and OKLab.
  - `grade.ts`: `GradeParams` → `resolveGrade` → `applyResolved`, the order of operations and the uniform packing (10 vec4 per layer).
  - `stocks.ts`: the four stock emulations.
  - `grain.ts`: a pcg3d hash that is bit-exact with the GLSL `uint` version, value noise, the luminance weighting and the frame seed.
  - `lut.ts`: sampling, `.cube` writing and parsing.
  - `scopes.ts`: waveform, parade, vectorscope, histogram and frame statistics.
  - `match.ts`: signatures, mismatch and auto-balance.
  - `showlook.ts`: the per-shot layer chain, residual drift, `.cube` and JSON export.
  - `look.ts`: finishing and stylize types, presets and the simple-slider mapping.
  - `prompt.ts`: the Seedance phrase and the AI note.
  - `shots.ts`: drifts, plate moments and the suggested override.
- **`runtime/shaders.ts`** holds the GLSL. Every colour operation mirrors an engine function, and the e2e spec checks GPU output against `applyChain` (mean error under 3/255).
- **`runtime/Orchestrator.tsx`** is the lab's **only positive-priority `useFrame`**. Each frame it:
  1. ticks the clock once and runs the scene updaters (on twos when the comic look asks for it);
  2. renders the live shot into a half-float, scene-linear, MSAA target;
  3. **develops** it (ACES filmic + sRGB, identical to the other labs' look) into the clean plate;
  4. runs `Pipeline.run`: grade (up to four layers) → stylize → halation, bloom and streak pyramids;
  5. runs `Pipeline.composite` into each DOM monitor (scissored). Thumbnails, the scope readback and test samples reuse the intermediates for one extra pass each, and the show view runs one pipeline per still.
- **`runtime/plates.ts`** loads the gallery stills from `public/labs/grading-finishing/plates/` as raw code values, plus 96×54 CPU copies for the metric. The stills come from `scripts/review/capture-gf-plates.mjs`, which captures the develop output of each scene at its `plateT`.
- **Test hook (`?e2e=1`):** `window.__gradingLab` can read state, apply looks and sliders, toggle nodes, step the show exercise, seek and pause, wait for frames, `sample()` any monitor's finished pixels, `engineGrade()`, `cube()`, `showDoc()` and `capturePlate()`. The root carries:
  - `data-mode`, `data-view`, `data-shot`, `data-look`;
  - `data-grain`, `data-temperature`, `data-contrast`, `data-bloom` (0–100);
  - `data-nodes` (the active nodes), `data-stylize`, `data-stepped`, `data-step`, `data-wipe`, `data-plates`, `data-mismatch`.
- **Review tooling:** `scripts/review/shots-grading.mjs` captures the key states into `docs/screenshots/grading-finishing/`, and `scripts/review/gf-peek.mjs` is a one-off page probe.

## What is approximate (not physically accurate)

- **Film stocks** are hand-tuned looks, not measured characteristic curves, dye densities or print-film models. The "inspired" labels mean exactly that.
- **Halation and bloom** are thresholded Gaussian glows on the display-referred picture, not a simulation of light in an emulsion or a filter. Halation is tinted red-orange and slightly held back inside the bright core.
- **Grain** is procedural noise shaped to read like grain: it clumps, is mostly luminance, is strongest in the mids and refreshes every frame. It does not model crystal size or dye clouds. Its size is in output pixels, so it is relatively larger on small monitors.
- **The grade works in display-referred code values**, which suits Rec.709 AI clips. It is not a scene-referred ACES/log pipeline: exposure and white balance linearise with the sRGB curve, and the `.cube` assumes Rec.709/sRGB in and out. Resolve's Rec.709 (gamma 2.4) timelines will differ very slightly in the linear-light operations.
- **Cross-shot drift** compares OKLab mean lightness, mean a/b, lightness spread and mean chroma of 96×54 copies. Each shot is compared with its own clean render passed through the same show look and override, so a perfect balance scores zero whatever the look, and an intentional override doesn't count as drift. **Auto-balance** matches to that clean reference. That is a best case: in production you balance to a grey card, a skin tone or a hero shot.
- **The comic and painterly treatments** are screen-space approximations. The Kuwahara filter is the basic four-sector kind, not anisotropic.

## Known limits

- The show exercise grades stills, not moving clips. Grain still animates on them, and the live shot is the moving example.
- The "can't fix" panel shows one failure (light direction). Character design, rendering style and lens differences are listed but not shown.
- The scopes read back a 160×90 frame. They show the shape well, but not fine detail.
- The painterly filter is the most expensive pass (up to 8 px radius, about 320 taps a pixel on HiDPI screens). Elliptical bokeh and anisotropic Kuwahara are not implemented.
- Plates must be recaptured (`node scripts/review/capture-gf-plates.mjs` with the dev server running) whenever the scenes, cast or `stage/shotCamera.ts` framing change.
