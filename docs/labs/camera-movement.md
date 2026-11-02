# Camera Movement lab

`/labs/camera-movement`. Same scenes, cast and performances as Lens & Framing; the camera is now free to move.

## What it teaches

- **What each move does to the picture.** There are ten presets: locked off, dolly in, dolly out, zoom in, pan, tilt, truck, crane, orbit and tracking. Every preset frames the subject at time t0 and runs inside a move window. Before t0 the camera holds its start key, and after t1 it holds its end key.
- **Dolly vs zoom (the signature experiment).** The two monitors start from the same camera and end with the subject the same size. The dolly moves the camera at a fixed lens; the zoom keeps the camera and multiplies the focal length by d0/d1. Each monitor shows a background-scale readout. The doorway grows about 1.5× with the dolly and about 2.1× with the zoom, which is why "dolly in" and "zoom in" are different prompts.
- **Dolly zoom (vertigo).** The position glides while the focal length is re-solved every frame: f(t) = f0 · depth(t) / depth0. The subject keeps its size to within about 1 %, and the background swells (pull back, zoom in) or recedes (push in, zoom out).
- **Operator vocabulary.** `analyzeMove` decomposes the start-to-end change, measured in the start camera's frame, into dolly, truck, pedestal or crane, pan, tilt, zoom and arc components. It also reports the start and end shot sizes and a speed word. `movePhrase` turns that into a one-line AI-video direction that names the move first and uses one move per shot. Example: "Steady dolly in, from a full shot to a medium close-up of Bram, 35 mm moderate wide lens; 4-second move, easing in and out."

## Interaction

- **Moves and experiments:** pick one in the right inspector, or press `1`–`0` for moves, `C` for dolly vs zoom and `Z` for the dolly zoom.
- **Inspector:** the move amount (push in m, sweep in °, slide in m, rise in m, arc in °, lead distance in m), lens and subject. Expand **Timing & easing** to adjust the speed curve (linear, ease, in, out) and move window.
- **Studio view:** switch from Camera to Studio, then drag the amber rings to move a key on the floor plane, Shift-drag to raise or lower it, and use `R` to reset. The cyan line is the path. Ghost cameras show the start and end keys, the live camera carries its frustum, and a mint ring marks the subject.
- **Monitors:** each shows focal length, distance and subject height, plus the background scale relative to the start frame.

## Architecture

- `engine/` is pure TypeScript with Vitest tests in `engine.test.ts`:
  - `moves.ts`: presets and `dollyVsZoom`.
  - `path.ts`: `poseAt` interpolates linear, orbit, track and dollyZoom moves.
  - `analyze.ts`: decomposition and the prompt phrase.
  - `subject.ts`: where the characters are at time t, from the scene marks and the performance's root channels rotated by rest yaw.
- `runtime/Orchestrator.tsx` is the lab's only positive-priority `useFrame`. Each frame it:
  1. ticks the lab's clock once;
  2. solves every view's pose;
  3. runs the shared frame-bus updaters (characters, props, viz);
  4. updates shadows once;
  5. clears the full canvas, then renders the observer into its bounded DOM stage;
  6. renders each 16:9 shot into its DOM monitor window with a scissor (drawing the small stage last when it is picture-in-picture).
- The monitor frames have no glass background, because a tinted ancestor would veil the shot.
- `store.ts` is a zustand store with a `version` cache key.
- The test hook `window.__cameraLab` exists only with `?e2e=1`.
- E2E: `e2e/25-camera-movement.spec.ts`.

## Limitations

- Paths are two-key moves: straight lines, arcs or subject-relative tracking. There are no splines, multi-key paths or camera shake.
- Handles move positions only. Aim points come from the preset, the subject, or both.
- The lens is an ideal pinhole, as in Lens & Framing: no breathing, distortion or depth of field.
- Tracking in the doorway scene is subtle, because Pip only walks about a metre. Use the alley.

## Focused workspace review

The camera picture is primary, with the studio as a small inset. Camera/Studio swaps their roles without creating another canvas. The inspector groups move selection and essential parameters; the explanation and a concrete experiment sit beneath playback. On phones the inspector precedes the longer explanation, and dual-shot comparisons stack without clipping.

Reduced motion starts paused. Buttons retain native Space activation; the field guide uses a native modal with Escape and focus restoration. Pointer projection and orbit controls use the actual stage bounds, including after swapping views.

Reviewed captures at 1440×900, 1280×800 and 390×844 are in `docs/screenshots/camera-movement-refined/`, including the Studio path, dolly/zoom comparison and scrolled phone controls. `e2e/25-camera-movement.spec.ts` also drags an actual projected path handle to verify the bounded stage interaction.
