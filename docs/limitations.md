# Limitations and approximations

## Optics
- Ideal pinhole camera, the same model three.js, Blender and Unreal render. No focus breathing, no depth of field, no lens distortion, no vignetting from the lens.
- Distances are measured from the camera's entrance pupil (the pinhole), not the film plane.
- Active gate 36 × 20.25 mm (full-frame width, 16:9).

## Camera model
- The film camera rides one straight dolly rail at Bram's anchor height (1.47 m). It never rolls. Height and rail yaw are fixed in the MVP.
- Framing anchors are static marks (Pip's is his final mark), so Match mode never chases the animation.
- Match framing reachability from the default capture: every preset for Bram; Pip ≈ 25–107 mm; Both ≈ 19–120 mm. Outside the band the solve clamps at the rail end, the hint says so, and the readout shows the framing actually achieved.
- During a Match travel, focal length and depth are eased in log space with one time constant, so the subject holds its size on every frame for the level, centred primary (residual drift < 2 % for off-centre anchors).
- The nose-vs-ears number in the perspective guide uses the rest-pose face landmarks; it is most meaningful when Bram faces the camera (the 0.40 s "Portrait" beat).

## Characters
- Bram and Pip are Meshy 7.1 image-to-3D models (from GPT Image 2.5 Sunburst concept art), auto-rigged as humanoids. Each is one skinned mesh with one baked 1024 px texture: no facial rig (no blinks or brow motion), no separate cap, scarf or hat parts. The cap-tip beat reads as a hand raised in greeting.
- The 6 s performance is the same keyframe clip as the procedural puppets, mapped onto the skeleton (`scene/characters/Characters.tsx`), with A-pose arm offsets. Deformation at shoulders and elbows comes from Meshy's automatic skin weights.
- While the GLBs load, the procedural puppets stand in (Suspense fallback).

## Rendering
- One WebGL canvas: the stage, the monitor and the filmstrip are scissored passes of the same scene. WebGL2 required.
- No post-processing composer in the MVP (bloom/AO were planned; lamps are emissive and the stage has a CSS vignette).
- Filmstrip thumbnails refresh one preset per frame while playing (each ≈ 10 Hz at 60 fps).
- In-scene labels (drei `Html`) are hidden while the monitor is the main view.
- Development mode only: React StrictMode double-mounting makes drei's `Html` log "synchronously unmount a root" errors. Production builds are clean (verified).
- The Next.js dev server occasionally serves stale CSS for rules appended to `globals.css`; restart `pnpm dev` if a style change does not appear.

## Testing
- Headless Chromium renders WebGL on SwiftShader (CPU); the e2e suite therefore forces quality level 1 and never asserts frame rates. `pnpm test:e2e:gpu` uses the Metal-backed Chromium channel on macOS.
- Clipboard e2e runs on Chromium only (permissions granted in the config).

## Performance (measured on Apple M5 Pro, 1440 × 900, quality high)
| Phase | Time |
|---|---|
| Update (clock, pose, presentation, measurements) | ≈ 0.1–0.2 ms |
| Stage pass | ≈ 0.2–0.8 ms CPU |
| Shot pass | ≈ 0.2–1.1 ms CPU |
| Draw calls, stage + shot | ≈ 90 on placeholders; puppets add ≈ 70 meshes each pass |

Lower-end GPUs: drop to `quality` low (dpr 1, 1024 shadow map, idle-only thumbnails).


## Characters (HD cast, arms and faces)

- **The cast** is Meshy 7.1 HD (about 82k triangles, PBR maps) with Meshy's 24-bone auto-rig. That rig has **no finger bones**, so hands stay a fixed open pose. Gemini 4 Argon's review scored the arms 3–4/10 after the anatomy fixes (from 3 and 4 before), and its remaining complaints are mostly the rigid "paddle" hands and the hand-keyed feel. The fix is a re-rig with fingers (Mixamo or AccuRig) plus motion-capture or library gestures retargeted onto the rig.
- **The face rig is procedural.** It deforms the painted eyes, brows and mouth. A blink squeezes the painted eye into a lid line rather than closing a real lid. Bram's mouth is hidden by his mustache, so he has no smile or mouth targets. Landmarks were placed by hand on texture splats, so a regenerated model needs them re-measured (`scripts/characters/face-splat.mjs`, then `face-rig-data.mjs`).
- **The cap and scarf** are part of the body mesh, so Bram cannot tip his cap. He waves instead.
