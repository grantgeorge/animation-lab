# Design decisions

The three dossiers in this folder were inputs written before implementation. Where they disagree with each other or with the code, this table records the winning value. Policy: numbers move from a dossier into code only through this file.

| Topic | Dossier value(s) | Implemented value | Why |
|---|---|---|---|
| Views | Two R3F canvases (art) · drei `View` (considered) | One canvas, one scene, orchestrated passes (`FrameOrchestrator`) | Same world and same time by identity; one shadow pass; thumbnails share the scene |
| Canonical camera | Orbit rig around the target anchor (rendering) | Position on the dolly rail + explicit zero-roll yaw/pitch (`CameraRig`) | Camera stays on the drawn rail at constant height for every target; one axis, one number |
| Default film camera | (0, 1.30, 0) art · (0, 1.45, 0) lessons | (−0.35, 1.47, 0), level, 50 mm, 3.0 m from Bram | On Bram's dolly axis at his framing-anchor height |
| Bram | 1.70 m "Bramble" (lessons) · 2.0 m part table (art) | Bram, 1.78 m; art part table scaled ×0.89 (eyes 1.55, cap top 1.81) | Landmarks agree with the framing box and the teaching configurations |
| Pip | 1.05 m, pronoun "she" in one dossier | Pip, 1.05 m (1.12 with hat), "he"; table ×0.905 | Consistency |
| Bram framing box | full body (lessons) | Head & shoulders y 1.08–1.86 m, anchor 1.47 m | Match mode is about the face; full-body fraction still drives shot size |
| Doorway | z −9 (lessons) · opening x 0.45–1.15 (art) | z −5.0, opening x 0.03–0.65, 2.1 m, arched | Complete in both 85 mm teaching shots with ≥ 5 cm margin |
| Door swing | Hinged right, opens toward camera | Hinged left, swings inward | Pip hides in the dark interior and walks out through the opening instead of through the wall |
| Pip hiding spot | (0.95, 0, −5.35) behind the solid flat | (0.42, 0, −5.5) inside the doorway | Same reason |
| Perspective class reference | doorway, thresholds 0.15 / 0.5 | back wall z −9, deep < 0.18, compressed > 0.45 | Default reads "natural"; Fixed-mode lens changes never change the class |
| Shot-size table | three different tables | One table on full-body fraction p: < 0.30 EWS, < 0.65 WS, < 1.15 FS, < 2.0 MS, < 3.5 MCU, < 7 CU | One source for chip, slider bands, prompt and export |
| Angle class | camera pitch | elevation of the line camera → target | Position-based, like perspective |
| Match solve | free secant | bracketed regula falsi with the re-aim folded in | Metric is monotonic along the rail (tested); never steps off the rail |
| Match reachability | "all presets reachable" | All presets for Bram; Pip ≈ 25–107 mm; Both ≈ 19–120 mm (from the default capture) | Rail geometry; tiles outside the band are hatched and the solve clamps with a hint |
| Both target | midpoint metric · 80 % fit on capture | Union of both framing boxes; capture records the current metric; anchor (0.185, 0.93, −3.85) | Switching target never moves the camera |
| Aim during Match travel | damped yaw/pitch | recomputed every frame with the exact zero-roll solve | No subject sway mid-travel |
| Next.js | `cacheComponents: true` | `cacheComponents: false`, `partialPrefetching: false`, `dynamicParams = false` | Activity would keep the WebGL lab alive while hidden; real 404s for concept labs |
| Canvas AA | `antialias: false` (art) | `antialias: true` | The shot pass renders directly to the canvas and needs AA |
| Post-processing | composer on stage (+ N8AO) | Not shipped in the MVP (emissive lamps + CSS vignette) | Out of time budget; listed in limitations |
| Fonts | Geist (lessons) | Instrument Sans + JetBrains Mono | Original identity, not the template, not Plane of Focus' Outfit / DM Mono |
| Env var | `FAL_KEY` | `FAL_API_KEY` (kept as scaffolded) | No fal usage shipped; set explicitly via `fal.config` if added |
| Keys | several conflicting maps | See the help modal: `?` help, `⇧U` hide UI, `V` swap, `⇧F` fullscreen shot | `?` and `⇧/` are the same chord |
| Hold timer | 400 ms / 1000 ms | 1000 ms, armed only after a user change | Initial exercise state never counts by itself |
| Thumbnails | 2D-canvas readback | 6 multisampled HalfFloat targets blitted into tile windows | No GPU readback; same tone mapping as the shot |
| Characters | procedural puppets only; generated characters "forbidden" | **Meshy 7.1 rigged GLBs** from GPT Image 2.5 Sunburst concept art (user request); procedural puppets kept as the loading fallback | The puppets read as primitives; the rigged models are driven by the same clip through bone mapping (`scene/characters/Characters.tsx`) |
| Bram landmarks | part-table values | measured on the Meshy mesh: nose tip y 1.567, 0.228 m ahead of the body axis; cap top 1.78 | Teaching-config expectations regenerated (24 mm matched nose/ear ≈ 1.36×) |
| fal spend | ≤ $10 for props | $4.00 total (2 concept calls, 2 Meshy rig runs), ledger in `scripts/characters/ledger.json` | User budget ≤ $100 |
| Lighting Studio close-up | Original studio camera at z 2.7 m | 50 mm at (0, 1.6, 1.9), target (0, 1.52, 0); default close shot | A dedicated viewer needs a face-led shot so learners can see the cheek, nose shadow and rim; all camera/scene numbers remain in the lab’s existing config |
| Lighting Studio film gate | Main viewport aspect changed with layout; preview and frustum were 16:9 | Fixed 16:9 camera projection fitted into the main viewer; preview and frustum match | Switching between camera and studio must not change the photographed composition |
| Lighting Studio meters | “Key : fill”, “lx at face”, percentage of all light | Estimated rig ratio and approximate per-light lux; no contribution percentage | The point-source estimate does not measure surface illumination or image contrast |
| Lighting Studio assets | New generated assets considered, ≤ $50 authorized | Existing rigged character and preserved material maps; six previews rendered locally; $0 spent in this pass | The improvement needed a clearer learning flow and viewer, not another generated model |
| Lens & Framing workspace | Studio-led view with floating controls | Camera-first 16:9 viewer, companion studio view, live six-lens comparison, one inspector | Start with the photographed result; reveal geometry and guides when useful |
| Lens comparison limits | Heavy diagonal hatching obscured unreachable Match previews | Amber “Rail limit” caption and explanatory tooltip; actual preview stays visible | Learners can compare the attainable framing while understanding the rail constraint |
| Bram retargeting | −38° / +41° upper-arm correction from the older model | −18° / +20°, shared by each arm's forearm and wrist frame | Current bind arms already sit 27° / 30° from vertical; leave coat clearance instead of folding hands into the lap |
| Lens & Framing assets | New Meshy rig considered, ≤ $50 authorized | Recalibrate the existing Meshy skeleton; $0 spent in this pass | The skeleton is intact; the obsolete animation mapping caused the pose defect |
| Bram forward wave | Overhead shoulder lift plus deep additive elbow bend; camera-side hand | Lower elbow, upright forearm, smaller wrist motion, smooth lift; Pip-side hand in Doorway and Alley | The resting pose and bind bend already contribute rotation; review the complete chain throughout the gesture and keep the face readable |

