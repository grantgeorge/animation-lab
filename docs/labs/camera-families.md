# Cinema Camera Families lab

`/labs/camera-families`. One locked-off shot of the doorway (Bram and Pip, the lantern, the back wall), seen through fourteen camera families. The lab's thesis comes from the user's brief: **the camera body decides how the image is captured, but the lens, the light and the cinematography shape the look far more.** So the lab teaches the choices in the order a cinematographer makes them, not as ARRI vs RED vs Sony:

1. sensor format
2. focal length
3. aperture
4. movement and shutter
5. image rendering

A blind test and a copyable AI-video prompt close the loop.

## What it teaches

- **Sensor format (step 1).** Picking a camera card sets the gate the shot is rendered through.
  - **Same lens:** the focal length stays and the field of view follows the sensor width. A 32 mm lens is a normal lens on the ALEXA 35, and an 80° wide on the ALEXA 265.
  - **Same framing:** the focal length scales with the width ratio. Field of view, perspective and Bram's size stay identical (the camera never moves). An option also scales the T-stop so the depth of field stays the same.
  - **Equivalence table:** shows the current shot on Super 35, full frame, VV and 65 mm.
  - **Gate diagram:** draws every gate to scale (IMAX 15/70, 65 mm digital, 65 mm 5-perf, VV, LF, FF, S35 4.6K, S35 3-perf, 1-inch, action cam). It sits over a live render of what the current lens projects across a 76 × 56 mm area. Outside the selected gate the image is dimmed, and its 16:9 delivery frame is dashed. One lens projects one image, and each sensor crops it.
  - **Open gate:** an option shows the full gate at its native aspect.
- **Focal length (step 2).** A slider and six presets (the classic full-frame 18–135 mm fields of view, converted to the current format) show the true horizontal and vertical FOV for the current gate. A top-down wedge compares it with the same lens on full frame.
- **Aperture and depth of field (step 3).**
  - **Controls:** a T-stop slider (third stops) with full-stop presets, focus presets (lantern, Bram, Pip, back wall) and manual focus.
  - **Band diagram:** the near and far limits in metres, with the set marked and the blur-size curve.
  - **Shader blur:** the shot is blurred per pixel by the same thin-lens blur-disc formula. "Tint what's inside the depth of field" paints exactly the pixels whose blur is ≤ the CoC, so you can check that the picture and the diagram agree.
  - **Equivalence:** same framing and the same depth of field come out at Super 35 T2 ≈ full frame T2.8 ≈ 65 mm ≈ T4.
- **Movement and shutter (step 4).**
  - **Controls:** shutter angle (45 / 90 / 180 / 270 / 360°), frame rate (24 / 48 / 120 / 240 high-speed) and an option to play back at 24 fps as slow motion. The clock is held to the capture rate, so 24 fps shows 24 distinct images a second.
  - **Motion blur:** each frame averages N renders taken at sample times across the open shutter (a shutter-disc and timeline diagram shows them). The Fast pan move (±14°, peaking at 88°/s) makes the blur obvious.
  - **Rolling-shutter test:** rows are rendered in thin bands, each exposed later than the one above, so verticals lean on the pan. The V-RAPTOR [X] (global shutter) stays straight. Quick buttons compare it with the ALEXA 35.
  - **Frame-rate warning:** appears when the frame rate exceeds the selected camera's verified maximum.
- **Image rendering (step 5).**
  - **Looks:** eight presets, each a parametric characteristic curve (clip point, shoulder, toe, mid-grey contrast) plus white balance, crosstalk, split toning, saturation, grain or sensor noise, halation, bloom, sharpening, vignette and gate weave. They are labelled honestly as artistic approximations:
    - Neutral
    - Naturalistic digital cinema (ARRI-style)
    - Large-format epic
    - Clean high-resolution (RED-style)
    - Vintage 35 mm film
    - 65 mm film
    - High-speed action
    - Doc / run-and-gun
  - **Highlight test:** +2.5 EV pushes the lantern and the lit wall into the shoulder. Naturalistic rolls off; Doc clips flat.
  - **Curve plot:** shows the look against the neutral curve, with the clip point and the estimated lantern and window highlights marked.
