# Timing & Spacing lab

Route: `/labs/timing-and-spacing` · code: `src/labs/timing-and-spacing/` · e2e: `e2e/40-timing-and-spacing.spec.ts` · screenshots: `docs/screenshots/timing-and-spacing/` (regenerate with `node scripts/shots-timing.mjs [outDir] [WxH]` against a running dev server, default `:3123`).

The refined workspace is captured at 1440×900, 1280×800, and 390×844 in `docs/screenshots/timing-refined/`; regenerate with `node scripts/shots-timing-refined.mjs`. The script covers all four comparisons, the phone graphs, the inspector, and expanded controls, and records browser errors and horizontal overflow in `review.json`.

## Workspace

The bounce leads the page, with play, frame step, scrubbing, speed, loop, and On 2s directly below it. The trajectory and timing curve stay synchronized beneath a short study note. The quiet inspector shows weight, airtime, height, and squash first; anticipation, bounce/contact, and follow-through open on demand. Selecting the anticipation comparison opens its controls and explains the locked values. Motion notes remain available to copy below the graphs.

The layout uses the same neutral surfaces and restrained amber accents as Lighting and Lens & Framing. On phones the comparison choices form a compact grid, the graphs stack, and the inspector follows in the page scroll. Normal autoplay and reduced-motion behavior are unchanged. The playhead is a native range control with arrow keys, Home, and End; focused controls retain their own keyboard behavior.

## What it teaches

A small bean creature (big eyes, brows, antenna, tiny feet) jumps and bounces across a stage. You change its motion curve, timing, weight, squash & stretch, anticipation and follow-through, and see why the same jump can feel robotic or organic, heavy or light, readable or missed. Every comparison ends with a note on what to look for in AI-generated motion, and the lab writes a deterministic **motion prompt phrase** for the current settings.

- **Timing**: how many frames an action takes (airtime, contact frames, windup frames).
- **Spacing**: how far the body moves between frames. The trajectory draws one dot per frame, so spacing is visible: dots bunch up where the body is slow and spread out where it is fast.

## The three synchronized views

All three share one playhead (the master clock in `store.ts`, reusing `src/engine/timeline/clock.ts`). The display holds whole frames at 24 fps; nothing is interpolated between frames.

