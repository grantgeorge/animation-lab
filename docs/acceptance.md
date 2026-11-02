# Acceptance evidence (spec §15)

| # | Criterion | Evidence |
|---|---|---|
| 1 | Appealing animated 3D scene | `docs/screenshots/*`; checkpoint images; art review in REVIEW notes |
| 2 | Two original characters, synchronized loop | `scene/characters/Bram.tsx`, `Pip.tsx`; `scene/animation/performance.test.ts` (loop closes, zero seam velocity) |
| 3 | Live output + explorable technical view | monitor + orbitable stage; e2e `00-webgl-canary` (both passes render) |
| 4 | Focal length 18–135 mm | `FocalSlider`, presets; e2e `02-focal` |
| 5 | Real perspective-camera projection | `engine/__tests__/optics.test.ts` (matches `PerspectiveCamera.setFocalLength`), `rig.test.ts` (matches `Vector3.project`) |
| 6 | Animated frustum represents the FOV | `renderer/stage/tech/CameraRig.tsx` (`Frustum` from `frustumCornersAtDistance`); e2e `06-cross-view` |
| 7 | Distance via slider and direct manipulation | `DistanceSlider`; e2e `04-drag-dolly` |
| 8 | Fixed vs Match visibly different | e2e `03-mode-moves-camera`; `docs/screenshots/*/04-match-24mm.png` vs `05-match-85mm.png` |
| 9 | Focal effects vs position effects | `teachingConfigs.test.ts` (Fixed: same face ratio and perspective class at every lens); concept copy |
| 10 | Animation synchronized across views | single clock; e2e `06-cross-view` |
| 11 | Pause and compare | e2e `05-pause-compare` |
| 12 | Three exercises tracking real state | `lessons/LessonEngine.test.ts`; e2e `07-exercises` |
| 13 | Copy / export a camera setup | `engine/__tests__/export.test.ts`; e2e `09-export`; `docs/shot-settings.md` |
| 14 | Lab registry, future labs unavailable | `labs/registry.test.ts`; e2e `01-home` (concept cards not links, real 404s) |
| 15 | Smooth, polished controls | eased presentation (`renderer/runtime/presentation.ts`); e2e `10-keys`, `11-reduced-motion` |
