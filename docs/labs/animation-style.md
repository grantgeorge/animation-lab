# Animation Style

Route: `/labs/animation-style` · code: `src/labs/animation-style/` · e2e: `e2e/33-animation-style.spec.ts` · screenshots: `docs/screenshots/animation-style/` (`node scripts/shots-animation-style.mjs` against a running dev server, default `:3123`).

## What it teaches

An animation style is four independent decisions: technique, visual style, movement style, and rendering & finishing. The lab isolates **movement style**, the one you can't see in a still. Pip, the doorway set and a locked-off 40 mm camera stay fixed. In one beat the door bangs open, Pip startles, freezes in fright and bolts off screen right. That same beat plays as:

| Style | Cadence | Recipe |
|---|---|---|
| Naturalistic | ones | small exaggeration, light anticipation, natural follow-through, no squash, no holds |
| Cartoony | ones | big exaggeration, anticipation and overshoot, full squash & stretch, short holds |
| Limited (anime TV) | threes | long pose holds with sudden transitions, little anticipation or follow-through |
| Snappy stepped | twos | strong poses that hit and hold, moderate squash |
| Stop motion | twos | handled per-pose wobble, no squash |

Each style is a **recipe** of six principle dials: cadence, exaggeration, anticipation, follow-through, squash & stretch, and pose holds. Moving any dial makes a custom recipe. **Compare four** draws Naturalistic, Cartoony, Limited and Snappy in a 2×2 grid on one canvas. A 24-frame **cadence strip** shows which frames draw a new pose for each style, and the frame being shown. A minimal **look** toggle (as modelled, toon-shaded, flat colour) changes the image without touching the motion, which proves the two decisions are separate. Finishing belongs to Grading & Finishing and Painterly Textures, and camera to Animation Camera; the header links to them.

Below the stage: an atlas of eight visual styles (each "Try" button applies its usual motion and look), a five-part **direction builder** (construction, appearance, performance, timing, camera & finishing; performance and timing come from the stage) with copy, a note that prompting alone can't enforce cadence or spacing in video models, and a motion vocabulary table.

## How it works

- `performance.ts`: the startle beat is authored in layers. **pose** is scaled by exaggeration, **antic** by anticipation, **follow** by follow-through, and **travel** (turn, run cycle, exit) is never scaled, so every style exits the same way. `startleClip(weights)` bakes a normal DSL clip; the loop closes off screen. The door leaf is driven through `DoorwayFlat`'s `doorRef`.
- `styles.ts`: the shown time is `remap(heldFrame(t, cadence) / 24, holds)`. Real time is held on the cadence first, so every part of the rig steps together, even with the rig's overlap smoothing. Then, within each beat, the pose holds for `holds × 75%` of the beat and moves late and fast; the run is never remapped. Squash & stretch scales a wrapper group with volume preserved, and stop-motion wobble is a deterministic per-pose offset.
- `StyleStage.tsx`: one `<Canvas>`; everything renders in `FrameOrchestrator`'s `renderFrame`. In the grid, each viewport shows only its own Pip, runs the frame bus at that style's time, refreshes the shadow map and renders into a scissored quadrant. Looks swap mesh materials to cached derived materials (toon: a 2-step ramp; flat: unlit). The shared GLTF materials are never modified, and the originals are restored on unmount.

## Limits

Smear frames need drawn or deformed frames, so the rig can't show them (the vocabulary note says so). Face channels saturate at the rig's 0–1 range, so exaggeration mostly reads in the body. Timing differences show in playback, not in a single paused frame, which is the point of the lab.

## Validation

`styles.test.ts` covers cadence (24/12/8/6 poses per second), monotonic pose-hold remapping that keeps every key pose, clip validity and loop closure for every style, layer weights, door timing, a common exit, volume-preserving squash, per-pose wobble and the five-part direction. The e2e spec covers presets, custom dials flowing into the direction, frame stepping, the one-canvas grid, look independence and atlas buttons, the builder, and the mobile sticky stage.
