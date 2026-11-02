# Character Rigging

Route: `/labs/character-rigging` · code: `src/labs/character-rigging/` · e2e: `e2e/35-character-rigging.spec.ts` · screenshots: `docs/screenshots/character-rigging/` (run `node scripts/shots-character-rigging.mjs [outDir]` against a running dev server, default `:3123`).

## What it teaches

A rig turns a sculpted model into a puppet. It has three parts:
- a **skeleton**: the 24-joint Meshy skeleton that Bram and Pip share;
- a **skin**: up to four joint weights per vertex;
- **controls**: FK rotations, IK handles and pole vectors.

The lab poses the real cast models on a turntable stage. The display can be Mesh, X-ray, Weights or Skeleton, and the camera Front, ¾, Side, or Arm (a close-up that follows the elbow). A Bram/Pip toggle shows one skeleton driving two bodies.

- **FK & IK.** Drag any joint on the stage to rotate it (the bone swings toward the pointer, within the joint's limits), or pick it on the stage or from the list and use its named axes (Raise, Swing, Twist, Bend…). With the legs on IK, drag the hips down to squat.
  - Switch the left arm or the legs to IK, then drag the gold hand target (arrow keys work, with Shift for fine steps). The pole vector swings the elbow.
  - Readouts show the rotations IK wrote. "Too far" means the arm has extended as far as it goes.
  - Switching a limb back to FK keeps the pose, the way a production FK/IK match does.
- **Exercises**, each self-checking, with a "why it works" note once solved:
  1. Reach the mark with FK, then with IK.
  2. Squat without sliding feet. In FK the feet sink, shown in red. IK legs keep them planted.
  3. Point the elbow out with the pole while the hand stays on the mark.
- **Skinning.**
  - Paint any joint's influence.
  - Compare smooth (shipped) and rigid binding. Rigid tears the sleeve, the trousers and the scarf at bends.
  - Twist the wrist past 90° to see the linear-blend "candy wrapper", or fold the elbow to see volume loss.
- **Bind pose.** This explains "why our arm fixes mattered". The wave clip plays three ways:
  - with no correction (A-pose arms);
  - with the rest offset only (the elbow hinge is still tilted);
  - shipped (offset plus hinge frame).
  
  A green ghost shows the shipped arms. The page's three-step story quotes the live offsets from `Characters.tsx`.

## How it works

- `rigMath.ts` (pure, tested):
  - `deltaToLocal` / `localToDelta`: the `RiggedCharacter` formula, plus its inverse, under the three correction modes;
  - `solveHinge`: bisects the hinge bend that spans a distance;
  - pole direction and angle;
  - rigid weights, influence, and the weight-paint ramp.
- `joints.ts`: the seven pickable joints (spine, head, left shoulder, elbow and wrist, hips and knees for both legs), with axis signs that follow `arms.ts`. Also slider ↔ delta conversion.
- `RigStage.tsx`: one `<Canvas>`; everything runs in `FrameOrchestrator`'s `renderFrame` through a `StageView` class.
  - Each frame it applies the FK pose, the hip drop, leg IK and arm IK, then measures and draws the skeleton overlay: octahedral bones drawn on top, plus the ghost, target, pole and mark.
  - Joint pickers, the IK target and labels are DOM buttons, projected every frame.
  - Dragging a joint is relative: the far end of its bone moves as far as the pointer does, and `aimJoint` finds slider values for that end with a short coordinate descent over the joint's own axes, within its limits (twist and turn are left alone because they never move the end). So a hinge stays a hinge, and the sliders update live. With IK legs, dragging the hips sets the hip drop instead.
  - The GLB is cloned with `SkeletonUtils`. Geometry and materials are per-instance copies.
- `exercises.ts`: the checks run on measurements the stage publishes.

## Limits

- Only the left arm has IK. The legs have IK as a pair, with feet pinned at rest.
- The candy wrapper is partly hidden by Bram's cuff. Use the Arm view.
- The rig has no twist joints or corrective shapes, so it can't show those fixes, only describe them.

## Validation

`rigging.test.ts` covers:
- the correction modes and the inverse round trip;
- hinge IK, reach and the pole round trip;
- rigid and influence weights;
- slider signs and mirroring;
- every exercise's pass and fail cases.

The e2e spec covers:
- one canvas, and the display, view and character switches;
- picking a joint on the stage and bending it;
- IK drag, out of reach, and FK matching;
- all three exercises solved through the UI;
- the skinning controls;
- the bind-pose modes and the ghost;
- the mobile sticky stage with no overflow.
