# VFX & Simulation lab

`/labs/vfx-simulation`. Pip kicks over a bucket of water, and the same beat plays three ways: a realistic particle fluid, an authored cartoon 3D splash and hand-drawn 2D effects. The lab measures how long each splash reads as a shape. That number carries the lesson: physical accuracy is not artistic quality.

The user asked the lab to focus on animation, so it is about how effects are *animated* and how they act with the character, not about rendering technology. It covers:
- anticipation, timing, spacing, holds and follow-through in a splash;
- drawing on ones, twos or threes;
- 2D effects conventions (teardrop crowns, dotted drops, impact frames, smears);
- simulated versus keyframed motion;
- the coupling between Pip's flinch and the splash.

## What it teaches

1. **One bucket, three treatments** (the signature experiment).
   - **Realistic:** at true physical speed, a correct sim reads as noise. Its silhouette is different on every frame, so the eye sees motion rather than a splash.
   - **Cartoon 3D:** the crown pops up and holds in a *moving* hold, so it reads at a glance.
   - **Hand-drawn 2D:** pure convention, held on twos.
2. **Effects and acting sell each other.** In the *In sync* tab, Pip's flinch can be moved against the splash. Too early reads as a premonition, too late as two separate events. In both cases neither the water nor the flinch feels like it had weight.
3. **Six categories, simulated versus keyed.** Fire and smoke, water, rigid bodies, cloth, particles and magic, and hand-drawn effects. Each has a realistic/stylized look toggle, a simulated/keyframed motion toggle, one dial and a side-by-side split.

## The bucket beat (all metres; floor at y = 0, camera looking down −Z)

- **Pip** stands at (−0.8, 0, −0.14), yaw 72°.
- **The bucket** is galvanised: r 0.115–0.15, 0.27 tall, centred at x = −0.36.
- **The kick** lands at 0.82 s.
- **Pip's performance is generated from the beat** (`engine/pipClip.ts`). Each gesture is its own additive DSL layer that starts and ends at 0, so an early or late flinch can overlap the kick without breaking the curves. The layers are:
  - a wind-up and a kick (thigh +26° to −58°);
  - a 2-frame crouch, then a hop back with the arms flung up, landing on the treatment's splash;
  - the startled pose, held as long as the crown holds in the stylized treatments;
  - a sheepish settle.
- **The bucket is the same keyed prop in every treatment.** Only its timing changes:
  - realistic: tips with a 1/√g fall;
  - stylized: a squash on contact, a rear-back for the anticipation frames, a whip over and a bounce.
- **One Pip per view.** Each of the three Pips gets the clip for its view. Pip 2 is cel-shaded (toon ramp, inverted-hull ink outline on the skinned mesh) for the hand-drawn view.

### Realistic: a lightweight particle fluid (`engine/fluid.ts`)

- **Solver:** double-density relaxation (Clavet, Beaudoin & Poulin 2005). Each particle pushes or pulls its neighbours toward a rest density, a near-density term stops clumping, and pairwise viscosity impulses damp approaching neighbours.
- **Neighbours:** a 2¹⁵-bucket spatial hash with a counting sort and de-duplicated buckets.
- **Timestep:** fixed at 1/120 s; randomness is seeded (mulberry32).
- **Emitter:** water leaves the bucket in order (top and forward first) as the tipping angle passes 16°–95°. Each particle starts at its bucket-local position transformed with the keyed bucket, and leaves with the bucket's rigid velocity plus an outflow along the mouth axis.
- **The floor:**
  - kinetic friction rises with viscosity;
  - a hard hit (normal speed above 0.9 m/s) throws a seeded spray back up, weaker for viscous liquids;
  - this gives a sheet, drips, spray and a spreading puddle.
- **Bake:** every 1/60 s of sim time is recorded, a few milliseconds per frame, so the UI never freezes (2,400 droplets take about 1.2–1.3 s). Playback, scrubbing and screenshots interpolate the cache.
- **Counts:** capped at 4,800 (high), 1,200 (low) and 600 (`?e2e=1`).
- **Rendering:**
  - instanced icosahedra, drawn at 1.55× the solver radius so neighbours merge into one glossy mass;
  - only fast spray streaks along its velocity;
  - droplets resting on the floor shrink into a puddle sheet, whose alpha map is splatted from grounded particles and blurred.
- **Timing controls:**
  - *Stylization* is an art-directed retime: a raised-cosine slowdown around the impact, down to 32% speed.
  - *Hold* is a freeze frame.
  - On twos/threes steps the whole picture.

### Cartoon 3D: authored, nothing simulated (`engine/cartoon.ts`)