## Staging & Blocking: 3D revision

The first staging study used an SVG projection while Lens & Framing and Shot Coverage used the shared rigged cast, scene and camera. Replace that mismatch with the doorway set, Bram and Pip, and the doorway greeting with root movement removed. Floor marks stay authoritative throughout the gesture. Omit the foreground street lantern so it does not distract from actor-to-actor blocking.

The camera orbits a fixed staging centre at (0, 1, −3) m, radius 6.6 m and height 2.2 m, starting at 40 mm on a 36 mm gate. Its ±55° range lets the Hidden exercise separate the projected body bounds. The inspector starts at (6.5, 6.5, 5.5) m. Floor marks stay within x ±2.2 m and z −4.4 to −1.8 m, in front of the doorway wall. Approximate actor half-width is 0.32 m and the clearance warning starts below 0.65 m. These values live in `blockingConfig` in the existing lens config module.

Use the existing FrameOrchestrator with an optional render callback; do not add a positive-priority useFrame. One canvas draws the main view and the inset with scissoring. The inspector may orbit without changing the filmed camera. Project the same camera used for rendering to evaluate rest-body bounding boxes; feedback is a composition aid, not mesh-accurate visibility or collision detection. Silhouette mode changes actor materials only.

## Staging & Blocking: facing, focus and exercises

Blocking is taught through facing as well as position. The actors can face the camera, face each other, or "cheat open": a turn 45% of the way from the partner toward the lens, enough to read both faces while the two still play to each other. The readout's "face to camera" value is the cosine between body yaw and the direction to the lens (1 open, 0 profile). An actor counts as engaged with the partner within 70° of facing them. The distance zones follow Hall's proxemics (The Hidden Dimension, 1966): intimate below 0.45 m, personal below 1.2 m, social below 3.6 m, public beyond. The Set view sits at (8.2, 6.4, 5.2) m looking at (0.4, 0.6, −0.8) m, so the doorway and the filming camera share the frame. A Profile preset (Bram at x −0.8, Pip at x 0.8, both at z −3 m) sets up the upstaging and cheating exercises. Values live in `blockingConfig`.