- **Blind test.**
  - **Setup:** the same frame through three looks, with labels hidden. You assign each name once, then reveal and score.
  - **Rounds:** rounds 1, 3, 5… use three digital-cinema looks, the realistic case; the others draw from every family.
  - **Reveal:** the result reminds you that a change of lens or light moves the picture far more than any preset.
- **AI prompt.**
  - **What it builds:** one Seedance-style line built only from the controls, for example: "shot on large-format digital, 35 mm lens (31 mm full-frame equivalent) at T2, shallow depth of field, background softly out of focus, 180° shutter, natural motion blur, soft highlight roll-off, naturalistic color and skin tones".
  - **No brands:** the line never names one (a unit test checks this). The note under it says why: describing what the camera does beats naming the camera.

## Modes and links

- **Watch (`W`):** the graded shot, full frame, plus the prompt.
- **Inspect (`I`):** a stage view with the camera body, the live frustum, the focus plane (amber) and the depth-of-field slab (cyan), with the graded shot as a PIP. Below it sit the gate diagram, the DoF band and the response curve, and every number appears in the side panel.
- **Experiment (`E`):** the five steps plus the blind test, with the camera-family strip and the prompt.
- **Deep links:**
  - `?mode=watch|inspect|experiment`
  - `?camera=<id>`, where the id is one of alexa35, alexa265, venice2, vraptorx, ursacine12k, c400, film35, film65, phantom, gopro, inspire3, fx6, insta360pro2 or probe. A deep-linked camera opens on the default framing.
  - `?step=sensor|focal|aperture|shutter|response|blind`, or 1–5.
  - The address bar follows mode, step and camera changes (`replaceState`).
- **Keys:**
  - `1`–`5` steps
  - `B` blind test
  - `F` same lens ↔ same framing
  - `Space` play/pause
  - `,` `.` step one frame
  - `?` field guide
- **Test hooks (`?e2e=1`):** `window.__cameraFamilies` exposes:
  - `getState()`
  - `derived()`
  - `live()`: frame id, renders, samples, bands, sample span, FOV, focal, Bram's measured size, max blur px, rolling flag and look ids
  - `frames(n)`

  The lab root carries these data attributes:
  - `data-mode`, `data-step`, `data-camera`, `data-format`, `data-framing`
  - `data-focal`, `data-tstop`, `data-focus`, `data-shutter`, `data-fps`, `data-move`, `data-look`
  - `data-hfov`, `data-blind-revealed`

## Architecture

- **`engine/`** is pure TypeScript (three math classes only), covered by Vitest in `engine.test.ts`.
  - `formats.ts`: gates in mm, the 16:9 extraction, the width-based crop factor, and the CoC as frame width ÷ 1200.
  - `optics.ts`: FOV, equivalent focal and stop, thin-lens near/far/hyperfocal, the blur disc, and DoF classes.
  - `shutter.ts`: exposure, sample times, frame hold, slow-motion speed, rolling-shutter row offsets, and the pan.
  - `looks.ts`: the curve. `curveValue` is exactly what the GLSL evaluates.
  - `shot.ts`: the fixed camera, the set marks, depth along the axis, and Bram's projected size.
  - `prompt.ts`, `blind.ts`, `derive.ts`, and `cameras.ts` (the catalogue).
- **`runtime/Orchestrator.tsx`** is the lab's only positive-priority `useFrame`. Each frame it:
  1. ticks the clock and holds it to the capture frame;
  2. poses the world at that frame and renders the gate projection and the stage directly;
  3. renders N jittered sub-frame samples (HalfFloat, linear HDR) across the open shutter, centre sample first so its depth texture feeds the DoF; with the rolling test, each row band is offset by the readout;
  4. averages the samples additively;
  5. runs the depth-of-field pass;
  6. grades into each output window with its look.

  The sample budget is 16 at high quality and 4 under `?e2e=1` / low quality. GPU resources are module-level (one canvas per page).
