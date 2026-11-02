# 2D vs 3D Animation

Route: `/labs/2d-vs-3d` · code: `src/labs/2d-vs-3d/` · e2e: `e2e/37-2d-vs-3d.spec.ts` · screenshots: `docs/screenshots/2d-vs-3d/` (`node scripts/shots-2d-vs-3d.mjs [outDir]` against a running dev server, default `:3123`).

## What it teaches

The same move, made three ways, side by side on one playhead. Pip does a "hooray hop": crouch, throw both arms up, hop, land in a squash, settle. The hop is defined once and played as:

| Pane | Technique | What it can do | What it can't |
|---|---|---|---|
| Hand-drawn (SVG, on twos) | A new drawing for every pose | True foreshortening, squash & stretch, bendy limbs, a smear on the arm swing, line boil, onion skin | A new angle means redrawing every frame |
| 2D cut-out (SVG, on ones) | Rigid paper parts on pivots, 3 drawn views | Reuses every drawing; perfectly on model; pivots shown | Can't foreshorten (a front-view crouch splays the knees), can't squash, snaps between drawn views, swaps mouths |
| 3D rig (WebGL) | Pip's real rigged model | Any camera angle for free; real light | Smooth by default (floaty unless stepped); squash or smears need extra rig work |

**Turn the camera** (0–90°) is the key control:
- The 3D camera simply orbits.
- The cut-out snaps to its nearest drawn view and says a true angle would need a new 21-drawing parts set.
- The drawn pane redraws at the exact angle, and its cost counter adds another whole loop of drawings.

Each pane has its own cadence toggle (on 1s or on 2s), because cadence is a choice in every technique. Below the stage:
- four "things to try" set up the stage: turn to 30°, pause on the crouch, step to the arm swing, put 3D on twos;
- a comparison table: what you build, a new angle, a new move, squash and smears, staying on model, light, typical artefact, widely known examples.

## How it works

- **`move.ts`**: the technique-neutral timeline (DSL key tracks per pose channel), cadence maths (`heldFrame`, `shownTime`, `drawingIndex`), the shared leg geometry (`kneeAngle`, `hipDrop`), `rigDeltas` (pose → Pip's rig parts) and `hopClip()`, which keys the rig every 1/48 s.
- **`figure.ts`**:
  - Pip's 2D body in metres, proportioned after the rigged model;
  - forward kinematics (`skeleton`) and an orthographic `project(v, turn)`;
  - head-sphere feature mapping, so the face turns convincingly;
  - `ik2d` for the cut-out's rigid limbs, `boil`, the view library (`snapView`, `offView`) and the cost counts.
- **`PipDrawing.tsx`**: one SVG renderer, two modes.
  - Drawn applies squash about the feet and boil per drawing, and draws noodle limbs, solid eyes with lids that squint on the squash frames, a tapered smear with "multiples", and onion-skin ghosts as tinted silhouettes.
  - Cut-out draws rigid capsules with a paper drop shadow, a head that only turns in the picture plane, three replacement mouths and pivot markers.
  - The sou'wester (bell crown, drooping brim), coat and head are built from rings in Pip's space and drawn as silhouettes, so they hold up at any angle.
- **`RigStage.tsx`**: the only canvas.
  - Everything is drawn in `FrameOrchestrator`'s `renderFrame`. It orbits the camera, runs the frame bus at the pane's held time and scales a wrapper about the feet for squash.
  - It optionally adds a `SkeletonHelper` (Show rig).
  - Pip hops on a small round stage under a near-overhead lab-local key light, with a soft contact shadow under him that shrinks as he rises (the same rule as the 2D floor shadows), so the hop height reads the same in all three panes.
  - Shared GLTF materials are untouched: `RiggedCharacter` clones them.
- Numbers live in `twoDThreeDConfig` and are explained in `docs/design/decisions.md` ("2D vs 3D: one move, three techniques").

## Limits

The 2D Pip is a simplified, on-palette drawing of the rigged model, not a production model sheet. At extreme arm raises the 3D shoulder skinning reads lower than the bone (the rig overlay shows it), and the rig's overlap smoothing makes 3D hands trail the 2D poses by up to 0.085 s. The 3D rig has no squash controls, so its squash is a whole-body scale. Costs are teaching counts for this loop.

## Validation

`twod.test.ts` (13 tests) covers:
- loop closure and the floor;
- crouch and squash timing, and volume-preserving squash;
- cadence holds and drawing indices;
- 2D forward kinematics agreeing with the rig's hip drop at every frame;
- a valid, closing 3D clip that matches the pose;
- projection directions;
- view snapping and the off-view flag;
- rigid IK reach and side choice;
- cost counts, deterministic boil, and where smears are needed.

The e2e spec (7 tests × 2 projects) covers:
- one canvas and three panes;
- per-pane cadence;
- frame stepping, where the drawn pane holds each drawing for two frames;
- camera turn, which is continuous in 3D and snapped in the cut-out, with climbing drawn costs;
- cadence toggles;
- onion skin, pivots and rig toggles;
- the experiments (smear only in the drawing);
- mobile: sticky panes and no overflow.
