# Character Design & Proportions

Route: `/labs/character-design` · code: `src/labs/character-design/` · e2e: `e2e/36-character-design.spec.ts` · screenshots: `docs/screenshots/character-design/` (`node scripts/shots-character-design.mjs [outDir]` against a running dev server, default `:3123`).

## What it teaches

A character design is a set of ratios plus the shapes that carry them. The lab builds one figure from simple shapes and lets you change **head size** (read out in heads tall), **eye size**, **eye spacing** (in eye-widths), **eye line** (height on the face), **limb length**, **limb thickness** and **hands & feet**, plus **shape language** on a circle / square / triangle pad. Every design is built to the same height (1.5 m), so a model sheet compares like with like.

The stage is a model sheet on one canvas:

- a shaded three-quarter view (optional turntable)
- a black **turnaround** (front, 3/4, profile) on paper, framed to the design's own bounds in the current pose. All three views share one scale, and each tile is as wide as its view needs (`sheet.ts`).
- a **lineup at 48 px**: Pip, Bram and your design side by side at thumbnail size, the "does it read at a glance" test

Three poses (Neutral, Open, Action) show that a pose reads when the limbs break the outline.

Readouts under the stage:

- **Proportion:** heads tall and the system, from chibi to heroic.
- **Reads as:** an age band from baby-schema cues (head-to-body, eye size, eye line).
- **Eyes:** spacing and size.
- **Shape language:** the dominant shape and what it suggests.
- **Two measured silhouette numbers:**
  - **negative space**: 1 − area ÷ convex-hull area
  - **unlike Pip**: 1 − IoU against Pip's silhouette in the same pose

All readouts are labelled as rules of thumb, not measurements of appeal.

Four self-checking exercises: *Make it read younger*, *A villain in one shape*, *Fix the silhouette*, *Stand apart from Pip*. Below the stage:

- a heads-tall scale with Pip, Bram and your design marked
- appeal principles (clarity, simplicity, contrast, straights against curves)
- shape-language cards with "try" buttons
- the four readability tests
- a copyable design brief for model sheets or prompts

## How it works

- `design.ts` (pure):
  - the `Design` type, the slider ranges and the presets
  - `castDesign()`, which builds "Like Pip" and "Like Bram" from `designConfig.cast`
  - the proportion system, baby-schema scoring and dominant shape
  - `buildFigure()`, which turns a design into exact construction numbers. Head and torso are lathe profiles blended barycentrically between circle, square and triangle versions. Shape weight also drives the outline:
  - squares add bulk and sturdier legs
  - triangles broaden the shoulders, taper to a narrow waist and spindly legs, give a narrower and longer head with a pointed chin, sharper elbows and a slight forward hunch
  - in the face, triangles squint the eyes and slant the brows Limbs are tapered two-segment chains with per-pose joint angles, and a root drop keeps the lowest foot on the floor.
- `silhouette.ts` (pure): mask area, a monotone-chain convex hull over pixel corners, IoU, and the readPixels row flip.
- `Figure.tsx`: the figure in R3F from lab-local materials. The shared `satin()` cache is never touched.
- `DesignStage.tsx`: one `<Canvas>`, rendered only in `FrameOrchestrator`'s `renderFrame` through a `SheetRenderer`. Each frame draws the shaded view, then the black turnaround (bounds measured precisely once per design change) and the fixed-scale lineup via `scene.overrideMaterial`, all in scissored viewports. Hidden Pip and Bram figures, in the same pose, serve the lineup and the reference mask. The 96×120 front-view mask is rendered offscreen and read back **only when the design or pose changes**. The stage exposes `data-negative`, `data-solidity`, `data-distinct` and `data-pose` for tests.
- `exercises.ts`: checks and thresholds. Negative space ≥ 35% and outline difference ≥ 30% were set from measured values (e.g. Pip neutral 22% → open 50%; Bram vs Pip in neutral 28%).

## Limits

- The figure is a construction model, not a finished character: no costume or hair styles, and the only expression is the triangle squint and slanted brows.
- The age band and shape meanings are conventions from design practice, not perception research.
- Silhouette metrics use the front view only, at 96×120 px.
- Cast presets measure the procedural puppets, which match the rigged models' eye and crown landmarks. Limb thickness and shape weights for the cast are judgements, not measurements.

## Validation

`design.test.ts` covers:

- cast measurements (Pip ≈ 3.5 heads, Bram ≈ 4.7)
- system boundaries, monotonic youth cues and the age bands
- barycentric blending and the shape pad round-trip
- turnaround layout: one scale, per-view tile widths, filling width or height
- construction: exact height, eyes on the face, legs under the hips, every preset and pose
- preset ranges and the brief
- silhouette metrics: a solid block, limbs adding negative space, IoU, the hull and the readPixels flip
- every exercise starting unsolved and being solvable

The e2e spec covers presets, sliders, the shape pad by keyboard, measured negative space rising when the pose opens, solving all four exercises, one canvas, and the mobile sticky stage with no overflow.
