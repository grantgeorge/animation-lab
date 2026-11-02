# Lighting Studio

Route: `/labs/lighting-studio` · code: `src/labs/lighting-studio/` · tests: `src/labs/lighting-studio/**/*.test.ts`, `e2e/30-lighting-studio.spec.ts`.

## The learning flow

Choose a look from six real scene previews. Study the face in the camera, break the rig into key → fill → rim → full look, then try one practical experiment. Each look explains what to watch, rather than assigning a mood to a number alone.

- **Three-point:** lower the fill and watch the shadow side deepen.
- **Flat cartoon:** move the key away from the camera and look for facial modelling.
- **Storybook:** cool the warm key and compare the atmosphere.
- **Cinematic:** raise the fill to reveal the hidden cheek.
- **Noir:** reduce the blinds pattern under Light shaping.
- **Sunset:** move the key from behind to the side and turn an outline into a lit face.

The initial camera is a close-up so small changes to facial lighting are visible. A fixed 16:9 film gate keeps the composition identical in the main camera view, the small preview and the camera frustum. The studio view remains freely orbitable. There is one existing canvas and render driver; no additional canvas or frame loop is used for the preview images.

The right inspector puts light selection, position, intensity, colour and softness first. Distance, beam, blinds and shadow casting sit in **Light shaping**. **Reset** restores the currently selected look. **Solo** isolates one channel and displays an explicit way to show all lights again. Edited looks get neutral study guidance rather than claiming the original lighting setup still applies.

On narrow screens, the page scrolls normally. Exercise buttons select the relevant light and scroll to its controls. Reduced motion starts the performance paused and makes lighting transitions instant. Returning to the route starts a fresh rig; previous edits do not leak into the next visit.

## Controls

| Action | Control |
| --- | --- |
| Move the selected light | Drag the camera picture; Around / Height sliders; arrow keys (Shift ×3) |
| Move lights in space | Studio view: drag a lamp; drag empty space to orbit; scroll to zoom |
| Placement diagram | Drag a dot; inward means higher, not closer |
| Select a channel | Key, Fill, Rim, Environment; K / F / R / A |
| Solo selected channel | Solo button or S; Escape exits solo |
| Apply looks | Preview cards or 0–5; 0 is Three-point |
| Restore the current look | Reset in the inspector |
| Build the look one light at a time | Break down the lights, or T; [ / ] changes steps |
| Swap camera and studio views | Camera / Studio tabs, small preview, or V |
| Framing | Close-up / Medium / Full |
| Play or pause | Playback button or Space when no interactive control has focus |
| Copy the lighting description | Copy or C |
| Explanations and shortcuts | Field guide or ?; Escape closes |

Keyboard shortcuts preserve native button, select and slider behavior. Sliders expose formatted values to assistive technology. The field guide is a named native dialog with normal focus restoration.

## What the numbers mean

The **rig ratio** is an estimate: `(key + fill + ambient) / (fill + ambient)`, using intensity / distance² for each spot and a simplified ambient term. Doubling that ratio adds one stop. It is not sampled image contrast, and does not account for direction, beam coverage, blinds, surface orientation, material response or tone mapping. Backlighting in particular cannot be interpreted as the face’s lit-to-shadow ratio.

Per-light lux is likewise an approximate intensity / distance² readout. Percentage-of-total-light claims have been removed because summing lights from opposing directions is not a measured contribution to the image.

Softness approximates source size using PCF shadow blur and spot penumbra. It does not simulate area-light wrapping or contact hardening. Environment bounce is a hemisphere light, and the background glow is painted emission. These limitations are visible in the controls and field guide.

The generated prompt is a deterministic description of the current effective rig, including solo and breakdown masks. It drops the preset’s leading phrase after edits. It is useful language to copy into a video prompt, rather than a physical render specification.

## Rendering and assets

The engine is pure TypeScript. The existing scene driver advances the local clock, interpolates the rig, eases channel masks, applies pose and lighting updates, renders shadows, then draws the main view and scissored preview.

Bram uses the shared GLTF, cloned through `SkeletonUtils`. Per-instance physical materials preserve the asset’s colour, normal and roughness maps without mutating the shared cache. ACES tone mapping and a saturation grade apply to the character and sweep. The backdrop shader uses defined, ascending `smoothstep` edges.

Preset preview images are frozen camera renders of these same rigs. Regenerate after changing lighting, materials, character or framing:

```sh
node scripts/shots-lighting-previews.mjs
```

Output: `public/labs/lighting-studio/previews/*.png`. No external generation was needed for this refinement; fal spend for this pass: **$0**.

## Verification and captures

```sh
pnpm verify
BASE_URL=http://localhost:3123 pnpm exec playwright test e2e/30-lighting-studio.spec.ts --project chromium-gpu
node scripts/shots-lighting.mjs docs/screenshots/lighting-studio/refined 1440x900
node scripts/shots-lighting.mjs docs/screenshots/lighting-studio/refined-compact 1280x800
node scripts/shots-lighting.mjs docs/screenshots/lighting-studio/refined-mobile 390x844
```

The browser suite checks all looks, interpolation, light movement, solo, breakdown steps, reset, advanced controls, clipboard, native keyboard behavior, reduced motion, desktop panel geometry, mobile scrolling, and identical film-camera projection in both views. The opt-in `?e2e=1` hook exposes state, frame counts, lamp position and camera framing for regression checks. `freeze=`, `preset=`, `view=`, `shot=`, `nomotion=1` and `quality=high|low` support deterministic visual review.