## Animation Style: movement recipes

The Animation Style lab teaches movement style as a recipe of separate principles over one fixed beat. Pip stands at (1.0, 0, −4.35) m beside the doorway, filmed locked off from (0.75, 1.2, −0.15) m toward (1.05, 0.82, −4.35) m on a 40 mm lens (`styleConfig`). Cadence follows animation practice on a 24 fps timeline: ones, twos, threes and fours give 24, 12, 8 and 6 poses a second. Real time is held on the cadence before any other remapping, so the whole rig steps together. Pose holds spend up to 75% of each beat holding the previous key pose before moving. The presets are Naturalistic (ones, exaggeration 0.8), Cartoony (ones, 1.45, full squash), Limited (threes, holds 0.85), Snappy stepped (twos, holds 0.6) and Stop motion (twos, 4 mm per-pose wobble). They are teaching approximations of each idiom, not measurements of any production. Look swaps are derived materials local to the lab; finishing stays in Grading & Finishing and Painterly Textures.

## Character Design: proportions, cast measurements and readability tests

The Character Design lab builds every design to one total height, 1.5 m (`designConfig.heightM`), so proportions compare like with like. Head size is reported in heads tall. The bands are a drawing convention, not anthropometry:

- chibi: 2–3 heads
- cartoon: 3–4.5
- stylised: 4.5–6.5
- realistic: 6.5–8 (average adult about 7.5)
- heroic: 8–9

The "Realistic adult" preset uses 7.5 heads with the eyes on the half line of the head, and "Heroic" uses 8.5 heads.

"Like Pip" and "Like Bram" are measured from the cast. Total height is the measured crown: Pip 1.05 m, Bram 1.74 m. Head height, eye diameter, eye centres and eye height come from the procedural puppets (src/scene/characters/Pip.tsx and Bram.tsx), whose eyes sit on the measured eye landmarks (Pip 0.91 m):

| | Head | Eye diameter | Eye centres | Eyes above chin | Heads tall | Eye line | Gap |
|---|---|---|---|---|---|---|---|
| Pip | 0.298 m | 0.07 m | 0.10 m apart | 0.129 m | ≈ 3.5 | 43% | 0.43 eye-widths |
| Bram | 0.372 m | 0.08 m | 0.132 m apart | 0.149 m | ≈ 4.7 | 40% | 0.65 eye-widths |

Leg length is the puppets' pelvis height (0.43 m and 0.85 m). Their limb thickness and shape weights are design judgements, not measurements.

"Reads as" blends three baby-schema cues after Lorenz's Kindchenschema: head size for the body, eye size and a low eye line, weighted 0.45 / 0.30 / 0.25. The bands are rules of thumb and are labelled as such in the UI.

Silhouette numbers are measured on a 96×120 front-view mask with a fixed orthographic frame (−0.04 to 1.26 of the height). Negative space is 1 − area ÷ convex-hull area. "Unlike Pip" is 1 − IoU against Pip in the same pose. Exercise targets were set from measured values: negative space ≥ 35% (Pip neutral 22%, open 50%) and outline difference ≥ 30% (Bram vs Pip in neutral, 28%).

## 2D vs 3D: one move, three techniques

The 2D vs 3D lab defines Pip's "hooray hop" once, as a technique-neutral key-pose timeline (`src/labs/2d-vs-3d/move.ts`): feet height, knee bend, torso lean, head pitch, arm raise and swing, elbow, squash and face. All three panes sample it on one playhead. It lasts 2.5 s: 60 frames at 24 fps, so 30 drawings on twos. The beats are: crouch 0.40–0.62 s, take-off 0.70 s, apex 0.96 s (feet 0.32 m up), landing 1.24 s, squash 1.34 s (0.84), settle by 2.1 s.

- **Shared numbers** live in `twoDThreeDConfig` (lens-and-framing/config.ts):
  - Every pane frames 1.72 m of height, with the floor 0.16 m above the frame bottom.
  - The 3D camera orbits at 6 m with a vertical field of view that covers the same 1.72 m, so the 3D framing matches the near-orthographic 2D panes.
  - Rest arms hang 12° out, matching the shared Pip rig's arm offsets in Characters.tsx.
  - Legs are 0.36 m from hip to ankle (0.19 + 0.17), and a full crouch bends the knee 60°.
  - The hip drop, 0.36·(1 − cos θ), is the same in the 2D forward kinematics and in the 3D clip's root offset, so the feet stay planted in every technique.