- **`runtime/shaders.ts`:** the accumulate, DoF (scatter-as-gather bokeh after Gustafsson, radius from the thin-lens blur disc) and look passes.
- **`stage/RigViz.tsx`:** the frustum and DoF planes on the tech layer (Inspect only).
- **Shared code:** reused unchanged (`SceneSet`, `Bram`, `Pip`, `StageLighting`, `frameBus`, `quality`, `MasterClock`, `setActiveScene`). No shared files were edited.

## Spec sources

Checked in November 2026. Each card shows its sources and a verification flag. DR is always labelled manufacturer-claimed.

| Camera | Key figures | Source |
|---|---|---|
| ARRI ALEXA 35 Xtreme | 27.99 × 19.22 mm, 4608 × 3164, 17 stops, 120 fps at 4.6K Open Gate. 660 fps only in 2K/HD S16 Sensor Overdrive, where DR drops to 11 stops | arri.com ALEXA 35 Xtreme and ALEXA 35 pages |
| ARRI ALEXA 265 | 54.12 × 25.58 mm, 6560 × 3100, 15 stops, 60 fps | arrirental.com ALEXA 265 |
| Sony VENICE 2 | 8.6K: 35.9 × 24.0 mm, 8640 × 5760, 16 stops, dual ISO 800/3200, 120 fps at 5.5K S35. 6K: 6048 × 4032, 15+ stops | Sony VENICE 2 recording-formats PDF (Apr 2023); sony-cinematography.com |
| RED V-RAPTOR [X] 8K VV | 40.96 × 21.60 mm, 8192 × 4320, 17+ stops, global shutter, 120 fps at 8K, 600 fps at 2K | docs.red.com tech specs; RED compare CSV |
| Blackmagic URSA Cine 12K LF | 35.64 × 23.32 mm, 12,288 × 8040, 16 stops, 80 fps at 12K open gate | blackmagicdesign.com tech specs |
| Canon EOS C400 | Full frame, RAW 6000 × 4000, 16 stops (Canon Log 2), triple base ISO, 60 fps at 6K. **Sensor mm not published** | canon.jp C400 specifications |
| 35 mm film | S35 3-perf 24.89 × 13.87 mm, 4-perf 24.89 × 18.66 mm (Kodak rounds to 24.90 × 13.90 / 18.70) | Kodak film format infographic; ASC conventional values |
| 65 mm / IMAX film | 5-perf 52.48 × 23.01 mm (Kodak 52.15), IMAX 15/70 70.41 × 51.61 mm | Kodak infographic; SMPTE ST 417 |
| Phantom Flex4K | 27.6 × 15.5 mm, 4096 × 2304, 938 fps at 4K, ~1,970 fps at 2K, rolling (GS variant adds global) | phantomhighspeed.com product page and datasheet (read via search: direct fetch blocked) |
| GoPro HERO13 Black | 27 MP 8:7, 5.3K60 / 4K120 / 1080p240, no DR claim, 1/1.9″ per retailers. MISSION 1 Pro (2026): 1-inch, 8K60, up to 14 stops claimed | B&H HERO13 page; gopro.com MISSION 1 Pro |
| DJI Inspire 3 + X9-8K Air | "35mm full-frame", 8192 × 4320, 14+ stops, 8K 75 fps ProRes RAW 2.4:1. **Sensor mm not published** | dji.com Inspire 3 specs and FAQ |
| Sony FX6 | Full frame 10.2 MP effective, 15+ stops, UHD 120 fps, FHD 240 fps. **Sensor mm not verified** | Sony launch material via FDTimes (Sony site blocked) |
| Insta360 Pro 2 | Six 200° F2.4 fisheyes, 8K 3D 30 fps / 8K 2D 60 fps / 4K 120 fps, 1/2.3″ per retailer | Insta360 Pro 2 online manual |
| Laowa 24mm f/14 2× Macro Probe | 24 mm, f/14, 2×, covers FF and S35, 408 mm long | venuslens.net product page |