- **Gather:** a squashed dome swells over the lip while the bucket rears back (the anticipation).
- **Flight:** three overlapping blobs taper into one tongue on a drawn Bézier arc, eased in as if gravity pulled them. They stretch with speed, with volume preserved.
- **Contact:** a one-frame pancake squash.
- **Crown:** a lathed cup with a thick rim and asymmetric spikes, an authored height table plus turbulence wobble. It overshoots on the way up (`easeOutBack`) and teardrops sit on its tips.
- **Moving hold:** during the hold, height and flare drift 5–8% instead of freezing.
- **Release:** the drops snap off on authored parabolas, squash on landing and become satellite blots. The crown falls in over 5 frames.
- **Puddle:** a wobbly disc on a spring curve, overshooting past its rest radius and settling. A white ring runs out at the end.
- **Look:** a toon ramp, a deep-blue outline (not black, so it sits with the un-outlined 3D set) and glint ovals.
- **The controls:**
  - gravity scales arc durations by 1/√g;
  - viscosity slows the rise, rounds the shapes and removes drops;
  - stylization sets crown height, squash and stretch, and fewer, bigger drops.

### Hand-drawn 2D: drawings (`engine/drawn.ts`)

- **Two canvases:**
  - flat fills with an ink line on a vertical card just in front of the bucket (card space is world x, y on the plane z = 0.24; points are projected through the camera);
  - a floor decal for the puddle and its ripple ring.
- **The drawings, in order:**
  - a gather dome;
  - one bold teardrop with speed lines in flight;
  - **one impact frame on ones**, even when the drawings are on twos: the picture drops to white silhouettes on ink, with a splat and radiating streaks;
  - a breakdown;
  - the key splash pose, held: teardrop spikes bent on C-curves (lines of action), dotted drops past each tip, sparkles and impact dashes;
  - spikes retracting while teardrop drops fly out and land as little splats;
  - twinkles on threes, then still.
- **Line boil:** every new drawing re-seeds a vertex jitter (the turbulence dial).
- **Pip's stepping:** Pip steps with the drawings by default. The *Pip steps with the drawings* toggle keeps him on ones, which is the hybrid 2D-over-3D choice.

## Legibility, measured (`engine/legibility.ts`, `engine/measure.ts`)

Every frame of the 96-frame loop, the airborne splash (not the puddle) is rasterised into a side-on occupancy grid: 2.5 cm cells over x −0.5…1.3, y 0.035…1.035. The inputs per treatment are:
- realistic: particle cells;
- cartoon: blob ellipses plus the crown silhouette;
- hand-drawn: the card's filled polygons, back-projected to the splash depth.

A frame is **legible** when all three of these hold:
- the silhouette covers at least 24 cells;
- at least 60% of it is one shape (pieces less than 5 cm apart are grouped by a one-cell dilation, because the eye reads a crown and its dotted drops as one splash);
- its intersection-over-union with the previous frame is at least 0.5 (a shape that changes on every frame is noise).

The headline number is the **longest run of consecutive legible frames**. Inspect also shows:
- total legible frames;
- the first readable frame after the impact;
- pieces at the peak;
- peak height;
- a splash-height curve per treatment (keyed vs simulated).

Measured at the defaults (high tier, 2,400 droplets, 24 fps):

| Treatment / setting | Longest legible run | Legible frames |
|---|---|---|
| Realistic, true speed | 2 f (0.08 s), none after the impact | 2 |
| Realistic, retime to 32% (stylization 1) | 2 f | 2 |
| Realistic, retime + 0.5 g | **6 f (0.25 s)** | 10 |
| Realistic, 8-frame freeze hold | 7 f | 9 |
| Cartoon, 7-frame hold (default) | **13 f (0.54 s)** | 17 |
| Cartoon, no hold | 6 f | 10 |
| Cartoon, 16-frame hold | 22 f | 26 |
| Hand-drawn on twos, 8-frame hold (default) | **9 f (0.38 s)** | 16 |
| Hand-drawn on threes | 11 f | 18 |
| Hand-drawn, no hold | 3 f | 8 |

What the table says:
- **Slowing a sim down is not the same as making it readable.** The retime alone buys nothing here; lower gravity plus the retime triples the run.
- **A freeze makes it readable but dead.**
- **The hold is the single biggest lever** on the stylized treatments.

At `?e2e=1` (600 droplets) the realistic run is 0. The metric depends on particle density: sparser particles make a less solid silhouette.

## In sync

- **Two cartoon takes.**
  - Left: Pip flinches 2 frames after the water lands, the shared sync constant.
  - Right: the flinch lag you choose, from −10 to +14 frames.
- **The chart:**
  - the frame ticks;
  - the splash band (lands → crown holds);
  - each take's keyed "thrown back" curve, sampled from the generated clips (torso lean plus hop).
- **The reading** classifies the lag as early (< 0), tight (0–3), late (4–7) or disconnected (> 7), and names what each reads as.

## The six categories (`engine/fx/*`, `runtime/demos.ts`)

Each category is its own three.js scene rendered through the same orchestrator. Every simulated sim is either baked per setting or a closed-form function of (seed, age) with lives that divide the 4 s loop, so scrubbing is exact.

