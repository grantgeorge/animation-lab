# Facial Animation & Lip Sync

Route: `/labs/facial-animation`. The next Character Animation lab on the roadmap.

The signature experiment moves only the mouth by −300 to +300 ms against one recorded voice take. Positive offsets make the mouth late. A shared Web Audio clock drives the edited drawing and optional synced reference, with 400 ms of silent handles at each end so extreme offsets remain visible. There is no autoplay. Playback pauses when the document is hidden; scrubbing, stepping, changing takes and changing speed pause the transport.

- **Watch:** a close-up, dialogue captions and transport.
- **Inspect:** the recording's envelope, shifted viseme blocks and a mouth-shape key.
- **Experiment:** mouth offset, articulation, six recorded deliveries, eye acting and comparison.

The face reuses the acting lab's SVG rig and local recorded takes. Mouth shapes blend over 50 ms; cues are authored approximations, not a phonetic alignment measurement. Articulation scales mouth shapes without moving cues. Eye acting retains the delivery's authored gaze, brows and blinks; its timing stays fixed when the mouth moves. The torso and head stay still to isolate the face. The direction card deterministically describes the chosen delivery, timing, articulation and upper-face state, and copies plain text for AI video direction.

No extra canvas, render loop or dependencies are added to the 3D renderer. The Web Audio transport advances React's SVG presentation using the audio context clock. Audio decode failures are visible and leave scrubbing available.

## Validation

`src/labs/facial-animation/engine.test.ts` checks offset sign, reference equivalence, independent eye timing, articulation, silent handles and generated direction. `e2e/22-facial-animation.spec.ts` covers the actual route, playback, mouth changes, reference stability, mode changes, delivery selection, copy, audio failure and mobile layout.

With the app running, capture the default, comparison, Inspect, Watch and mobile layouts:

```sh
node scripts/shots-facial.mjs
```

Review the five images under `docs/screenshots/facial-animation/`. Browser tests and screenshot review remain pending in the current implementation session because the sandbox blocks local server binding and Chromium launch.
