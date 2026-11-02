# Lens & Framing

Route: `/labs/lens-and-framing` · workspace: `src/labs/lens-and-framing/` · browser checks: `e2e/00-*` through `e2e/14-*`.

## Learning flow

The camera's 16:9 shot is the starting view. Choose a lens from the six live comparisons, watch the same performance, then try **Match framing**. Fixed camera changes the field of view from one position. Match moves the camera to preserve the selected framing, making the change in perspective visible.

**Studio** exposes the camera, dolly rail and framing geometry. The small companion view stays available in either layout. The camera keeps its 16:9 composition when swapping views or opening full screen. All views and live comparisons use the existing single canvas and frame orchestrator.

The inspector contains lens, camera behaviour, framing target and distance. Composition guides are disclosed on demand. Guided exercises remain available below these essentials. Each lens study explains what to compare, with a short experiment; the copy avoids treating a focal length as an objectively correct or flattering viewpoint.

Three scenes give the same controls different purposes:

- **Doorway:** compare the character with the doorway behind him.
- **Long Alley:** compare how quickly a running character grows in frame.
- **Workshop:** compare the size relationship between foreground action and the second character.

Rail limits are marked in amber under the affected live previews. The preview remains unobscured so learners can see the framing that is actually possible.

## Practical controls

- **Lens:** continuous slider, six presets, or keys 1–6.
- **Distance:** manual dolly in Fixed; automatic in Match, with an explanation and rail-limit feedback.
- **Performance:** play/pause, restart, native keyboard-accessible scrubber.
- **Shot notes:** copy the current description, save a shot, or export camera settings for Blender and Unreal.
- **Field guide:** concise explanations, keyboard map and camera-model assumptions.

Saved shots restore their scene, camera and paused performance time, and update the scene URL. Export opens a named modal dialog and copies exactly the snapshot displayed in it. Native button and range keys work without triggering background shortcuts. Reduced motion starts paused. A fresh visit resets the transient camera session while preserving preferences and saved progress.

On phones the workspace scrolls vertically, live comparisons form three columns, and controls remain reachable. Viewport measurements and the shared canvas redraw on scroll, even while the performance is paused. Studio labels project into the studio's registered rectangle rather than the full canvas.

## Bram's rig correction

The existing model already has a Meshy skeleton. Its current bind pose differs from the older model's arm angle, but the animation mapping still applied the old correction. That rotated his hands into his lap.

`src/scene/characters/Characters.tsx` now uses −18° / +20° upper-arm offsets, with matching forearm and hand coordinate frames. This leaves clearance for the coat and preserves the gesture motion. The Workshop startle uses less shoulder twist and arm spread so the raised palms read clearly without the extreme sleeve collapse. The model, skeleton and animation clips remain shared across labs. No new generation was required; fal spend for this refinement: **$0**.

The follow-up wave review found a separate issue: the greeting added an overhead shoulder lift and deep elbow flexion on top of the resting pose and existing bind-pose bend. The complete chain folded behind Bram's head around 3.66 s. `waveForward` now keeps the elbow below the shoulder, eases into the lift without overshoot, and reduces wrist motion. Bram greets with the hand nearest Pip in Doorway and Alley, keeping his face visible in the film camera.

`e2e/13-character-rig.spec.ts` inspects the actual loaded skeleton at rest, throughout the wave and Workshop startle, and on return to rest. `scripts/review/capture-arms.mjs` supplies timestamped visual pose review, with a configurable `start:end:step` range and front/side views. When a model replaces its loading puppet, the thumbnail cache refreshes every lens even while paused.

Wave review artifacts are in `docs/screenshots/rig-wave-review/`: the original loop sampled every 0.25 s, the corrected loop at 24 fps (`after/doorway-wave-24fps.mp4`), full-loop and per-frame contact sheets, a side-view sequence, and the Alley greeting. The review checks the lift, wrist sweep, face clearance, lowering arc and return to rest. No fal calls were needed for this follow-up.

## Review

```sh
pnpm verify
BASE_URL=http://localhost:3123 pnpm exec playwright test --project chromium-gpu --output=/tmp/animation-lab-gpu-review
node scripts/shots-lens-refined.mjs
```

The screenshot script records desktop, compact desktop and phone layouts; Fixed and Match lens comparisons; Studio; scenes; and full screen. Review outputs in `docs/screenshots/lens-framing-refined/` alongside the browser and unit checks.