| Category | Simulated | Keyframed | Stylized look |
|---|---|---|---|
| Fire & smoke | Particles with buoyancy, turbulence, cooling ramp and smoke; additive sprites | An 8-drawing flame cycle on twos (authored sway/height table, detached licks) and authored smoke puffs | Posterised 3-band sprites with an ink rim, or flat flame tongues |
| Water | A 64² height-field wave equation, plus seeded ballistic drops that start their own rings | Evenly timed rings that ease out and fade, and authored teardrop arcs on twos | A toon pond with white rings, traced from the sim's wave speed and drop landings, or keyed |
| Rigid bodies | 2D Verlet crates: 4 corners and 6 constraints each, separating-axis contacts with friction, a heavy ball | Authored arcs, a squash on landing, one bounce, a composed arrangement (two crates restacked) | Toon crates with outlines and dust puffs |
| Cloth | Verlet cloth (structural, shear and bend), pinned to the keyed stick, wind and gusts | Successive breaking of joints: each column shows the root's pose from up to 0.2 s earlier, with droop and a travelling ripple | A toon flag with a painted ink border |
| Particles & magic | Sparks leave the keyed wand tip with its speed, drag to a stop and drift; wandering fireflies | Hand-placed sparkles pop on as the tip passes (scale 1.35 → 1), twinkle on twos and shrink out | Four-point ink stars |
| Hand-drawn FX | Constant-speed throw, restitution bounces, motion blur (180° shutter, 6 samples), brick chips | Anticipation, a 2–4 frame throw with a smear and multiples, a 1-frame impact flash, a 4-frame held squash, an overshoot | Smear, multiples, speed lines, impact star |

## Architecture

- `engine/` is pure TypeScript with no three.js, covered by Vitest (`engine/engine.test.ts`, 22 tests):
  - sim determinism and particle conservation;
  - gravity (first contact) and viscosity (reach, spray height) having monotonic effects;
  - the on-twos/threes and peak-hold helpers;
  - the moving hold, the one-frame impact frame, legibility ordering and the hold → run monotonicity;
  - the generated clip;
  - deterministic prompt phrases and readings;
  - category sim determinism.
- `runtime/Orchestrator.tsx` holds the lab's one positive-priority `useFrame`. Per frame it:
  - ticks the clock;
  - advances the realistic bake a few milliseconds;
  - refreshes the measurements when settings or the bake change;
  - then, for every visible view, poses the right Pip at that view's time (`runUpdaters`), poses the stage or demo, and renders into the view's DOM rectangle, scissored on one canvas.
- `runtime/bucketStage.ts` builds the set and every treatment's objects imperatively once; `show()` configures them per view.
- The UI is in `ui/` (Chrome, Controls, Panels), the copy in `content.ts`, and the state in `store.ts`. Every state is a deep link: `?exp ?tr ?compare ?g ?visc ?int ?count ?turb ?styl ?step ?hold ?antic ?offset ?look ?motion ?v ?split ?t`.
- The **test hook** `window.__vfxLab` is active under `?e2e=1` or `?debug=1`. It offers:
  - `getState`, `set`, `live`, `frames`, `seek`, `play` and `pause`;
  - `bake()`, which finishes the realistic bake now and re-measures;
  - `measures()` and `prompts()`.
- **Watch / Inspect / Experiment:**
  - Watch: the picture, the lesson, the measured strip and the prompt.
  - Inspect:
    - velocity vectors;
    - the keyed blob paths;
    - the legibility raster (green when the frame is legible);
    - the solver hash grid;
    - the card frame;
    - the curves chart and the measured table;
    - solver readouts.
  - Experiment: the controls.
- **Seedance:** each treatment, the sync take and each category get a deterministic phrase (`engine/prompt.ts`), plus prompting notes.
- **Related labs** (header and aside): Timing & Spacing, Animation Style, Environment & Depth, Painterly Textures.

Screenshots: `docs/screenshots/vfx-simulation/` (`node scripts/vfx-simulation/shots.mjs`). E2E: `e2e/38-vfx-simulation.spec.ts`.

## Known gaps

- **The realistic water is a particle look, not a meshed surface.** There is no surface reconstruction, refraction or foam, so it reads as a glossy bead mass. An external review called it "viewport particles". It is honest for a sim preview, but it is not a render.
- **The legibility metric is a proxy.**
  - Its thresholds (24 cells, 60%, IoU 0.5) and its 5 cm grouping are choices, documented above, not perceptual data.
  - It uses a side-on raster rather than the true camera projection.
  - The realistic result depends on particle count (0 frames at 600 droplets, 1–2 at 1,200–4,800).
- **The realistic impact time comes from a fitted formula.** Pip's realistic flinch keys off an estimate (tipStart + 0.6/√g − 0.19 s), which lands within about 30 ms of the solver's measured first contact at 1 g. It is not read back from the bake.
- **The rigid-body sim is 2D (camera plane) and somewhat soft.** Stacks settle by 1–2 mm, and very high impacts can throw crates out of frame.
- **The cloth and fire loops are not physically continuous.** The cloth bake uses the second of two loops, so its seam is close but not exact. Fire and magic are exactly periodic because their particle lives divide the loop.
- **Stylized fire on the sim is posterised particles,** not a true toon volume.
- **Side-by-side category views leave empty space** above and below at 16:9 on a 1440 × 900 window.
- **Pip's kick is a keyed leg swing.** The foot meets the bucket at the contact frame, but there is no contact solve.
- **E2E runs on SwiftShader with lite GLBs and 600 droplets.** The software path renders three Pips and three passes slowly but steadily.