Reference gates: 1-inch type 13.2 × 8.8 mm (nominal), ARRI LF open gate 36.70 × 25.54 mm (arri.com ALEXA Mini LF), RED VV 40.96 × 21.60 mm.

## What is approximate

- **Looks:** every look is an artistic approximation written for this lab, not any manufacturer's colour science. The UI says so on the response panel and in the blind test.
- **Nominal gates:** C400, Inspire 3 X9 and FX6 are drawn as nominal 36 × 24 mm full frame because their active areas could not be verified. The action-cam and 360 gates are nominal "type" sizes (1/1.9″, 1/2.3″).
- **Crop factor:** a width ratio (we match horizontal FOV and deliver 16:9 across the full width), so it differs slightly from diagonal crop factors quoted elsewhere.
- **Depth of field:**
  - It uses the thin-lens model with the T-stop standing in for the f-number. Real lenses' f-numbers are a fraction of a stop lower, and focus breathing, pupil magnification and lens character are ignored.
  - The CoC is frame width ÷ 1200 (FF 0.030 mm, S35 0.021 mm), so equivalence holds to within 0.5 %.
  - The rendered blur is capped at a 24 px radius at render resolution.
  - The DoF uses the centre sample's depth, so fast-moving edges blur slightly inconsistently with motion blur.
- **Exposure:** brightness is held constant across T-stop and shutter changes, as if ND or ISO compensate.
- **Rolling shutter:** the readout time is an illustrative 20 ms (not a manufacturer figure), and the shutter types of cameras that don't state one are modelled as rolling. Film's rotary shutter is treated as global.
- **Highlights:** the lantern and window positions on the curve plot are estimated from the emissive materials (about +2.5, +3.2 and +4.1 stops in red).
- **Frame rate:** above about 60 fps native playback can't show more than the display refresh, so high frame rates are best seen in slow-motion playback.

## Known limits

- **Motion blur:**
  - It is sampled, so a 360° shutter on the fast pan can show faint ghost steps at low sample counts (`?e2e=1` uses 4 samples).
  - The rolling-shutter bands trade blur samples for row resolution: one sample per band at ≤ 90°.
- **Gate diagram:** assumes the lens covers every format. Real S35 lenses vignette on 65 mm.
- **360/VR:** the 360 rig is rendered as one flat lens view, not a stitched sphere.
- **Probe lens:** only the focal length and stop (24 mm T14) are applied, not its optical character.
- **Shallow set:** the doorway set is shallow (Bram ≈ 4.5 m, Pip ≈ 6 m, back wall ≈ 10.5 m, with a mostly plain wall), so background bokeh is modest except on long lenses at wide stops. A deeper set with background practicals would show it better, but the scene is shared and was left unchanged.
- **Scene and cost:** the lab only shoots the doorway scene. It renders 4–28 scene passes per frame and needs a discrete or Apple-silicon GPU for smooth playback at high quality.

## Review

One Gemini review pass (fal `openrouter/router/vision`, about $0.05, logged in `scripts/characters/ledger.json`) used the brief `scripts/review/camera-families-brief.txt`. Fixes applied from it:
- the 16:9 and open-gate sizes are labelled;
- the crop factor says "larger than FF" when it is below 1;
- the DoF words step to "shallow" sooner;
- a plumb line appears during the rolling-shutter test;
- the look chip says "(your pick)" when it differs from the camera's suggestion;
- the Inspect PIP is labelled and the stage camera body is lighter.

The review also called "ALEXA 35 Xtreme" fictional. That's wrong: arri.com lists it.

## Screenshots

`docs/screenshots/camera-families/` (1440 × 900), produced by `node scripts/review/shots-camera-families.mjs` against the dev server.