1. **Stage** (one R3F `<Canvas>`, `frameloop="demand"`, default-priority `useFrame` only). Soft key, pale rim, neutral warm wash on a cyclorama; a contact shadow that widens and fades with height; floor rings mark each contact. In compare mode the two variants play in side-by-side lanes labelled A (amber) and B (muted blue).
2. **Trajectory** (SVG). Side view of the arc with a dot per drawn frame. Contacts are mint, the current frame is ringed and its squash/stretch silhouette drawn. **Ghosts** adds an onion skin (silhouettes at half scale so frames don't pile up). Click or drag to jump to the nearest frame. In compare mode A and B are stacked on one shared scale.
3. **Timing curve** (SVG graph editor). Height over time for the whole performance, with frame ticks (every frame, bigger every 6, labelled every 12 or 24), keys at every apex and contact, and the anticipation window shaded. Below it a **S&S channel** plots the stretch value per frame. Interactions:
   - drag the four round **tangent handles** (rise and fall of the first arc). The curves are shared by every arc, so the whole performance updates live;
   - **Linked** (default): the fall stays the time-mirror of the rise; unlink to make them asymmetric;
   - drag the diamond **apex key**: up/down sets the jump height, left/right sets the airtime;
   - drag the background to scrub;
   - presets: Linear, Ease in, Ease out, Ease in-out, Gravity. A preset describes the rise; the fall mirrors it.

Transport: play/pause, frame step, F-number/time readout, scrubber with a tick per frame (contacts and the windup marked), ¼×/½×/1× speed, loop, **On 2s** (12 drawings per second; impact frames are always drawn).

## Controls

Weight presets (Bowling ball, Rubber ball, Beach ball, Balloon), first-hop airtime (frames), jump height, an **implied gravity** readout, squash & stretch amount, anticipation depth and windup frames, bounciness (restitution), rebound timing (**Shorter each bounce** or **Same duration**), frames on the floor, and antenna follow-through. Editing a value a weight preset sets detaches the preset (shown as Custom, and the prompt describes the numbers instead of naming the object).

Keys: Space play/pause · `,` `.` frame step · Home frame 0 · 1–4 lessons · C compare on/off · ? help · Esc close.

## The four comparisons

Each is one click (tab or key 1–4). Both sides use the current free-play settings except for the variable being taught. That variable's controls are locked and show both values (A · B). Both timelines are padded to the same length and share the playhead.

| # | A vs B | What changes | Look for in AI-generated motion |
|---|--------|--------------|---------------------------------|
| 1 | Linear vs eased (gravity) | Rise/fall curves | Even spacing and V-shaped turnarounds read robotic. A real body hangs at the top and speeds into the ground. Slowing just before landing reads as cushioned. |
| 2 | Heavy (bowling ball) vs light (beach ball) | Height, airtime, restitution, contact frames, drift, squash | These stylized presets suggest weight with a bundle of animation choices. Without air resistance, mass alone does not change the rate of falling. |
| 3 | No windup vs anticipation | Crouch depth and windup frames (takeoffs aligned to the same frame) | Preparation before big actions. Generated characters often start moving instantly, which reads weightless. |
| 4 | Rigid vs exaggerated squash & stretch | Squash amount (ghosts turn on) | Deformation on impact and stretch at speed, with constant volume. Shrinking/swelling, or rubber in realistic footage, reads wrong. |

## Physics model (`engine/`)

All motion math is renderer-free TypeScript with Vitest tests next to it (`*.test.ts`).

- **Timing curves** (`bezier.ts`): CSS-style cubic beziers with x-handles clamped to [0, 1], inverted by Newton iteration with a bisection fallback. `gravity` is an exact parabola: rise `1 − (1 − u)²` is the quadratic bezier with control (½, 1), elevated to cubic `(⅓, ⅔, ⅔, 1)`. The fall is its point reflection `(⅓, 0, ⅔, ⅓)` = `u²`.
- **Bounce generation** (`timeline.ts`): idle → anticipation → jump → (contact → rebound)* → settle → hold. Restitution `e` scales each rebound's height by `e²` and airtime by `e`, so peak ∝ (time to peak)². Arcs stop below 6 cm or at the bounce cap. All arc lengths are integer frames split into rise/fall, so every apex and every contact lands on a drawn frame. Horizontal speed is constant in flight (0.072 units/frame), multiplied by `drift` at each contact, capped to the lane, and centred.
- **Implied gravity** (`params.ts`): `g = 8h / T²` for apex height `h` and airtime `T`, as a multiple of real gravity for a character 0.5 m tall (1 unit = 0.5 m). Rubber ball ≈ 1.0 g, bowling ball ≈ 1.8 g (cartoon snap), beach ball ≈ 0.5 g, balloon ≈ 0.2 g. Presets cheat airtime instead of simulating drag.
- **Squash & stretch** (`squash.ts`): volume-preserving deformation along any picture-plane axis, `M = g·I + (s − g)·a·aᵀ` with depth scale `g = 1/√s`, so `det = 1`. In flight the body stretches along its velocity, scaled by speed per frame. Impact frames squash in proportion to impact speed. The body's lowest point follows the height curve, so a squash happens from the feet and a stretch never goes through the floor.
- **Anticipation** (`pose.ts`): crouch over the first 70 % of the windup, then a held, slightly deeper crouch, a lean back, a squint and brows knitted. Then the takeoff frame stretches.
- **Follow-through** (`followThrough.ts`): the antenna is a damped angular spring driven by the body's velocity changes, integrated at 10 sub-steps per frame from rest. It is deterministic and settles before the loop seam.
- **Face**: pupils look along the velocity (down before each impact), eyelids blink on impact frames, and the mouth opens on fast falls.
- **Prompt phrase** (`prompt.ts`): weight noun + timing, curve character (from the slopes at the apex and the contact), rebound count/kind, squash, anticipation, and extras (follow-through, on twos). The same settings always give the same words.

## Test hook

With `?e2e=1`, `window.__timingLab` exposes `getState()`, `frames(variantIndex)`, `setParams(partial)`, `setComparison(id | null)`, `seek(frame)`, `pause()`, `play()`. The root mirrors `data-comparison`, `data-frame`, `data-playing`, `data-total-frames`, `data-curve`, `data-weight`, `data-on-twos`, `data-nomotion`.

Reduced motion: no autoplay. The lab parks on the first apex and shows a **Play the bounce** button; UI animations are off.

## Limitations

- One shared pair of rise/fall curves for every arc. Per-bounce curves and editing the contact/settle shape are not supported.
- Handles edit the first arc of the last variant (B in compare mode). Curves are locked in the Linear vs eased lesson.
- Height is the only animated curve. Horizontal motion is linear in flight (physically correct without drag), so there is no editable x-curve.
- No air drag or terminal velocity. Light objects are modelled by cheating airtime, as animators do.
- The stage camera is fixed and side-on. It re-frames only if an arc goes above the presets' range.
- Squash/stretch is applied as one affine deformation of the whole body (eyes and feet deform with it). There are no smear frames beyond stretch.
