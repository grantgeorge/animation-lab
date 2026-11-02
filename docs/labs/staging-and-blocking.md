# Staging & Blocking

`/labs/staging-and-blocking` teaches blocking as one idea: where actors stand and which way they face decides what the camera can read between them. It uses the shared doorway set, the rigged Bram and Pip, and the doorway greeting with root motion removed, so the figures stay on the user's marks.

## Layout

- **Camera view** (left, large). The real film camera, drawn through `FrameOrchestrator` on one canvas. A Camera/Set toggle swaps in an orbitable Set view that shows the filming camera as a prop with its frustum (layer 1, invisible to the film camera). There is no picture-in-picture: nothing covers the composition.
- **Floor plan** (right), drawn to true scale. It shows the doorway flat, the usable floor, the lens's real horizontal field of view (36 mm gate) as a shaded wedge, each actor's mark with a facing arrow and dotted eyeline, and the line between them. Marks drag with a pointer, or take focus and move with the arrow keys (Shift for 0.5 m steps; up is upstage).
- **Facing**: To camera / Each other / Cheat open. "Cheat open" turns each actor 45% of the way from the partner toward the lens (`blockingConfig.cheat`).
- **Camera angle, lens, silhouette test.**
- **Readout**: silhouettes, frame (with screen side), distance with Hall's proxemic zone, and a "faces to camera" meter per actor (1 = open, 0 = profile, negative = turned away).
- **Exercises** (4), each set up with one click and checked live; when every check passes, a short "why it works" note appears:
  1. Reveal the hidden actor (silhouette; a sideways step or the camera alone solves it).
  2. Change the relationship (bring them to personal distance, then play the greeting).
  3. Give Pip the scene (move him upstage; the upstage partner turns toward the lens).
  4. Cheat it open (both faces read while they still play to each other; "To camera" fails the check).

## Performance on arbitrary marks

The authored greeting turns each actor from a camera-facing rest toward a partner on a known side, and Bram waves with the hand nearest Pip. `BlockingStage` adapts the clip (memoised per actor, facing and side):

- When the bodies already face each other, the head, torso, pelvis and foot yaw/roll turns are dropped.
- When Pip stands left of Bram, those turns are mirrored.
- The wave moves to the arm that keeps the hand clear of the head in the film camera: the one nearest the partner when facing the lens, the downstage arm in profile. Arm tracks swap L/R and negate yaw and roll.

## Limits

The readout uses rest-pose bounds (a cylinder per actor), not mesh-accurate visibility; the silhouette view and the moving performance remain the final checks. Openness uses body yaw only, not the head turn inside the clip. At wide camera angles the edge of the set is visible beyond the flat.

## Validation

`src/labs/storytelling/blockingMath.test.ts` covers projection, facing, openness, proxemics, and gives each exercise a known solution, along with a failing state that must not pass. `e2e/24-blocking-3d.spec.ts` drives the exercises through pointer and keyboard, and `e2e/23-storytelling.spec.ts` keeps the blocking smoke and mobile checks. Captures: `node scripts/shots-blocking.mjs` → `docs/screenshots/staging-and-blocking/`.