- **3D** converts the timeline to an ordinary rig clip keyed every 1/48 s with linear interpolation, played on the shared `RiggedCharacter` with `PIP_BONES`. Squash scales a wrapper about the feet, as the drawn pane does.
  - The rig's own overlap smoothing makes the hands trail by up to 0.085 s. That is the "3D look" and is left in.
  - At extreme arm raises, the skinned shoulder shows less raise than the bone has. The Show rig toggle makes this visible.
- **Hand-drawn** re-projects the skeleton per drawing:
  - true foreshortening;
  - squash and stretch about the feet, with volume preserved;
  - bendy limbs;
  - a deterministic line boil of about 1 px per drawing;
  - a smear wherever a hand travels more than 70 px between two drawings (the arm swing at frames 16 to 18);
  - onion skins of the previous and next drawings.
- **Cut-out** uses rigid parts with fixed picture-plane lengths. Knees are placed by 2D two-bone IK, bending outward in front views and forward in side views, so a front-view crouch splays the knees. There is no squash, the head turns only in the picture plane, and the mouth swaps between three drawings.
  - The view library has three views: 0°, 45° and 90°. A requested angle more than 4° from a view snaps to the nearest one and is flagged.
- **Costs**:
  - Hand-drawn: drawings per loop (30 on twos) × distinct camera angles used.
  - Cut-out: 21 part drawings per view × 3 views = 63.
  - 3D: 0 drawings (one model, 24 joints, skin weights).
  - These are teaching counts for this loop, not production estimates.

## Character Rigging: turntable studio, rig-native IK and the three bind corrections

The Character Rigging lab poses the shipped GLBs directly instead of playing clips through `RiggedCharacter`. The numbers live in `riggingConfig` (lens-and-framing/config.ts).

- **Studio**: the character stands at the origin facing +Z on a dark floor disc, with fog fading the floor out. Camera positions are given for Bram (1.78 m, 35 mm) and scaled by height for Pip:
  - front (0, 1.05, 3.9)
  - three-quarter (2.5, 1.3, 3.0)
  - side (3.9, 1.05, 0.1)
  - all three aim at (0, 0.93, 0)
  - **arm** is a close-up that follows the left elbow, offset by (0.3, 0.08, 1.45).
- **Rest-aligned deltas**: the lab uses the same formula and bone maps as `RiggedCharacter`, imported as `BRAM_BONES` / `PIP_BONES`, so its rest pose matches the live characters. The formula is L = P0⁻¹·(F⁻¹·Δ·F)·O·P0·L0. Slider signs follow the clip conventions in `arms.ts`: positive is the natural direction.
- **IK uses only the rig's own joints**: it bends the hinge (elbow or knee) about its rx axis until the chain spans the target, swings the root joint (shoulder or hip) to aim it, then twists the root about the aim line toward the pole. The end joint keeps its world orientation.
  - Every rotation it writes can be reproduced by an FK slider, so switching a limb from IK to FK matches the pose exactly.
  - A swing-only solver bent the forearm off its hinge, and the match missed by about 5 cm.
- **Straight is the rig's rest bend**: hinge 0° is the bind pose's own elbow bend. The elbow readout is measured from that rest bend too, so the slider, the readout and an out-of-reach IK chain all agree on 0°.
- **Exercises**:
  - The reach mark sits at (0.25, 0.3, 0.6) arm lengths from the rest shoulder, 72% of full reach. Tolerance is 4 cm.
  - The squat needs 30% of leg length: 20 cm for Bram, 10 cm for Pip. Feet may sink at most 1.5 cm and slide at most 2 cm.
  - The elbow exercise needs the pole at 60° or more.
  - When a drag ends within 30 px of the mark, the target snaps onto it.
- **Bind corrections**: Bram's doorway-wave clip, or Pip's, plays in three modes:
  - none: no offset and no frame;
  - offset only;
  - shipped: offset plus hinge frame.
  
  In the first two modes a ghost of the shipped arms is drawn. The loop windows are 2.6–5.6 s for Bram and 2.6–4.6 s for Pip.
- **Skinning**:
  - Weights paint as a blue-to-red ramp on a per-instance vertex-colour attribute.
  - Rigid binding is a per-instance geometry copy whose four weights per vertex become one-hot on the strongest joint.
  - The cached GLTF geometry and materials are never modified.
