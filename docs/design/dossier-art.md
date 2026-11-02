> **INPUT — superseded by the implementation and `docs/design/decisions.md` wherever they differ. Do not copy numbers from here.**

## Art direction, animated scene, characters, camera rig, and UI visual system

### Summary
The Lens & Framing Lab is staged as "Lamplighter's Square": a crafted miniature night set (warm plaster, oxblood brick, teal door, brass lanterns) sitting on a graphite-navy stage plate with ruler strips, surrounded by restrained studio dressing (rail dolly, C-stand, apple boxes, cable) that only the observer sees. Two procedural puppets, Bram (1.78 m lamplighter, 0.16 m nose, heavy brow, mustache) and Pip (1.05 m kid in a yellow raincoat), perform a 6 s loop authored in a typed keyframe DSL sampled from one shared timeline so every view is frame-identical. Materials are satin MeshStandardMaterial (not toon ramps, which would flatten the very facial relief the 24-vs-85 comparison must show) plus thin inverted-hull outlines, under a key/rim/hemisphere/Lightformer rig with PCF shadows, N8AO, emissive-only bloom and ACES. The single lit accent is the cyan frustum with a 16:9 target rectangle and additive fill; measurements are wires between terminal dots with in-scene pills. The set geometry is tuned so four configurations read unambiguously: 24 fixed (whole square, tiny door, clock tower revealed), 85 fixed (Bram alone, Pip pushed out of frame), 24 matched at 1.0 m (nose +23 % vs ears, door small), 85 matched at 3.56 m (door/tower 1.9-2.4x larger behind him). The UI is an original dark-glass system on Instrument Sans + JetBrains Mono with color-coded variables (cyan focal, amber distance, mint subject size), a 40 % director's monitor with DOM-drawn guides, a log-scaled focal slider with prime ticks, a shot-size-banded distance slider, a 6 s timeline with freeze-frame markers, a round-robin live filmstrip, and a cancellable 20 s cinematic intro. Meshy is not needed; an optional ornate lantern via fal-ai/meshy/v7.1/text-to-3d is specified with a procedural fallback and a <= $4 budget.

### Key decisions
- **Character material model**: Satin MeshStandardMaterial (roughness 0.5-0.9, metalness 0, envMapIntensity 0.35) + drei Outlines inverted hull (0.004-0.006 m) for characters; MeshPhysicalMaterial only for lens glass and brass.
  - why: MeshToonMaterial has no envMap input (verified in r187 source), so characters would ignore the Lightformer environment and look pasted in; a 3-step ramp also flattens nose/brow relief and soft key shadows, which are exactly what the 24-vs-85 perspective comparison must make visible. Outlines + flat albedo + consistent bevels deliver the toon read without losing form.
  - alternatives: MeshToonMaterial with 3/5-step gradientMap (NearestFilter); custom onBeforeCompile ramp; MeshPhysicalMaterial sheen everywhere (too costly for ~70 character meshes x 2 roots).
- **Coordinate frame and set layout**: Three.js Y-up meters; film camera pinhole default at (0, 1.30, 0) looking -Z (zero rotation); set at negative Z: lantern z=-1.6, Bram (-0.35,0,-3.0), door flat z=-5.0 with opening x 0.45..1.15, Pip final (0.72,0,-4.7), back wall z=-9.0, tower z=-11.5, backdrop z=-12.4; dolly rail along x=0, z in [-2.7, +3.0].
  - why: Default camera orientation keeps screen-right = +X (no mental flips), distances are -z, and the rulers read positive from the default film plane. Positions were checked against frame widths (Z*36/f) in all four teaching configurations so the doorway is in frame at 50 mm, cut at 85 fixed, small at 24 matched and looming at 85 matched.
  - alternatives: Camera looking +Z with rotation.y=PI (screen-right becomes -X, confusing); doorway further right at x 0.9-1.7 (fell out of frame at 85 mm matched, killing the compression lesson).
- **Framing box used for Match mode (primary)**: Primary framing box = head+shoulders, y 1.08..1.86 (S = 0.78 m), anchor y 1.47; lesson 2 preset is 50 mm at 2.09 m (F = 0.92) so matched 24 mm lands at 1.00 m and 85 mm at 3.56 m. Landing state is 50 mm at 3.00 m (64 % of frame).
  - why: Reproduces the brief's expected camera positions (~1 m at 24, ~3-3.6 m at 85) with Z = S*f/(F*20.25), and 1.0 m gives a 23 % nose-vs-ear magnification difference that is obvious; 3.0 m default keeps Pip visible at 50 mm for the relationship read.
  - alternatives: Full-body box (1.78 m) - too far for face lesson; fixed F across all lessons - breaks either the landing wide read or the close-up.
- **Two views rendering approach (UI-facing requirement)**: Design the MonitorPanel and swap around two sibling surfaces each hosting a renderer root (preferred: two R3F Canvases mounting the same <World role> component; the film Canvas runs frameloop='never' and is advanced from the stage root after the shared timeline tick so both read the identical t). DOM/SVG overlays (thirds, safe areas, chips) are drawn on top so they stay crisp regardless of renderer choice.
  - why: drei View (verified source) shares one scene via scissor but has no post-processing awareness, and the stage needs N8AO/bloom/vignette while the monitor needs a clean film grade; two roots give independent post stacks, DPR and crisp output. Determinism comes from a single timeline singleton, not from per-root clocks.
  - alternatives: drei View x2 in one Canvas (post stack conflict); RenderTexture FBO shown on a quad (resolution-bound, not crisp when swapped to primary); manual scissor loop with one composer (fragile).
- **Shadow technique**: Canvas shadows={{ type: THREE.PCFShadowMap }} with key light shadow.radius 3, mapSize 2048, normalBias 0.03, plus N8AO for contact darkening; drei SoftShadows (PCSS) behind a quality flag; ContactShadows off by default (quality toggle).
  - why: three r187 constants.js marks PCFSoftShadowMap deprecated since r186; SoftShadows rewrites the shadowmap chunk and may force Basic shadow type, risky across two roots; ContactShadows is a full extra depth pass per frame and ignores lights.
  - alternatives: VSMShadowMap (light leaking on thin capsules); AccumulativeShadows (static-only unless temporal; characters move every frame).
- **Post-processing stack**: Both roots: N8AO (aoRadius 0.4, distanceFalloff 0.6, intensity 1.4, quality 'medium', halfRes, color #0A0D14) -> Bloom (luminanceThreshold 1.0, mipmapBlur, intensity 0.45, radius 0.55, levels 6) -> Vignette (stage 0.30/0.50, monitor 0.38/0.42) -> ToneMapping ACES_FILMIC; EffectComposer default multisampling 4 (no SMAA).
  - why: AO is what makes rounded primitives read as objects on a floor; bloom is restricted to emissives (lamps, window, frustum line, REC dot) by keeping scene colors <= 1 and setting toneMapped=false only on glowing materials (verified react-postprocessing Bloom docs); vignette sells the 'film' frame; MSAA default avoids SMAA's Suspense dependency.
  - alternatives: SSAO (older, noisier), no AO (flat), chromatic aberration/noise (gimmicky, hurts measurement precision), AgX (brief fixes ACES).
- **Fog**: No global scene fog; depth comes from the backdrop gradient, AO, rim light and lamp falloff.
  - why: Distance-based fog would haze the whole set when the observer orbits far away and would tint the monitor image differently per focal/distance, confusing the teaching that only position changes perspective.
  - alternatives: THREE.Fog near 10 far 26 (set desaturates for far observer), FogExp2 0.045.
- **Typography**: Instrument Sans (variable wght 400-700, wdth 75-100, italic) for UI via next/font/google with axes ['wdth'], JetBrains Mono (variable 100-800) for values; CSS vars --font-ui / --font-mono mapped in @theme inline.
  - why: Both verified present in Next's bundled font-data.json. Instrument Sans has a width axis (condensed small-caps labels) and italics; JetBrains Mono has distinct 0/O, tabular digits by nature and a weight range wide enough for 22 px display numerals. Avoids Geist (template default) and PoF's Outfit/DM Mono.
  - alternatives: Manrope + IBM Plex Mono (Manrope has no italic; Plex Mono static weights only), Geist + Geist Mono (reads as a Vercel template).
- **Studio vs set visibility**: <World role='stage'|'film'> mounts <Set/>, <Characters/>, <Lighting/> in both roots and <Studio/> (rig, rail, dressing, rulers, frustum, indicators, pills) only in the stage root; studio dressing is placed outside the 18 mm frustum at the default position so it can only enter the shot when the user dollies back on a wide lens.
  - why: The rail runs ahead of the camera and would peek into the bottom of wide shots; gear outside the wide frame is also how real crews work and becomes a teachable edge case rather than a bug.
  - alternatives: Object layers (needed only if a shared-canvas renderer is chosen; documented as the fallback).
- **Filmstrip live thumbnails**: Round-robin refresh: one 192x108 FBO render per 8 frames rotating through the 6 presets (each tile ~7.5 Hz at 60 fps), pixels read back into a 2D canvas tile; tiles honor the current mode (fixed: same position; match: each preset's matched position) and the shared timeline t.
  - why: Six full extra scene renders per frame would roughly quadruple draw calls; 7.5 Hz per tile still reads as live and stays honest (same scene, same t, real projection).
  - alternatives: Static pre-rendered thumbnails (stale vs animation/mode), six drei Views (needs shared canvas).
- **Meshy usage**: Default: no generated assets. Optional single candidate: ornate street lantern via fal-ai/meshy/v7.1/text-to-3d (mode 'full', model_type 'standard', topology 'quad', target_polycount 12000, enable_pbr true), max 3 attempts (~$3.6 at the brief's $1.20 ceiling), meshopt-compressed, loaded with drei useGLTF behind Suspense with the procedural lantern as fallback.
  - why: Architecture, boxes, lathes and capsules cover everything else well; only ornate ironwork would gain from generation, and the fallback keeps the app complete without it.
  - alternatives: Generating the doorway flat (procedural extrude with holes is better and editable), generating characters (forbidden).
- **Idle and intro motion**: Cancellable 20 s intro (observer glide, scripted 50->24->85->50 fixed sweep, then Match on with dolly travel, hint pills), idle observer drift 1.5 deg/s after 1.4 s of no input, paused on input, resumes after 3.6 s; prefers-reduced-motion disables intro/drift and sets damping smoothTime to 0 (dolly jumps).
  - why: Delivers the 'first 30 seconds' moment; the drift affects only the observer camera, never the shot, so it does not interfere with reading or comparing.
  - alternatives: Autoplay demo loop that keeps changing lenses (fights the user), no intro (weak first impression).

### Verified API facts
- three r187 PerspectiveCamera: fov is vertical degrees; setFocalLength(f) sets fov = 2*atan(0.5*getFilmHeight()/f) and calls updateProjectionMatrix(); getFilmHeight() = filmGauge / max(aspect, 1); filmGauge default 35 — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/cameras/PerspectiveCamera.js
- three r187 constants: PCFSoftShadowMap (2) deprecated since r186 (use PCFShadowMap 1); ACESFilmicToneMapping = 4, AgX = 6, Neutral = 7; NearestFilter 1003 — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/constants.js
- three r187 MeshToonMaterial: gradientMap requires NearestFilter min/mag and NoColorSpace; the material defines no envMap property — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/materials/MeshToonMaterial.js
- three r187 CapsuleGeometry(radius=1, height=1 [middle section], capSegments=4, radialSegments=8, heightSegments=1); LatheGeometry(points [x>0], segments=12, phiStart=0, phiLength=2PI) rotates around Y — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/geometries/CapsuleGeometry.js and .../LatheGeometry.js
- three r187 LineMaterial: linewidth in CSS pixels unless worldUnits=true; resolution Vector2 must be kept updated; dashed/dashScale/dashSize/gapSize/dashOffset; alphaToCoverage — https://raw.githubusercontent.com/mrdoob/three.js/r187/examples/jsm/lines/LineMaterial.js
- R3F 9 Canvas props: gl (options/instance/factory), shadows (true=PCFsoft | 'basic'|'percentage'|'soft'|'variance' | shadowMap props object), dpr [1,2] default, frameloop always|demand|never, flat (NoToneMapping), linear, eventSource, onCreated; defaults ACESFilmic + SRGB output — https://r3f.docs.pmnd.rs/api/canvas
- R3F useFrame((state, delta), renderPriority): positive priority takes over rendering; callbacks run in ascending priority; negative indices do not take over; never setState inside; state.advance exists for frameloop='never' — https://r3f.docs.pmnd.rs/api/hooks
- R3F installation: add 'three' to next.config transpilePackages for untranspiled ecosystem add-ons; fiber@9 pairs with react@19 — https://r3f.docs.pmnd.rs/getting-started/installation
- drei shapes.tsx exports Capsule (CapsuleGeometry), Lathe, Extrude, Sphere, Cylinder, Torus, Ring, Circle, Plane etc.; args forwarded to the geometry constructor — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/shapes.tsx
- drei RoundedBox defaults: args [1,1,1], radius 0.05, smoothness 4, bevelSegments 4, steps 1, creaseAngle 0.4; built from ExtrudeGeometry + toCreasedNormals; children = materials — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/RoundedBox.tsx
- drei Line: points, vertexColors, lineWidth (px default; linewidth takes precedence), segments, dashed; resolution set from useThree size; built on three-stdlib Line2/LineSegments2/LineMaterial — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/Line.tsx and docs/shapes/line.mdx
- drei Edges: based on Line, threshold default 15 deg, linewidth, scale, geometry — https://raw.githubusercontent.com/pmndrs/drei/master/docs/abstractions/edges.mdx
- drei Outlines: inverted hull; color black, screenspace false, opacity 1, transparent false, thickness 0.05, angle PI defaults; parent must be mesh/skinnedMesh/instancedMesh — https://raw.githubusercontent.com/pmndrs/drei/master/docs/abstractions/outlines.mdx
- drei Environment: background false|true|'only', backgroundBlurriness, environmentIntensity, environmentRotation, files/path/preset (apartment, city, dawn, forest, lobby, night, park, studio, sunset, warehouse), scene, children rendered into the env scene — https://raw.githubusercontent.com/pmndrs/drei/master/docs/staging/environment.mdx
- drei Lightformer (LightProps): form 'circle'|'ring'|'rect'|'plane'|'box' default rect, intensity 1, color white, scale 1, target [0,0,0] via lookAt unless rotation set, toneMapped false, meshBasicMaterial DoubleSide with color multiplied by intensity — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/Lightformer.tsx
- drei ContactShadows defaults: scale 10, frames Infinity, opacity 1, blur 1, near 0, far 10, resolution 512, smooth true, color #000000, depthWrite false; depth-pass based, ignores scene lights — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/ContactShadows.tsx
- drei SoftShadows (src/core/softShadows.tsx): size 25, samples 10, focus 0; injects PCSS into ShaderChunk.shadowmap_pars_fragment, may switch shadow type to Basic, recompiles materials — https://github.com/pmndrs/drei/blob/master/src/core/softShadows.tsx
- drei AccumulativeShadows defaults frames 40, blend 20, scale 10, opacity 1, alphaTest 0.75, resolution 1024, temporal falsy; RandomizedLight amount 8, radius 1, ambient 0.5, mapSize 512 — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/AccumulativeShadows.tsx
- drei Html: as, wrapperClass, prepend, center, fullscreen, distanceFactor, zIndexRange default [16777271, 0], portal, transform, sprite, calculatePosition, occlude true|'blending'|refs, onOcclude, material/geometry for blending — https://raw.githubusercontent.com/pmndrs/drei/master/docs/misc/html.mdx
- drei Text: troika SDF text, suspense-based; pass font URL and characters to avoid FOUC — https://raw.githubusercontent.com/pmndrs/drei/master/docs/abstractions/text.mdx
- drei useGLTF(path, useDraco=true (gstatic CDN decoders), useMeshOpt=true, extendLoader); useGLTF.preload, useGLTF.setDecoderPath — https://raw.githubusercontent.com/pmndrs/drei/master/docs/loaders/gltf-use-gltf.mdx
- drei CameraControls props: makeDefault, camera, domElement, impl, events onControlStart/onControl/onControlEnd/onTransitionStart/onUpdate/onWake/onRest/onSleep, mouseButtons/touches ACTION — https://raw.githubusercontent.com/pmndrs/drei/master/docs/controls/camera-controls.mdx
- camera-controls (yomotsu): setLookAt(px,py,pz,tx,ty,tz,enableTransition), lerpLookAt, dollyTo, rotateTo, truck, fitToBox, fitToSphere, saveState/reset; smoothTime 0.25, draggingSmoothTime 0.125; min/maxDistance, min/maxPolarAngle, boundaryEnclosesCamera, dollyToCursor; update(delta) in the tick loop; events controlstart/control/controlend/transitionstart/update/wake/rest/sleep — https://github.com/yomotsu/camera-controls
- drei PerspectiveCamera: makeDefault, manual (stops responsive aspect), frames, resolution 256, envMap, render-function children receive an FBO texture — https://raw.githubusercontent.com/pmndrs/drei/master/docs/cameras/perspective-camera.mdx
- drei RenderTexture: width/height default viewport, samples, stencilBuffer false, depthBuffer true, generateMipmaps false, renderPriority 0, eventPriority 0, frames Infinity, compute; attach='map' — https://raw.githubusercontent.com/pmndrs/drei/master/docs/portals/render-texture.mdx
- drei View (src/web/View.tsx): scissor/viewport per tracked div, useFrame at index (default 1), camera from parent state with aspect set per view, frames caches getBoundingClientRect, View.Port outputs tunneled views, track prop deprecated; no post-processing awareness in source — https://raw.githubusercontent.com/pmndrs/drei/master/src/web/View.tsx
- drei Grid: cellSize 0.5, cellThickness 0.5, cellColor black, sectionSize 1, sectionThickness 1, sectionColor #2080ff, followCamera false, infiniteGrid false, fadeDistance 100, fadeStrength 1, fadeFrom 1 — https://raw.githubusercontent.com/pmndrs/drei/master/docs/gizmos/grid.mdx
- @react-three/postprocessing exports EffectComposer, Selection, Bloom, SelectiveBloom, Vignette, SMAA, FXAA, SSAO, ToneMapping, Noise, ChromaticAberration, Outline, HueSaturation, BrightnessContrast, DepthOfField, LUT, N8AO (passes/N8AO) — https://raw.githubusercontent.com/pmndrs/react-postprocessing/master/src/index.ts
- react-postprocessing EffectComposer props: enabled, depthBuffer, enableNormalPass, stencilBuffer, autoClear, resolutionScale, multisampling (default 4), frameBufferType, renderPriority, camera, scene — https://react-postprocessing.docs.pmnd.rs/effect-composer
- react-postprocessing N8AO wrapper: imports N8AOPostPass from 'n8ao'; props enabled, aoRadius 5, distanceFalloff 1, intensity 1, quality 'performance'|'low'|'medium'|'high'|'ultra' (setQualityMode), aoSamples 16, denoiseSamples 4, denoiseRadius 12, color, halfRes, depthAwareUpsampling true, screenSpaceRadius, renderMode 0 — https://raw.githubusercontent.com/pmndrs/react-postprocessing/master/src/passes/N8AO.tsx
- n8ao README: npm install n8ao; aoRadius in world units, should be 1-2 magnitudes below scene scale (10-unit scene -> 0.1-1); quality presets Performance 8/4/12, Low 16/4/12, Medium 16/8/12, High 64/8/6, Ultra 64/16/6; gammaCorrection auto for N8AOPostPass — https://github.com/N8python/n8ao
- react-postprocessing Bloom defaults: luminanceThreshold 0.9, luminanceSmoothing 0.025, intensity 1, mipmapBlur true, radius 0.85, levels 8, kernelSize LARGE; selective via material colors > 1 with toneMapped=false — https://react-postprocessing.docs.pmnd.rs/effects/bloom
- react-postprocessing Vignette defaults offset 0.5, darkness 0.5, eskil deprecated (technique), blendFunction NORMAL — https://react-postprocessing.docs.pmnd.rs/effects/vignette
- react-postprocessing SMAA: preset MEDIUM default, needs Suspense; MSAA via EffectComposer multisampling is the default AA — https://react-postprocessing.docs.pmnd.rs/effects/smaa
- postprocessing ToneMappingMode: LINEAR 0, REINHARD 1, REINHARD2 2, REINHARD2_ADAPTIVE 3, UNCHARTED2 4, CINEON 5, ACES_FILMIC 6, AGX 7, NEUTRAL 8 — https://raw.githubusercontent.com/pmndrs/postprocessing/main/src/enums/ToneMappingMode.js
- maath 0.10.8 easing (dist/easing-*.esm.js): damp(current, prop, target, smoothTime=0.25, delta=0.01, maxSpeed=Infinity, easing=exp, eps=0.001) based on Game Programming Gems 4 ch. 1.10, velocity stored on current.__damp, returns true while animating; damp2/damp3/damp4/dampE(shortest angle)/dampC/dampQ/dampS/dampM/dampLookAt(current, target, smoothTime, delta, ...); easings linear, exp, rsqw, sine/cubic/quart/quint/circ/expo with in/out/inOut; no README in the tarball; npm latest = 0.10.8 — https://cdn.jsdelivr.net/npm/maath@0.10.8/dist/easing-0f4db1c0.esm.js and https://registry.npmjs.org/maath
- Next.js 16.4.3 local docs: next/dynamic ssr:false only works in Client Components (error in Server Components) — node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
- Next.js font API: weight 'variable' default for variable fonts, axes array for extra axes (e.g. wdth), subsets, display default 'swap', preload true, variable CSS var — node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md
- Next bundled Google font data: Instrument Sans (wght 400-700 variable, wdth 75-100, italic), JetBrains Mono (wght 100-800 variable, italic), Manrope (no italic), IBM Plex Mono (static weights), Geist/Geist Mono present; Outfit and DM Mono present (avoided) — node_modules/next/dist/compiled/@next/font/dist/google/font-data.json
- Tailwind v4 @theme: --color-*, --font-*, --radius-*, --shadow-*, --spacing, --ease-*, --animate-* namespaces generate utilities; @theme inline for variables referencing other variables; theme vars usable as var(--color-...) — https://tailwindcss.com/docs/theme
- fal.ai Meshy 7.1 endpoints: fal-ai/meshy/v7.1/text-to-3d (prompt <= 600, mode preview|full, model_type standard|lowpoly|smart-topology|smart-topology-t2, topology quad|triangle, target_polycount 100-300000 default 30000, should_remesh true, symmetry_mode auto, enable_pbr false, pose_mode, texture_prompt, texture_image_url, geometry_resolution standard|2k|4k, seed, enable_safety_checker) and fal-ai/meshy/v7.1/image-to-3d (image_url, should_texture, same mesh controls); output model_glb, model_urls{glb,fbx,obj,usdz,blend,stl}, texture_urls[{base_color,metallic,normal,roughness}], thumbnail — https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/meshy/v7.1/text-to-3d and ...v7.1/image-to-3d
- Meshy official text-to-3d parameters: ai_model meshy-7.1 (alias latest), topology applies only with should_remesh, pose_mode a-pose|t-pose|'', enable_pbr refine-only, texture_prompt <= 800, art_style and symmetry_mode deprecated — https://docs.meshy.ai/en/api/text-to-3d
- gltf-transform CLI optimize: --compress draco|meshopt|quantize|false (default meshopt), --texture-compress ktx2|webp|avif|auto|false (default auto), --texture-size 2048 default, --simplify, --weld, --prune, --flatten, --join, --instance, --palette; resize --width/--height; draco --method edgebreaker|sequential; meshopt --level medium|high — https://raw.githubusercontent.com/donmccurdy/glTF-Transform/main/packages/cli/src/cli.ts and https://gltf-transform.dev/cli
- Plane of Focus (idea-level only): calm workshop tone, live readout chips, one-idea captions, compact panel with keyboard hints, in-scene presets as labels, direct drag on the lens ring, keyboard map, physical-assumption footnote (50 mm full-frame) — https://sael.net/plane-of-focus/

### Plan
# Lens & Framing Lab — Art, Scene, Characters, Rig and UI Visual System

All units: meters, seconds, degrees. Colors are tokens (CSS custom properties in `src/design/tokens.css` via Tailwind v4 `@theme`, mirrored as a typed object in `src/design/tokens.ts` for three.js materials so there is one source of truth). Repo state: create-next-app 16.4.3 scaffold already exists at `/Users/gg/w/animation-lab` (React 19.3.0, Tailwind v4 via `@tailwindcss/turbopack`, `@/* -> ./src/*`, ESLint 9 flat config, Geist fonts in `src/app/layout.tsx`, `.gitignore` ignores `.env*`). R3F/drei/three/zustand/maath/postprocessing are not installed yet.

---

## 1. Art direction — "Night Stage / Lamplighter's Square"

### 1.1 Identity in one paragraph
A dark graphite-navy sound stage holding a warm, hand-built miniature of a small-town square at night. The only cool, luminous things are the instruments: the cyan frustum, the measurement wires, the ruler ticks. Everything the film camera sees is warm (plaster, brick, lamplight, a yellow raincoat); everything the observer adds is cool, thin and precise. Original identity; Plane of Focus is referenced only for the *feel* of calm precision, color-coded variables and "every variable settable three ways".

### 1.2 Palette tokens
Stage and UI neutrals
- `--color-stage-void: #07090E` (renderer clear color, home background)
- `--color-stage-floor: #141922`, `--color-stage-floor-edge: #1C2330`, `--color-stage-wall: #0F131B`, `--color-stage-backdrop-top: #1A2230`
- `--color-ink-0: #F2F5F9` (primary text), `--color-ink-1: #B9C2CF`, `--color-ink-2: #7C8796` (labels), `--color-ink-3: #4A5465` (hairlines, minor ticks)
- `--color-glass: rgb(14 18 26 / 0.62)`, `--color-glass-border: rgb(255 255 255 / 0.08)`, `--color-glass-hi: rgb(255 255 255 / 0.14)`

Accents (one per teaching variable; used identically in 3D, chips and caption spans)
- `--color-accent-focal: #5FE3FF` (cyan: focal length / FOV / frustum / active control)
- `--color-accent-distance: #FFB547` (amber: camera distance / selection / hover / rail end)
- `--color-accent-subject: #8EF0C3` (mint: subject size % / framing target indicator)
- dims: `--color-accent-focal-dim: rgb(95 227 255 / 0.35)`, `--color-accent-distance-dim: rgb(255 181 71 / 0.35)`
- status: `--color-ok: #7CE0A6`, `--color-danger: #FF6B6B`

Set
- `--color-set-plaster: #D9C9B0`, `--color-set-plaster-shade: #B8A68C`, `--color-set-brick: #8C4E3C`, `--color-set-wood: #6E4B2E`, `--color-set-teal: #2B6F72`, `--color-set-stone: #6F6A62`, `--color-set-roof: #3A3F4A`
- practicals: `--color-lamp-warm: #FFB46A` (emissive base, intensity 2.5-3 with toneMapped=false), `--color-window-glow: #FFC98A`

Characters
- Bram: skin `#F0C3A0`, nose/cheeks `#E8A98A`, coat `#C8552F`, scarf `#F4E9D8`, trousers `#2F3A4A`, shoes `#3B2A20`, cap/brows `#2A2321`, mustache `#3B2F2A`, outline `#3A1F14`
- Pip: skin `#F7D9C2`, raincoat/hat `#F2C14E`, hat band `#E0B040`, boots `#2F6F73`, hair `#7A3B22`, outline `#4A3A14`
- eyes: white `#FBFBF6`, pupil `#17120F`, highlight emissive `#FFFFFF` x1.2

Studio hardware
- gunmetal `#2B2F36`, rubber `#141414`, brass `#B8893A`, aluminum `#9AA3AD`, sandbag canvas `#3B3A33`, flag fabric `#0C0C0E`

### 1.3 Materials (recommendation: satin PBR, not toon)
- Characters: `MeshStandardMaterial`, flat albedo from tokens, no textures. Skin roughness 0.55; cloth 0.85-0.9; raincoat 0.45 (slightly glossy); boots/shoes 0.35; brass buttons metalness 0.9 roughness 0.3. `envMapIntensity 0.35`. drei `<Outlines>` on each character group's meshes: Bram thickness 0.006, Pip 0.004, color = character outline token, `screenspace={false}` (world units so outlines thin with distance, which keeps the 85 mm close-up clean), opacity 0.9.
- Why not `MeshToonMaterial`: r187 source has no `envMap` property on it (verified), so puppets would not pick up the Lightformer environment; a stepped ramp hides the nose/brow shading gradient that makes perspective distortion legible; `gradientMap` also forces NearestFilter/NoColorSpace handling. Toon read is achieved instead by flat colors, big simple masses, consistent bevels and outlines.
- Set: `MeshStandardMaterial` matte (plaster 0.95, brick 0.9, wood 0.7, teal paint 0.6). Window glass: `meshBasicMaterial` color `#FFC98A` scaled x1.6, `toneMapped={false}` (bloom source) behind a mullion grid.
- Studio hardware: gunmetal metalness 0.85 roughness 0.45; aluminum rail 0.9/0.35; rubber 0/0.95; brass `MeshPhysicalMaterial` clearcoat 0.3.
- Lens front element: `MeshPhysicalMaterial` color `#06101C`, roughness 0.06, clearcoat 1, clearcoatRoughness 0.05, envMapIntensity 1.6; a 0.9-radius front disc with emissive `#4FA9FF` x0.25 for the coating glint.

### 1.4 Lighting rig (both roots mount the same `<StageLighting/>`)
- Key: `directionalLight` color `#FFE2C2`, intensity 2.4, position (-3.5, 5.5, 2.0) targeting (0, 1.2, -3.5); castShadow, `shadow-mapSize [2048,2048]`, ortho frustum left -6 right 6 top 6 bottom -4, near 1 far 24, bias -0.0004, normalBias 0.03, radius 3. Camera-left-front-high so Bram's nose casts a readable shadow across the cheek.
- Fill: `hemisphereLight` sky `#3A4C66`, ground `#1A1410`, intensity 0.6.
- Rim/kicker: `spotLight` color `#BFE8FF`, intensity 25, position (4.0, 4.5, -8.0) targeting Bram's head (-0.35, 1.6, -3.0), angle 0.5, penumbra 0.6, no shadow. Separates both characters from the dark backdrop.
- Practicals: `pointLight` `#FFB46A` intensity 6, distance 6, decay 2 at the lantern head (0.62, 2.05, -1.6) and at the doorway lamp (1.35, 2.5, -4.85); bulbs are emissive spheres (x3, toneMapped=false) so bloom catches them.
- Environment: drei `<Environment resolution={256} frames={1} environmentIntensity={0.6}>` with Lightformers (verified props: form, intensity, color, scale, target, toneMapped=false default): overhead rect scale [6,3] intensity 1.2 color `#FFF4E6` position [0,6,-2] target [0,1,-4]; cool strip rect scale [1,5] intensity 0.8 color `#9FD6FF` position [6,3,-6]; warm low strip rect scale [4,1] intensity 0.6 color `#FFC08A` position [-6,1,-4]; floor bounce rect scale [10,10] intensity 0.15 color `#2A3140` position [0,-1,-4] rotation [Math.PI/2,0,0]. `background={false}`.
- Shadows: Canvas `shadows={{ type: THREE.PCFShadowMap }}` (PCFSoftShadowMap is deprecated since r186 per r187 constants.js). Optional quality flag `quality.pcss` mounts drei `<SoftShadows size={18} samples={10} focus={0.4}/>` (verified defaults 25/10/0). `ContactShadows` (defaults verified: opacity 1, blur 1, far 10, resolution 512, frames Infinity) is a quality toggle only: `opacity 0.5 scale [12,16] blur 1.6 far 1.2 resolution 512 color #000`.
- Tone mapping/exposure: ACES filmic via the post stack's `ToneMapping mode={ToneMappingMode.ACES_FILMIC}` (postprocessing enum value 6 verified); renderer `toneMappingExposure 1.0`; Canvas `gl={{ antialias: false, powerPreference: 'high-performance' }}` with EffectComposer MSAA 4 (default).
- Fog: none (see decisions). Backdrop gradient supplies atmosphere.

### 1.5 Post-processing (per root)
Order: `N8AO` -> `Bloom` -> `Vignette` -> `ToneMapping`.
- N8AO (react-postprocessing wrapper verified: defaults aoRadius 5, aoSamples 16, denoiseSamples 4, denoiseRadius 12, distanceFalloff 1, intensity 1; `quality` applies `setQualityMode`): `aoRadius 0.4`, `distanceFalloff 0.6`, `intensity 1.4`, `quality="medium"`, `halfRes`, `color="#0A0D14"`. n8ao README: radius should be 1-2 magnitudes below scene scale (our set is ~14 m -> 0.4).
- Bloom (verified defaults threshold 0.9, smoothing 0.025, mipmapBlur true, radius 0.85, levels 8): `luminanceThreshold 1.0`, `luminanceSmoothing 0.1`, `intensity 0.45`, `radius 0.55`, `levels 6`. Only toneMapped=false emissives (lamps, window, frustum line, REC dot, pill dots) exceed 1.
- Vignette (defaults 0.5/0.5): stage `offset 0.30 darkness 0.50`; monitor `offset 0.38 darkness 0.42`.
- No SMAA, no noise, no chromatic aberration (measurement lines must stay exact).

### 1.6 What makes it a crafted miniature set, not a tech demo
- Stage plate: 12 x 16 m slab (x from -6 to 6, z from -12.5 to 3.5), 0.12 m thick, 0.03 m chamfer (drei `RoundedBox args=[12,0.12,16] radius={0.03} smoothness={2}`), floor token, roughness 0.9. The top edge of the chamfer catches the rim light.
- Ruler strips (Anatomy principle: rulers on the plate edges, zero at the film plane): two 0.30 m strips along x = +/-5.75, z from -12.0 to +3.0, color `#1C2330`. Ticks are one merged `LineSegments` (thin, no Line2 cost): minor every 0.1 m, 0.06 m long, ink-3; major every 1 m, 0.18 m long, focal-dim cyan; numerals every 1 m (drei `Text`, 0.12 m, JetBrains Mono woff from `/fonts`, `characters="0123456789-m"`, ink-2) reading 0 at z = 0 (default film plane) and increasing toward the set (label = -z). A short transverse ruler on the front edge (z = +3.3) from x -3 to 3, zero at x = 0.
- Backdrop flat: 16 x 7 m plane at z = -12.4, vertical gradient `#0F131B` (floor) -> `#1A2230` (4 m) -> `#0B0E14` (top) via vertex colors, plus a 0.25 m wide "cyc" cove (quarter-cylinder, r 0.25) where it meets the floor.
- Studio dressing (stage root only, all outside the 18 mm frustum from the default camera): C-stand with 0.6 x 0.9 m flag at (-2.4, 0, -1.2); studio key lamp (fresnel head 0.3 m dia on a 3.2 m stand) at (-3.0, 0, -1.0) aimed at Bram; two apple boxes (0.50 x 0.20 x 0.30 and 0.50 x 0.10 x 0.30) stacked at (3.2, 0, -2.4); sandbag on the C-stand base; a slate leaning on the boxes; a coiled cable loop at (-1.6, 0.02, 1.4) and the dolly cable (CatmullRom tube r 0.008) from the camera body down the column to a floor box (0.20 x 0.08 x 0.14) at (-1.6, 0, 1.4).
- Edge treatment: every box in the scene is a RoundedBox with radius 0.02 (set/characters) or 0.01-0.015 (hardware), never a sharp BoxGeometry.

### 1.7 The single lit accent: frustum, target indicator, measurement wires, pills
- Frustum (stage root): origin at the pinhole. Edges: drei `<Line>` (Line2, `lineWidth` in CSS px verified) 1.5 px, color `[0.37, 0.89, 1.0]` x1.5 with `toneMapped={false}` so bloom halos it, opacity 0.9 from the near rectangle (0.15 m) to the target plane; beyond the target plane the same four edges continue `dashed dashSize 0.12 gapSize 0.08` opacity 0.25 to min(12 m, backdrop). Faces: four triangles near->target as `meshBasicMaterial color #5FE3FF transparent opacity 0.05 depthWrite={false} blending={AdditiveBlending} side={DoubleSide}`. Target rectangle: 16:9 frame at the target distance, 2 px, full cyan, corner ticks extended 0.08 m outward, center cross 0.06 m. On any focal change the edge opacity pulses 0.9 -> 1.0 -> 0.9 over 120 ms (nothing else moves).
- Framing-target indicator (mint): a 1 px vertical wire from the ground point under the target anchor to the top of the framing box, with 0.02 m emissive terminal spheres at both ends; a ground ring (RingGeometry 0.35-0.38 m) at the character's feet, opacity 0.6; for "Both" two wires plus a dotted baseline between the feet rings.
- Distance wire (cyan-dim): pinhole -> target anchor along the optical axis, 1 px, terminal dots, midpoint pill.
- In-scene pills (drei `Html` with `center`, no `distanceFactor` so they stay screen-constant, `zIndexRange={[20, 0]}`, `pointer-events: none` except the camera pill): (1) camera pill above the body: `● 50 mm · 39.6°`; (2) distance pill at the wire midpoint: `3.00 m`; (3) target pill 0.25 m above the box top: `Bram · head & shoulders · 64 %` (shown when the target toggle is on, on hover, or during a Match travel, else hidden); (4) rail-end pill `rail end · 3.0 m` when the engine clamps; (5) verb tooltip on rig hover: `Drag along the rail to dolly`. Pill style: glass, 22 px tall, radius 999, 11 px small-caps label + 12 px mono value, a 6 px dot in the variable's accent.

---

## 2. The set in meters

### 2.1 Conventions
Right-handed, Y up, meters. Film camera pinhole default `P0 = (0, 1.30, 0)`, zero rotation (looks -Z), gate 36 x 20.25 mm, 16:9. Screen-right = +X. Distance readout = -z of the target anchor minus camera z. Dolly rail along x = 0, y = 0 (wheels), camera travel z in `RIG.railBounds = [-2.7, +3.0]` (toward -z = dolly in). Observer default: position (5.2, 2.6, 2.0) looking at (-0.3, 1.1, -3.2).

### 2.2 Placement table
| Object | Position (x, y, z) | Size | Notes |
|---|---|---|---|
| Street lantern (fg prop) | (0.62, 0, -1.6) | post 2.20 tall, r 0.04; head 0.28 x 0.34 x 0.28; base lathe r 0.16 | glowing warm; practical light |
| Bram (primary) | (-0.35, 0, -3.0), rest yaw -8 | 1.78 tall | framing box y 1.08..1.86 (0.78 m), anchor (-0.35, 1.47, -3.0) |
| Midground flat with doorway | x 0.0..2.6, y 0..3.0, z = -5.0, thickness 0.18 | opening x 0.45..1.15, y 0..2.10, arched top r 0.35 | plaster, brick quoins, teal door leaf 0.68 x 2.05 x 0.05 hinged at x 1.15 opening toward +z (rotation.y +65 open); doorway lamp (brass, 0.12 r) at (1.35, 2.5, -4.85) |
| Pip (secondary) | hidden start (0.95, 0, -5.35); final (0.72, 0, -4.7) | 1.05 tall (1.12 with hat) | framing box y 0..1.12 at the FINAL position (static anchor) |
| Back wall | x -6..6, y 0..4.2, z = -9.0, thickness 0.3 | arched window 1.6 x 2.2 centered x -0.6, sill y 1.0 | window glows; window mullions 0.04; a cornice at 4.0 |
| Clock tower | (-2.2, 0, -11.5) | 1.6 x 1.6 footprint, 6.5 tall, pyramid roof to 7.4 | lit clock face r 0.5 at y 5.2 (emissive) |
| Backdrop + cove | z = -12.4 | 16 x 7 | gradient |
| Dolly rail | x 0, z from -3.0 to +3.3 (0.3 overhang each end) | tubes r 0.024 at x +/-0.31 | sleepers every 0.6 m, end stops |
| C-stand + flag | (-2.4, 0, -1.2) | flag 0.6 x 0.9 at 1.8 m | studio only |
| Studio key lamp | (-3.0, 0, -1.0) | head r 0.15 at 3.2 m | studio only |
| Apple boxes + slate | (3.2, 0, -2.4) | 0.5 x 0.3 footprint | studio only |
| Cable floor box | (-1.6, 0, 1.4) | 0.20 x 0.08 x 0.14 | studio only |

Frame width at distance Z is `Z*36/f`, height `Z*20.25/f`; the floor enters the frame at `Z >= 2.6*f/20.25` (camera height 1.30 aiming level), i.e. 3.1 m at 24 mm, so the rail end at z = -2.7 stays out of shot unless the camera dollies back on a wide lens (intended).

### 2.3 The four configurations (mental check, aim at Bram's anchor)
1. **24 mm fixed, 3.0 m** (frame at Bram 4.5 x 2.53): Bram full body with headroom (body = 70 % of frame height; box 31 %); lantern fully inside the right third (half-width at 1.6 m is 1.2); whole doorway flat and Pip's entrance; back wall window on the left, clock tower top just inside (frame height at 11.5 m = 9.7 m -> up to y 6.3, clock at 5.2). Viewer notices: the square, tiny doorway, tiny tower, small face.
2. **85 mm fixed, 3.0 m** (1.27 x 0.715): head and shoulders only (box 109 % -> crown clipped by ~3 cm unless anchored at 1.47, which fits 1.11..1.83; hair tuft trims, acceptable). Frame at z -5 spans x -1.31..0.61 -> door opening (0.45..1.15) is cut by the right edge; Pip at 0.72 is half in, half out -> "the 85 chooses Bram's reaction". Identical nose/ear ratio to (1): perspective unchanged.
3. **24 mm matched, camera at z -2.0 (1.0 m from the anchor)**: frame at Bram 1.5 x 0.84 (box 92 %); nose tip at ~0.86 m vs ear plane ~1.06 m -> nose 1.23x relative to ears, cheeks bulge, cap brim flares; frame at the door (3.0 m away) is 4.5 m wide -> door small and complete, Pip tiny; tower (9.5 m) in a 14 m wide frame -> a sliver. The camera has physically passed the lantern (z -1.6) on the rail: the stage view shows it travelling through the set.
4. **85 mm matched, camera at z +0.56 (3.56 m)**: same 1.51 m frame width at Bram, box 92 %; nose 1.06x -> flat, handsome; frame at the door (5.56 m) 2.35 m wide -> doorway and Pip appear ~1.9x larger relative to Bram than in (3); window halo sits directly behind his head (frame at the wall 4.05 m wide); tower 2.4x larger. The compression is visibly a *distance* effect because the chips read 3.56 m vs 1.00 m while the mm chip is the only control the user touched.
Adjustment already applied: the doorway was moved from x 0.9-1.7 to 0.45-1.15 so it survives configuration 4.

---

## 3. Characters — procedural puppets

Shared construction rules: masses from `Lathe` profiles (heads, torsos, hats) and `Capsule` (limbs; r187 `CapsuleGeometry(radius, height=middle section, capSegments, radialSegments)` verified), `RoundedBox` for planar parts (defaults radius 0.05 -> we pass 0.02/0.015, smoothness 4), `Sphere` only for eyes, cheeks, tips. Each part is a named `group` pivot with the mesh offset inside so keyframes rotate about joints. Asymmetry baked into rest pose. Bevel radius constant per character. Hands are mitts. No textures.

### 3.1 Bram — the lamplighter (primary), 1.78 m, 4.2 heads tall
Proportions: head 0.42 tall x 0.34 wide x 0.36 deep (egg, deeper than wide so the ears sit 0.22 behind the nose base); shoulders 0.60 wide; chest depth 0.36; waist 0.32; legs 0.82; arms 0.60; nose protrusion 0.16; brow ridge 0.05.
Pivots (rest, world-relative to root at feet): pelvis (0, 0.95, 0); torso (0, 1.05, 0); chest/collar (0, 1.40, 0); neck (0, 1.52, 0); head (0, 1.56, 0) [center 1.72]; cap (0, 1.90, 0); brow (0, 1.76, 0.15); nose (0, 1.70, 0.17); eyes (+/-0.075, 1.74, 0.14); ears (+/-0.17, 1.72, -0.03); mustache (0, 1.62, 0.16); shoulders (+/-0.26, 1.46, 0); elbows (+/-0.30, 1.20, 0.02); wrists (+/-0.31, 0.98, 0.06); hips (+/-0.12, 0.95, 0); knees (+/-0.12, 0.52, 0); ankles (+/-0.12, 0.10, 0.02).
Parts (44):
1 root (group) · 2 pelvis: Lathe profile [(0.17,0),(0.21,0.10),(0.19,0.18)] slate · 3 coatSkirt: Lathe [(0.22,0),(0.30,-0.22),(0.31,-0.26)] rust, hangs from the waist · 4 torso: Lathe [(0.19,0),(0.30,0.22),(0.32,0.38),(0.26,0.50),(0.14,0.54)] rust, scale z 0.78 · 5 collar: Torus r 0.19 tube 0.035 cream, scale (1,0.6,0.85) · 6 scarfKnot: Capsule r 0.05 h 0.06 cream, tilted 30 · 7 scarfTail: RoundedBox 0.08 x 0.24 x 0.03 r 0.02 cream · 8 neck: Cylinder r 0.085 h 0.09 skin · 9 head: Lathe egg [(0,0),(0.13,0.03),(0.17,0.16),(0.165,0.30),(0.12,0.39),(0,0.42)] skin, scale z 1.08 · 10 capDome: Lathe [(0,0),(0.20,0.02),(0.23,0.07),(0.21,0.11),(0,0.13)] cap, tilted rz 6 · 11 capBrim: RoundedBox 0.26 x 0.025 x 0.14 r 0.012 cap, pitched 8 down · 12 brow: RoundedBox 0.28 x 0.045 x 0.07 r 0.02 cap color, pitched 12 · 13 browTuftL / 14 browTuftR: Capsule r 0.018 h 0.05 (R 0.01 higher) · 15 noseBridge: Capsule r 0.045 h 0.09 along +z, nose color · 16 noseTip: Sphere r 0.055 at the end (total protrusion 0.16) · 17 cheekL / 18 cheekR: Sphere r 0.07 scale (1,0.8,0.7), nose color at 60 % blend · 19 mustacheL / 20 mustacheR: Capsule r 0.03 h 0.11, splayed 20, drooping 25 · 21 eyeL / 22 eyeR: Sphere r 0.045 white · 23 pupilL / 24 pupilR: Sphere r 0.02 pupil, at +0.035 z · 25 lidL / 26 lidR: Sphere r 0.047 phiLength PI (half shell) skin, rotation.x -80 open -> 0 closed · 27 earL / 28 earR: Sphere r 0.045 scale (0.55,1,0.9) skin · 29 upperArmL / 30 upperArmR: Capsule r 0.065 h 0.22 rust · 31 forearmL / 32 forearmR: Capsule r 0.055 h 0.22 rust, cuff Torus r 0.058 tube 0.012 cream · 33 handL / 34 handR: RoundedBox 0.09 x 0.11 x 0.05 r 0.025 skin · 35 thumbL / 36 thumbR: Capsule r 0.02 h 0.04 · 37 thighL / 38 thighR: Capsule r 0.09 h 0.26 slate · 39 shinL / 40 shinR: Capsule r 0.075 h 0.28 slate · 41 shoeL / 42 shoeR: RoundedBox 0.11 x 0.08 x 0.27 r 0.03 shoe, R turned out 10 · 43 buttons x3: Sphere r 0.015 brass on the coat center line · 44 lanternHook (small brass hook on the belt, silhouette detail).
Appeal: head/torso/pelvis read as big-medium-small from the camera (torso dominant = strength), nose is the biggest facial mass (perspective demo), cap and scarf overlap the head/neck seams, left tuft higher than right, cap tilted, right shoe turned out, collar hides the neck joint.

### 3.2 Pip — the kid in the raincoat (secondary), 1.05 m (1.12 with hat), 3.5 heads tall
Pivots: pelvis (0, 0.48, 0); torso (0, 0.50, 0); neck (0, 0.84, 0); head (0, 0.86, 0) [center 1.00, r 0.15 scaled (1, 1.05, 1)]; hat (0, 1.10, 0); nose (0, 0.98, 0.14); eyes (+/-0.055, 1.01, 0.12); shoulders (+/-0.15, 0.80, 0); elbows (+/-0.17, 0.66, 0.02); wrists (+/-0.18, 0.52, 0.05); hips (+/-0.07, 0.48, 0); knees (+/-0.07, 0.28, 0); ankles (+/-0.07, 0.07, 0.02).
Parts (28): 1 root · 2 pelvis Lathe (A-line start) · 3 raincoatBody: Lathe [(0.10,0),(0.22,0.30),(0.17,0.34)] yellow (flares toward the hem) · 4 raincoatHem: Torus r 0.22 tube 0.012 band color · 5 collar: Torus r 0.09 tube 0.025 · 6 neck: Cylinder r 0.05 h 0.05 skin · 7 head: Sphere r 0.15 scale (1,1.05,1) skin (the one sphere head, justified by the character's roundness; deliberately contrasts Bram's egg) · 8 hatCrown: Lathe dome r 0.17 h 0.10 yellow · 9 hatBrim: Lathe ring (0.17..0.26) with the back edge 0.04 lower (sou'wester) tilted back 10 · 10 hatBand: Torus r 0.17 tube 0.01 band color · 11 hairTuft x3: Capsule r 0.018 h 0.05 auburn peeking under the brim at the front · 12 noseButton: Sphere r 0.03 · 13 cheekL / 14 cheekR: Sphere r 0.045 scale (1,0.7,0.6), blush · 15 eyeL / 16 eyeR: Sphere r 0.038 white (large) · 17 pupilL / 18 pupilR: Sphere r 0.02 · 19 lidL / 20 lidR: half shells · 21 mouth: Torus r 0.025 tube 0.006 phi PI (smile arc) · 22 upperArmL / 23 upperArmR: Capsule r 0.04 h 0.14 yellow · 24 forearmL / 25 forearmR: Capsule r 0.035 h 0.13 · 26 handL / 27 handR: Sphere r 0.045 skin · 28 legs: thighL/R Capsule r 0.05 h 0.12 slate, shinL/R Capsule r 0.045 h 0.12, bootL/R RoundedBox 0.08 x 0.09 x 0.14 r 0.02 boots with cuff Torus; L boot turned out 12.
Appeal: giant head + hat silhouette against the dark doorway, yellow against teal/plaster, the smile arc is the only mouth in the cast (he is the warmth), big eyes with a 0.012 emissive highlight sphere so they read at 85 mm from 5.5 m.

### 3.3 Eyes and blink
Blink = lid shell rotation.x from -80 (open) to 0 (closed): close 0.05 s (`in`), hold 0.03 s, open 0.06 s (`out`). Pupils track a look target (procedural layer `lookAt(part, targetFn)` limited to +/-12 deg) so Bram's eyes lead the head turn by 0.1 s.

---

## 4. Choreography — "doorway-wave", 6.000 s seamless loop

### 4.1 Keyframe DSL (`src/scene/animation/dsl.ts`)
```ts
export type Ease = 'linear'|'in'|'out'|'inOut'|'back'|'hold';          // cubic family; back = overshoot 1.3
export type Channel = 'px'|'py'|'pz'|'rx'|'ry'|'rz'|'sx'|'sy'|'sz';      // p meters (delta from rest), r degrees, s scale factor
export type Key = readonly [t: number, v: number, ease?: Ease];          // ease applies to the segment ENDING at this key
export interface Track { part: string; ch: Channel; keys: Key[] }
export interface Layer { kind: 'breath'|'blink'|'lag'|'lookAt'; part: string; /* ...params */ }
export interface Clip { character: 'bram'|'pip'|'door'; tracks: Track[]; layers?: Layer[] }
export interface Performance { id: 'doorway-wave'; duration: 6; fps: 24; clips: Clip[]; markers: {t:number; label:string}[] }
```
`buildPerformance(perf)` validates at startup (dev): every part exists in the rig map, keys sorted, no NaN, `pose(0) === pose(duration)` within 1e-6 and end-segment eases are `inOut`/`hold` so velocity is zero at the seam (Vitest test `performance.test.ts`). `samplePerformance(perf, t, out)` writes into a preallocated `Map<partId, {p:Vector3, r:Euler, s:Vector3}>`; characters apply it in `useFrame` by part ref. Both characters, the door and future camera paths are tracks in the same `Performance`, sampled with the same `t` from the timeline singleton (`src/engine/timeline.ts`: `t`, `playing`, `rate`, `seek`, `toggle`, `restart`, `advance(dtClamped <= 1/30)`), so sync is structural, not coordinated.

### 4.2 Keyframe table — Bram (deltas from rest; rest yaw -8)
| t (s) | part | channel | value | ease | beat |
|---|---|---|---|---|---|
| 0.00 | head | ry | 0 | — | idle, gazing toward the tower |
| 1.60 | head | ry | 0 | hold | |
| 1.72 | head | ry | +6 | out | ear-tick: hears the door |
| 2.20 | head | ry | +6 | hold | |
| 2.30 | head | ry | +2 | in | anticipation (tiny counter-turn) |
| 2.65 | head | ry | +80 | inOut | head turn to the door (+72 net of rest) |
| 2.65 | head | rx | +4 | inOut | chin lifts (he looks down at Pip later) |
| 3.10 | head | rx | -10 | inOut | looks down at the kid |
| 4.30 | head | ry | +80 | hold | holds on Pip through the wave |
| 5.40 | head | ry | 0 | inOut | returns to rest |
| 5.40 | head | rx | 0 | inOut | |
| 2.20 | brow | py | 0 | hold | |
| 2.50 | brow | py | +0.02 | out | surprise |
| 2.50 | browTuftR | ry | -8 | out | one brow more than the other |
| 4.20 | brow | py | +0.01 | inOut | softens to a smile-brow |
| 5.40 | brow | py | 0 | inOut | |
| 5.40 | browTuftR | ry | 0 | inOut | |
| 2.55 | torso | ry | 0 | hold | |
| 2.70 | torso | ry | -5 | in | anticipation |
| 3.30 | torso | ry | +48 | inOut | body turn follows head |
| 2.75 | pelvis | ry | 0 | hold | |
| 3.35 | pelvis | ry | +28 | inOut | hips follow (less) |
| 2.80 | shoeR | ry | 0 | hold | |
| 3.10 | shoeR | ry | +35 | out | right foot pivots to the new facing |
| 2.80 | shoeR | py | 0 | hold | |
| 2.95 | shoeR | py | +0.03 | out | |
| 3.10 | shoeR | py | 0 | in | |
| 4.60 | torso | ry | +48 | hold | |
| 5.50 | torso | ry | 0 | inOut | turn back |
| 4.70 | pelvis | ry | +28 | hold | |
| 5.55 | pelvis | ry | 0 | inOut | |
| 5.10 | shoeR | ry | +35 | hold | |
| 5.45 | shoeR | ry | 0 | inOut | foot returns |
| 3.10 | upperArmR | rz | 0 | hold | |
| 3.20 | upperArmR | rz | +8 | in | anticipation dip |
| 3.50 | upperArmR | rz | -110 | inOut | hand rises to the cap |
| 3.50 | forearmR | rx | -95 | inOut | |
| 3.50 | handR | rx | -20 | inOut | grips the brim |
| 3.75 | capDome | py | +0.05 | out | cap lifts (tip of the hat) |
| 3.75 | capDome | rz | +12 | out | |
| 3.75 | capBrim | py | +0.05 | out | |
| 3.75 | capBrim | rz | +12 | out | |
| 3.95 | capDome | py | +0.05 | hold | |
| 4.30 | capDome | py | 0 | back | settles with a tiny overshoot |
| 4.30 | capDome | rz | 0 | back | |
| 4.30 | capBrim | py | 0 | back | |
| 4.30 | capBrim | rz | 0 | back | |
| 4.35 | upperArmR | rz | -100 | hold | |
| 4.90 | upperArmR | rz | 0 | inOut | arm down |
| 4.90 | forearmR | rx | 0 | inOut | |
| 4.90 | handR | rx | 0 | inOut | |
| 2.60 | upperArmL | rz | 0 | hold | |
| 3.30 | upperArmL | rz | +12 | inOut | left arm swings slightly out with the turn |
| 5.50 | upperArmL | rz | 0 | inOut | |
| 0.00/6.00 | all | all | 0 | — | loop seam (identical, zero velocity) |

Procedural layers (Bram): `breath` chest sy +/-1.5 %, head py +/-0.008, shoulders py +/-0.005, period 3.0 s (2 cycles), phase 0; `blink` at 0.90, 2.45, 4.70; `lookAt` pupils lead the head by 0.1 s toward (0.72, 0.9, -4.7) between 2.1 and 5.3, else toward (-2.2, 5.2, -11.5) (the clock); `lag` scarfTail rz follows torso ry at 0.08 s, gain 0.4; `lag` mustache rz follows head ry at 0.05 s, gain 0.15.

### 4.3 Keyframe table — door (hinge at x 1.15; positive ry opens toward the camera)
| t | part | ch | value | ease |
|---|---|---|---|---|
| 0.00 | doorLeaf | ry | 0 | — |
| 0.60 | doorLeaf | ry | 0 | hold |
| 0.75 | doorLeaf | ry | -3 | in (pull-back anticipation) |
| 1.40 | doorLeaf | ry | +65 | out |
| 5.30 | doorLeaf | ry | +65 | hold |
| 5.90 | doorLeaf | ry | 0 | inOut |
| 6.00 | doorLeaf | ry | 0 | hold |

### 4.4 Keyframe table — Pip (root deltas from the hidden start (0.95, 0, -5.35))
| t | part | ch | value | ease | beat |
|---|---|---|---|---|---|
| 1.20 | root | px | 0 | hold | hidden behind the jamb |
| 1.20 | head | rz | 0 | hold | |
| 1.95 | root | px | -0.33 | out | peeks out (root to x 0.62) |
| 1.95 | root | pz | +0.20 | out | (z -5.15) |
| 1.95 | head | rz | +15 | out | leans around the jamb |
| 1.95 | head | ry | -25 | out | looks at Bram |
| 2.00 | root | py | 0 | hold | |
| 2.15 | root | py | +0.04 | out | step 1 up |
| 2.30 | root | py | 0 | in | step 1 down |
| 2.45 | root | py | +0.04 | out | step 2 up |
| 2.60 | root | py | 0 | in | step 2 down |
| 2.70 | root | px | -0.23 | inOut | final x 0.72 (net -0.23 from start) |
| 2.70 | root | pz | +0.65 | inOut | final z -4.70 |
| 2.70 | head | rz | 0 | inOut | upright |
| 2.70 | head | ry | -30 | inOut | facing Bram |
| 2.00 | thighL | rx | 0 | hold | |
| 2.15 | thighL | rx | -35 | out | |
| 2.30 | thighL | rx | 0 | in | |
| 2.30 | thighR | rx | 0 | hold | |
| 2.45 | thighR | rx | -35 | out | |
| 2.60 | thighR | rx | 0 | in | |
| 2.00 | upperArmL | rx | 0 | hold | |
| 2.15 | upperArmL | rx | +25 | out | arm swing (opposite leg) |
| 2.45 | upperArmL | rx | -25 | inOut | |
| 2.70 | upperArmL | rx | 0 | inOut | |
| 2.70 | upperArmR | rz | 0 | hold | |
| 2.80 | upperArmR | rz | +10 | in | anticipation |
| 3.00 | upperArmR | rz | -150 | back | arm shoots up |
| 2.90 | forearmR | rz | 0 | hold | |
| 3.00 | forearmR | rz | -20 | out | |
| 3.14 | forearmR | rz | +35 | inOut | wave 1 |
| 3.42 | forearmR | rz | -35 | inOut | |
| 3.70 | forearmR | rz | +35 | inOut | wave 2 |
| 3.98 | forearmR | rz | -35 | inOut | |
| 4.10 | forearmR | rz | 0 | inOut | wave 3 ends |
| (handR rz = `lag` of forearmR rz, 0.05 s, gain 0.6) | | | | | hand follows |
| 2.70 | upperArmL | rz | 0 | hold | |
| 3.00 | upperArmL | rz | +70 | out | left hand holds the hat brim |
| 3.00 | forearmL | rx | -110 | out | |
| 4.40 | upperArmL | rz | +70 | hold | |
| 4.80 | upperArmL | rz | 0 | inOut | |
| 4.80 | forearmL | rx | 0 | inOut | |
| 4.10 | upperArmR | rz | -150 | hold | |
| 4.55 | upperArmR | rz | 0 | inOut | arm down |
| 4.50 | root | py | 0 | hold | |
| 4.62 | root | py | +0.06 | out | happy hop |
| 4.78 | root | py | 0 | in | |
| 4.78 | hatCrown | py | 0 | hold | |
| 4.86 | hatCrown | py | +0.03 | out | hat lags the hop |
| 5.00 | hatCrown | py | 0 | back | |
| 4.90 | head | ry | -30 | hold | |
| 5.20 | head | ry | +10 | inOut | glances back inside |
| 4.90 | root | px | -0.23 | hold | |
| 4.90 | root | pz | +0.65 | hold | |
| 5.05 | root | py | +0.04 | out | step back 1 |
| 5.20 | root | py | 0 | in | |
| 5.35 | root | py | +0.04 | out | step back 2 |
| 5.50 | root | py | 0 | in | |
| 5.60 | root | px | 0 | inOut | back behind the jamb |
| 5.60 | root | pz | 0 | inOut | |
| 5.60 | head | ry | 0 | inOut | |
| 6.00 | all | all | 0 | hold | seam |

Procedural layers (Pip): `breath` torso sy +/-2 % period 2.0 s (3 cycles); `blink` at 1.90, 2.10 (double blink while peeking), 3.95; `lookAt` pupils toward Bram's head from 1.6 to 5.2.

### 4.5 Markers (freeze frames surfaced on the timeline and in lessons)
- `0.40 — Portrait`: Bram faces near-camera, quiet; use for lesson 2 face comparison.
- `2.45 — The reaction`: head mid-turn, brows up, Pip just out of the door.
- `3.35 — The wave`: peak of wave 2, Bram turned, cap lifting; the relationship frame for lesson 3.
- `4.65 — The hop` (secondary).

---

## 5. Camera rig model

Constants (`src/scene/rig/rigSpec.ts`): `lensAxisHeight 1.30`, `pinholeOffset` (the mesh group is positioned so the lens front vertex coincides with the engine's pinhole; body center sits 0.26 m behind it), `railBounds [-2.7, 3.0]`, `railOverhang 0.3`, `wheelRadius 0.06`.

### 5.1 Parts (52) and dimensions
Body and electronics (gunmetal unless noted)
1 body RoundedBox 0.20 x 0.18 x 0.28 r 0.015 · 2 topPlate RoundedBox 0.18 x 0.02 x 0.26 with 3 slot grooves (thin dark boxes) · 3 sidePanelL RoundedBox 0.005 x 0.12 x 0.20 · 4-6 buttons x3 Cylinder r 0.008 (one amber) · 7 recLamp Sphere r 0.006 emissive `#FF4040` x3 (blinks 1 Hz only while the timeline plays) · 8 lcdPanelR RoundedBox 0.004 x 0.06 x 0.09 emissive `#1C2A3A` · 9 battery RoundedBox 0.12 x 0.09 x 0.05 rubber · 10-11 bnc x2 Cylinder r 0.006 h 0.012 brass · 12 handleBar Capsule r 0.014 h 0.22 (top, fore-aft) · 13-14 handlePosts x2 Capsule r 0.014 h 0.05 · 15 handleGrip Capsule r 0.02 h 0.10 rubber · 16-17 rods15mm x2 Cylinder r 0.0075 h 0.30 aluminum · 18 rodClamp RoundedBox 0.11 x 0.03 x 0.03 · 19 monitorArm Capsule r 0.008 h 0.06 · 20 ballJoint Sphere r 0.015 · 21 topMonitor RoundedBox 0.14 x 0.09 x 0.015 · 22 monitorScreen Plane 0.12 x 0.07 emissive gradient `#1C2A3A`->`#0B1420` with a cyan glint strip (no live feed; cost)
Lens (axis along -Z from the body front)
23 mountRing Cylinder r 0.055 h 0.012 brass · 24 barrelRear Cylinder r 0.052 h 0.05 · 25 focusRing Cylinder r 0.058 h 0.03 + 26 focusKnurl 24 x RoundedBox 0.006 x 0.03 x 0.008 (instanced) rubber · 27 focalRing Cylinder r 0.058 h 0.035 + 28 focalKnurl (instanced) · 29 focalScale: drei `Text` labels `18 24 35 50 85 135` (0.009 m, JetBrains Mono, brass color) placed around the focalRing at angles `theta(f) = 150 deg * log(f/18)/log(135/18)` so the ring turns 150 deg across the range; the ring's rotation.z = -theta(focal) so the current value sits under 30 indexMark (amber wedge RoundedBox 0.004 x 0.006 x 0.012 fixed on the barrel top) · 31 barrelFront Cylinder r 0.05 h 0.05 · 32 frontBezel Torus r 0.048 tube 0.004 brass · 33 frontElement Sphere r 0.046 scale z 0.35 lensGlass · 34 coatingDisc Circle r 0.04 emissive `#4FA9FF` x0.25 · 35 hood RoundedBox 0.14 x 0.12 x 0.06 r 0.01 open front (4 thin boxes) · 36 hoodFlap RoundedBox 0.14 x 0.008 x 0.08 pitched 20 (optional matte box feel)
Support
37 qrPlate RoundedBox 0.10 x 0.012 x 0.16 · 38 tiltCradle 2 x RoundedBox 0.02 x 0.08 x 0.10 · 39 panBase Cylinder r 0.07 h 0.04 · 40 panBar Capsule r 0.008 h 0.32 angled back-right 35 + 41 panBarGrip Capsule r 0.012 h 0.08 rubber · 42 bowl Sphere r 0.075 (half, phiLength PI) · 43 column Cylinder r 0.035 h 0.87 aluminum · 44 columnCollar Torus r 0.04 tube 0.01 brass
Dolly
45 basePlatform RoundedBox 0.62 x 0.05 x 0.90 r 0.01 · 46 bogies 4 x RoundedBox 0.08 x 0.06 x 0.14 · 47 wheels 8 x Cylinder r 0.06 h 0.035 rubber with hub Cylinder r 0.025 h 0.037 gunmetal (rotation.x += dz / 0.06 each frame) · 48 pushBar U-shape 3 capsules r 0.012 · 49 toolTray RoundedBox 0.30 x 0.02 x 0.16 · 50 cable TubeGeometry (CatmullRom through body rear -> column base -> floor behind the dolly -> floor box; recomputed when z changes) r 0.008 rubber · 51 rail 2 x Cylinder r 0.024 length (railBounds span + 2 x overhang = 6.3) aluminum + sleepers RoundedBox 0.72 x 0.03 x 0.08 every 0.6 m + 52 endStops 4 x RoundedBox 0.08 x 0.06 x 0.04 amber rubber (emissive pulse x2 for 300 ms when the engine clamps).
Heights: wheels 0.06 r -> platform top 0.15 -> column 0.15..1.02 -> bowl/pan/tilt 1.02..1.22 -> qrPlate 1.232 -> body center 1.32; lens axis at 1.30 (the lens is mounted 0.02 below the body center). A Vitest test asserts the computed lens axis from the spec equals 1.30 +/- 0.005.

### 5.2 Interaction and feedback
- Hover: drei `useCursor(hovered, 'grab')`, the body meshes get an amber `Outlines` (thickness 0.008, `screenspace`), the camera pill brightens, one-time tooltip pill "Drag along the rail to dolly".
- Drag: cursor `grabbing`; project the pointer ray onto the rail line (closest point on the z-axis line at y 0.06), clamp to `railBounds`, write `cameraDistance` to the store (the engine's single canonical state); the rail tubes get a cyan-dim emissive while dragging; the distance pill follows the camera pill at the top; readouts update every frame.
- Selected (click): amber outline persists, the control panel scrolls the Camera section into view and highlights its header for 600 ms.
- Keyboard focus: the rig is a focusable `role="slider"` proxy element in the DOM (aria-valuetext written only on state change: "Camera distance 3.00 m"), arrow keys +/-0.05 m, Shift 0.25 m.

### 5.3 Match-mode motion
The engine publishes `cameraZTarget`; the rig and the film camera use the same damped value: `damp(rigState, 'z', cameraZTarget, smoothTime, dt)` with maath `easing.damp` (verified signature `damp(current, prop, target, smoothTime=0.25, delta=0.01, maxSpeed=Infinity, easing=exp, eps=0.001)`, returns `true` while animating). `smoothTime` 0.35 s for presets/mode toggle, 0.12 s while the focal slider is being dragged (the shot keeps up with the hand), `maxSpeed` 6 m/s, dt clamped to 1/30. Wheels spin, cable re-solves, the distance pill shows "-> 3.56 m" with an arrow while travelling and settles to "3.56 m". The focal ring rotates with `dampAngle`-style smoothing (`dampE` on the ring's Euler, 0.15 s). Rail length: `railBounds` is a performance-level config; the rail mesh derives from it, and the default bounds already cover 135 mm matched for the primary (Z 5.65 m -> camera z +2.65). Reduced motion: smoothTime 0 (snap).

---

## 6. UI visual system (original identity)

### 6.1 Typography
- `src/design/fonts.ts`: `Instrument_Sans({ subsets:['latin'], axes:['wdth'], variable:'--font-ui', display:'swap' })` and `JetBrains_Mono({ subsets:['latin'], variable:'--font-mono', display:'swap' })` (both variable; `weight` defaults to `'variable'` per Next font docs). `globals.css`: `@theme inline { --font-sans: var(--font-ui); --font-mono: var(--font-mono); }` (replacing the Geist vars).
- Scale (px / line-height / tracking): micro 11 / 1.2 / +0.08em uppercase (section headers, chip labels, `font-stretch: 90%` via the wdth axis); value 12-13 mono / 1.2 / 0 (`font-variant-numeric: tabular-nums`); body 13 / 1.45; caption 14 / 1.45; panel title 16 / 1.3 / -0.01em semibold; display numeral 22 mono 600; home H1 40 / 1.1 / -0.02em, H2 28.
- Spacing 4-pt: 4, 8, 12, 16, 20, 24, 32. Radii: chip 8, control 10, panel 14, monitor bezel 20, pill 999. Hairline `1px rgb(255 255 255 / 0.06)`.

### 6.2 Glass panel recipe (`@utility glass`)
`background: var(--color-glass); backdrop-filter: blur(14px) saturate(120%); border: 1px solid var(--color-glass-border); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 12px 32px rgb(0 0 0 / 0.45); border-radius: var(--radius-panel)`. Hover border `--color-glass-hi`. Focus ring `0 0 0 2px rgb(95 227 255 / 0.6)` offset 2 px. Pressed: translateY(0.5px) and background +4 % lightness. Text on glass over the darkest stage passes 4.5:1 for ink-1 and above (checked in `tokens.test.ts` with a contrast function against `#0E121A`).

### 6.3 Component inventory (exact looks)
- **ReadoutChip**: 28 px tall, radius 8, glass, `label` micro ink-2 + `value` mono 13 ink-0; a 1 px bottom border in the variable accent at 60 %; the chip of the variable most recently changed gets a 600 ms accent glow. Three chips: `FOCAL 50 mm · 39.6°` (cyan), `DISTANCE 3.00 m` (amber), `BRAM 64 % · MCU` (mint). Values animate with maath damp (0.18 s) and render with tabular digits so widths do not jitter.
- **CaptionCard**: glass, max-width 440, 14 px, max two sentences, `aria-live="polite"`, rewritten only on state change (debounced 250 ms, no rewrites while dragging); variable words wrapped in `<em data-var="focal|distance|subject">` colored by accent with a 1 px dotted underline; a 2 px left rule in the dominant variable's color. Example at 85 matched: "To keep **Bram** this size the camera moved to **3.56 m**. His face flattens and the doorway swells behind him — that comes from **distance**, not from the **85 mm**."
- **ControlPanel** (top-right, 320 wide): sections with micro headers and mono hints right-aligned (`1-6 · ← →`): LENS (FocalSlider, presets row, optional LensRingDial disclosure), CAMERA (ModeToggle, DistanceSlider), FRAMING (TargetPicker), VIEW (VisualizationToggles), footer icon buttons (help `?`, hide UI `⇧/`, copy shot `⌘C`). Sections collapsible; collapsed state persisted in `localStorage`.
- **SegmentedControl**: 32 px, radius 10, track `rgb(255 255 255 / 0.05)`, items 12 px semibold ink-1; selected item becomes a light pill (`#E9EEF4` background, `#0B0E14` text) — the one inverted element per panel; 160 ms ease-out slide.
- **FocalSlider**: 48 px tall custom range (role=slider, aria-valuetext "50 millimetres, 39.6 degrees horizontal"), log-scaled track (`x = log(f/18)/log(135/18)`), 4 px track, cyan fill from the left to the thumb, prime ticks at 18/24/35/50/85/135 (8 px) with mono labels below; the thumb is a 14 px disc with a 2 px cyan ring; above the track a live **hFOV wedge** glyph (two 14 px lines at the current hFOV, cyan) next to the 22 px mono readout `50 mm`. Keyboard: arrows 1 mm, Shift 5 mm, Home/End 18/135. Drag emits every pointermove; UI smoothing is in the readouts, not the state.
- **DistanceSlider**: 48 px, linear 0.3-6.0 m (clamped to rail bounds, out-of-rail region hatched), amber fill; above the track a **shot-size band strip** recomputed live from the current focal: thresholds on `p = bodyHeight/frameHeight` (EWS < 0.25, WS 0.25-0.55, FS 0.55-0.9, MS 0.9-1.4, MCU 1.4-2.2, CU 2.2-3.5, ECU > 3.5) converted to distances `Z = 1.78*f/(p*20.25)`, rendered as labeled segments (micro labels) that slide as the focal changes — this makes "same shot size, different lens" visible on the control itself. Disabled (dimmed, hatched) in Match mode with the hint "driven by framing".
- **LensRingDial** (optional, behind a disclosure): 120 px SVG ring with engraved numbers at the same `theta(f)` as the 3D ring, amber index at 12 o'clock, drag rotates (angle -> log focal), mirrors the 3D ring exactly.
- **ModeToggle**: SegmentedControl `Fixed camera | Match framing` with a 16 px icon (locked tripod / dolly arrows); switching to Match triggers the dolly travel and a one-line caption rewrite.
- **TargetPicker**: SegmentedControl `Bram | Pip | Both`; items show a 6 px mint dot when that target is feasible; `Both` disables with tooltip "Not feasible on this rail at 135 mm" when the engine reports infeasible.
- **TimelineBar** (bottom-left, above the filmstrip, 44 px): play/pause (Space), restart (Home), frame step `[ ]` (1/24 s), a 6 s ruler with ticks every 0.5 s and labels every 1 s, marker diamonds (◆) at 0.40/2.45/3.35 with hover labels, a 2 px cyan playhead, mono time `02.45 s`; scrubbing pauses, release keeps paused (explicit play resumes).
- **VisualizationToggles**: icon toggle row: frustum (V), grid (G), framing target (T), guides (thirds/safe, applies to the monitor), outlines; 28 px buttons, active = cyan icon + underline.
- **MonitorPanel** (bottom-right, 40 % width, 16:9): bezel = glass radius 20 with a 10 px inner padding; top strip 24 px: `MONITOR · 16:9` micro + a live dot (cyan, pulses with timeline play), right: swap button (⇄, key F) and overlay menu; the image area hosts the film renderer root; DOM/SVG overlay layer: rule of thirds (1 px, 35 % white), action safe 90 % / title safe 80 % (dashed), center cross, frame-edge focal/FOV/distance mono tags in the corners (`50 mm`, `39.6° h`, `3.00 m`, `BRAM 64 %`), all toggleable; bottom strip 28 px measurement chips. The bezel has a 1 px amber border while the camera is being dragged. Primary/secondary swap: layout swap with a 160 ms glass dip (opacity 0.85) then a single resize, the bezel frame FLIPs over 320 ms `cubic-bezier(0.2,0,0,1)`; canvases are never CSS-scaled to fake the image.
- **Filmstrip** (bottom, 132 px at 1080p): six 16:9 tiles (148 x 83) with live thumbnails (round-robin, section 6.5), mono caption `24 mm · 73.7°` and, in Match mode, `1.00 m`; current tile has a 2 px amber frame and a soft amber glow; keys 1-6; hover shows a micro "Preset 2" hint. The strip sits on a slim glass bar with sprocket-hole notches (8 px) along the top edge as the one playful cue.
- **LessonCard** (top-left under the caption, 360 wide): title micro `EXERCISE 2 OF 3` + 16 px semibold name, 2-3 step rows with 16 px check circles (filled mint when the tracked state satisfies them), a progress hairline, "Next" appears on completion; collapsible to a 32 px strip. Exercise 3 shows two objective rows with a "Save this shot" button each; saved shots render as 96 x 54 thumbnails.
- **Toast**: bottom-center above the filmstrip, glass pill 32 px, mono key hint + text, 1.8 s, max one at a time (e.g., `F · Monitor is now primary`, `Copied shot settings`).
- **Tooltip**: 200 ms delay, glass, 12 px, mono key in a 16 px keycap.
- **HelpModal** (?): 640 px glass sheet, sections WHAT YOU SEE / CONTROLS / KEYS (two-column keycap legend) / ASSUMPTIONS (pinhole camera; 36 x 20.25 mm gate; distances from the entrance pupil; Bram 1.78 m, Pip 1.05 m; outlines are a stylistic hull).
- **HomePage lab cards**: dark void background with a faint 1 m grid vignette; H1 "Animation Lab"; a 3-col grid of cards 360 x 220: available card = glass, poster image (Playwright-captured 1280 x 720 of the lab, committed to `/public/labs/lens-framing.jpg`), title, 13 px description, mint `AVAILABLE` badge, hover lift 2 px; concept cards = 50 % opacity, dashed border, no image (a flat glyph), grey `CONCEPT · NOT BUILT` badge, `aria-disabled`, `cursor: not-allowed`, tooltip "Planned — not available in this preview", not focusable as links.

### 6.4 Layout rules
- 1920 x 1080: top-left cluster (title 16 px, chips row, caption 440, lesson 360) with 24 px margins; control panel 320 wide top-right (<= 420 tall collapsed-aware); monitor 768 x 432 bottom-right 16 px above the filmstrip; filmstrip 132 tall full width; timeline bar 44 tall bottom-left above the filmstrip, width = 100 % minus the monitor.
- 1440 x 900: monitor 36 % (518 x 291) when viewport height < 940, panel 300 wide, filmstrip 112 (tiles 128 x 72), caption 400.
- 1280 x 800: monitor 36 % (460 x 259), panel 280 with sections collapsed except LENS, filmstrip 100 (tiles 112 x 63), lesson card collapsed by default.
- < 1100 px: panel becomes a bottom sheet with tabs LENS / CAMERA / VIEW (grab handle, 320 tall), filmstrip becomes a horizontal scroller (snap), monitor 44 % docked top-right, chips wrap to two rows. < 760 px: single-view mode with the swap button prominent and a 33 % PiP; this is graceful degradation, not a target.
- Shift+/ hides all UI (and pills) for clean captures; Esc restores.

### 6.5 Motion tokens
- Value damping (maath `damp`, dt clamped to 1/30): readouts 0.18 s; dolly travel 0.35 s preset / 0.12 s dragging; focal ring 0.15 s; frustum geometry is derived instantly (no damping — it must agree with the live shot every frame).
- Observer camera (drei `CameraControls`, verified `smoothTime` default 0.25, `draggingSmoothTime` 0.125): user 0.25 s; scripted `setLookAt(..., true)` moves with `smoothTime` temporarily 0.9; `minDistance 1.2`, `maxDistance 22`, `minPolarAngle 8°`, `maxPolarAngle 85°`, `dollyToCursor`, `saveState()` at mount; `R` or double-click calls `reset(true)`.
- Panels: 180 ms `cubic-bezier(0.2,0,0,1)` for expand/collapse and hover; chips glow 600 ms; toasts 160 ms in / 240 ms out.
- Filmstrip thumbnails: one 192 x 108 FBO render per 8 frames rotating through presets; tiles crossfade 120 ms on update.
- Intro script (20 s, cancelled by any pointerdown/keydown/wheel; never runs when `prefers-reduced-motion`): 0-4 s observer glide (6.8, 3.4, 3.6) -> (5.2, 2.6, 2.0) looking at (-0.3, 1.1, -3.2); 1.2 s hint pill at the focal slider "Drag the focal length"; 1.6-5.0 s scripted fixed sweep 50 -> 24 (0.9 s) -> 85 (1.4 s) -> 50 (0.9 s), caption "Same spot, three lenses — only the crop changed."; 7 s hint over the mode toggle "Try Match framing"; 9-16 s if still idle: Match on, 50 -> 24 (dolly in past the lantern, observer trucks alongside) -> 85 (dolly out) -> 50, caption "Now the camera moves — watch the doorway swell behind Bram."; 16-20 s hints "Press 1-6 for presets" and "Drag the camera on the rail". On cancel, the current dolly target completes its damped travel; nothing snaps.
- Idle drift: starts 1.4 s after the intro ends with no input, observer orbits 1.5°/s with +/-0.08 m height bob over 9 s; pauses on any input, resumes after 3.6 s; never touches the film camera.
- Reduced motion: intro replaced by a static hint card; drift off; damping smoothTime 0 (dolly snaps); panel transitions 0 ms; the REC lamp stops blinking.

### 6.6 Education copy (concept panel; keep to two lines)
- 18 mm — Ultra wide: "90° across. The frame swallows the square and the clock tower appears. Nothing about the perspective changed — only how much we see."
- 24 mm — Wide: "73.7° across. Lantern, doorway and tower share the frame; Bram is small in his world."
- 35 mm — Moderate wide: "54.4°. Roomy but calm; the doorway reads without dwarfing Bram."
- 50 mm — Normal: "39.6°, close to how we notice things. Bram chest-up, Pip visible at the door."
- 85 mm — Short telephoto: "23.9°. A tight crop: Pip leaves the frame and Bram's reaction becomes the story."
- 135 mm — Telephoto: "15.2°: an eye and a nose. The same perspective as 18 mm — just the centre of it."
- Match 24: "To keep Bram this size the camera moved to 1.0 m. His nose grows, his ears shrink, and the doorway falls away behind him."
- Match 85: "Now the camera stands 3.6 m back. The face flattens; doorway and tower swell up behind him. Compression comes from distance, not glass."
- Shot-language phrase template (export `promptPhrase`): `{shotSize} on {subject}, {focal} mm {lensFamily} lens, camera {distance} m away at {height} m, {angle}, {backgroundCue}` with lensFamily from focal (<=24 "wide-angle", 28-40 "moderate wide", 41-60 "normal", 61-105 "short telephoto", >105 "telephoto"), angle from the pitch ("eye level", "slight low angle", "slight high angle"), backgroundCue from the matched/fixed state ("doorway and clock tower small and distant" vs "doorway looming close behind him"). Example: "Medium close-up on Bram, 24 mm wide-angle lens, camera 1.0 m away at 1.3 m, eye level, doorway and clock tower small and distant behind him."

---

## 7. Meshy prop plan (optional, <= $10)

Decision: not required; the procedural set is designed to stand on its own. If, after Phase 2 review, the lantern reads weak, generate exactly one hero piece:
- Endpoint: `fal-ai/meshy/v7.1/text-to-3d` (schema verified: `prompt` <= 600 chars, `mode: 'full'`, `model_type: 'standard'`, `topology: 'quad'`, `target_polycount: 12000`, `should_remesh: true`, `symmetry_mode: 'auto'`, `enable_pbr: true`, `pose_mode: ''`, `geometry_resolution: 'standard'`, `seed: 7`, `enable_prompt_expansion: false`, `enable_safety_checker: true`).
- Prompt: "Stylized Victorian cast-iron street lantern for an animated film, single post 2.2 m tall with a square four-pane lamp head and small finial, chunky simplified forms, slightly oversized proportions, clean smooth surfaces, matte black iron with worn brass trim, no base plate, no ground, no text".
- `texture_prompt`: "matte black cast iron with subtle edge wear, warm brass trim, clean stylized hand-painted look, no decals".
- Budget: brief states $0.80-1.20 per mesh; cap at 3 attempts (~$3.60) via a `--max-attempts 3` guard in the script.
- Script `scripts/gen-prop.ts` (run with `pnpm tsx`, reads `FAL_KEY` from `.env.local`; server-only, never bundled): `fal.subscribe(endpoint, { input })`, download `model_glb.url` to `assets-src/meshy/lantern-raw.glb` (gitignored), then `gltf-transform optimize assets-src/meshy/lantern-raw.glb public/models/lantern.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false` (optimize defaults verified: `--compress meshopt`, `--texture-compress auto`, `--texture-size 2048`), followed by `gltf-transform inspect public/models/lantern.glb` to assert < 15k triangles and < 1.5 MB. Meshopt is chosen over Draco because drei `useGLTF` enables meshopt via three-stdlib without a CDN decoder (Draco defaults to gstatic CDN).
- Loading: `useGLTF('/models/lantern.glb')` inside `<Suspense fallback={<LanternProcedural/>}>`; `useGLTF.preload` on lab mount; the GLB is scaled to a 2.2 m height from its bounding box at load and placed at the same (0.62, 0, -1.6); the practical point light stays procedural. If the GLB is absent, the procedural lantern is the final asset (same tokens).

---

## 8. Files for this perspective (see file_tree) and phase plan (see phases)

Docs deliverable: `docs/art-direction.md` (tokens, set map with the placement table, character sheets, keyframe tables, rig spec, limitations: pinhole only / no DOF / outlines are hulls / fog omitted / thumbnails refresh at ~7.5 Hz / studio gear may enter the shot on wide lenses when dollying back, by design).

### File tree
- src/design/tokens.css — Tailwind v4 @theme tokens (colors, radii, shadows, fonts) + @utility glass
- src/design/tokens.ts — typed mirror of color tokens for three.js materials (single source via a generated map)
- src/design/fonts.ts — next/font/google Instrument Sans (axes wdth) + JetBrains Mono, CSS vars --font-ui/--font-mono
- src/app/globals.css — imports tokens.css, @theme inline font mapping, base body styles
- src/app/layout.tsx — font variables on <html>, metadata
- src/app/page.tsx — home: lab cards from the registry (available vs concept)
- src/scene/World.tsx — <World role='stage'|'film'> composing Set, Characters, Lighting, Studio(stage only)
- src/scene/set/StagePlate.tsx — 12x16 m chamfered plate + optional 1 m grid
- src/scene/set/RulerStrips.tsx — tick LineSegments + numerals, zero at the default film plane
- src/scene/set/Backdrop.tsx — gradient cyc flat + cove
- src/scene/set/Lantern.tsx — procedural lantern + practical light; LanternGLB.tsx optional Meshy variant with Suspense fallback
- src/scene/set/DoorwayFlat.tsx — midground flat, arched opening, hinged door leaf (animated part), doorway lamp
- src/scene/set/BackWall.tsx — 9 m wall with glowing arched window and cornice
- src/scene/set/ClockTower.tsx — silhouette tower with lit clock face
- src/scene/set/StudioDressing.tsx — C-stand+flag, key lamp prop, apple boxes, slate, sandbag, cable floor box
- src/scene/materials/index.ts — material factories from tokens (satin PBR, glass, brass, emissive)
- src/scene/characters/Bram.tsx — 44-part primary puppet with named pivots
- src/scene/characters/Pip.tsx — 28-part secondary puppet
- src/scene/characters/parts.tsx — Lathe profiles, mitt hand, lid shell, knurl helpers, consistent bevels
- src/scene/characters/CharacterOutlines.tsx — drei Outlines wrapper per character
- src/scene/animation/dsl.ts — Key/Track/Layer/Clip/Performance types, easing fns, buildPerformance validation
- src/scene/animation/sample.ts — samplePerformance(perf, t, out) + procedural layers (breath, blink, lag, lookAt)
- src/scene/animation/performances/doorwayWave.ts — the 6 s keyframe data and markers
- src/scene/rig/rigSpec.ts — rig constants (lensAxisHeight 1.30, railBounds, pinholeOffset, wheelRadius)
- src/scene/rig/CameraRig.tsx — 52-part camera, head, dolly, rail, cable; hover/drag/select behaviors
- src/scene/rig/Frustum.tsx — accent frustum (Line2 edges, additive faces, 16:9 target rectangle, dashed extension)
- src/scene/rig/TargetIndicator.tsx — mint wire, terminal dots, ground ring, Both variant
- src/scene/rig/MeasureWire.tsx — pinhole-to-target wire with midpoint pill
- src/scene/rig/ScenePill.tsx — drei Html glass pill (label/value/dot, verb tooltip variant)
- src/scene/lighting/StageLighting.tsx — key/fill/rim/practicals + Environment Lightformers
- src/scene/lighting/PostStack.tsx — N8AO, Bloom, Vignette, ToneMapping with per-role params
- src/ui/chips/ReadoutChip.tsx
- src/ui/caption/CaptionCard.tsx — color-coded variable spans, aria-live, debounced rewrite
- src/ui/controls/ControlPanel.tsx, SegmentedControl.tsx, FocalSlider.tsx, DistanceSlider.tsx, LensRingDial.tsx, ModeToggle.tsx, TargetPicker.tsx, VisualizationToggles.tsx
- src/ui/timeline/TimelineBar.tsx — play/pause, scrubber, markers, frame step
- src/ui/monitor/MonitorPanel.tsx — bezel, overlay SVG guides, measurement strip, swap button
- src/ui/filmstrip/Filmstrip.tsx + useThumbnailRoundRobin.ts — preset tiles with live FBO thumbnails
- src/ui/lessons/LessonCard.tsx — exercise steps, progress, save-shot thumbnails
- src/ui/feedback/Toast.tsx, Tooltip.tsx, HelpModal.tsx
- src/ui/layout/LabLayout.tsx — responsive placement rules (1920/1440/1280/<1100), hide-UI mode
- src/ui/intro/useIntroScript.ts — cancellable 20 s cinematic intro
- src/ui/intro/useIdleDrift.ts — observer drift after 1.4 s idle, resume after 3.6 s, reduced-motion aware
- src/ui/copy/concepts.ts — education copy per focal/mode + shot-language phrase builder
- public/fonts/JetBrainsMono-Regular.woff — for drei Text numerals (ruler, lens scale)
- public/labs/lens-framing.jpg — home card poster (Playwright capture)
- scripts/gen-prop.ts — optional fal.ai Meshy 7.1 generation + gltf-transform pipeline
- docs/art-direction.md — tokens, set map, character sheets, keyframes, rig spec, limitations
- src/scene/animation/performance.test.ts — loop closure, zero seam velocity, parts exist, no NaN
- src/design/tokens.test.ts — contrast checks for text tokens over glass
- src/ui/controls/shotSize.test.ts — band thresholds and monotonic distances per focal
- src/scene/rig/rigSpec.test.ts — lens axis height derived from parts equals 1.30
- src/scene/set/layout.test.ts — required depths (1.6/3.0/4.7-5.0/9.0) and studio props outside the 18 mm frustum at default
- e2e/visual.spec.ts — Playwright screenshots at 1920x1080, 1440x900, 1280x800 for the four teaching configurations and the home page

### Phases
- **Phase 1 — Design system shell** — Tokens, fonts, glass utility and home page in place so every later component uses the same vocabulary.
  - deliverables: src/design/tokens.css + tokens.ts + fonts.ts; globals.css/layout.tsx switched from Geist to Instrument Sans + JetBrains Mono; Home page with registry cards (available vs concept) and poster placeholder; Storybook-free dev route /dev/ui rendering every component in its states (chips, segmented, sliders, pills, toast, tooltip)
  - verification: tokens.test.ts contrast >= 4.5 for ink-0/ink-1 over #0E121A; Playwright screenshot of /dev/ui at 1440x900; Lighthouse accessibility pass on / (labels, focus ring visible)
- **Phase 2 — Set, lighting, post** — The empty stage already reads as a crafted miniature film set.
  - deliverables: StagePlate, RulerStrips, Backdrop, Lantern, DoorwayFlat, BackWall, ClockTower, StudioDressing; StageLighting + PostStack with the numeric settings from the plan; World role split (Studio only in stage)
  - verification: layout.test.ts depths and studio-outside-18mm check; Screenshots from the observer default and from the film camera at 24/50/85 mm fixed; visual review against the four-configuration checklist; Frame time < 8 ms for the stage root at 1920x1080 dpr 1 (Chrome performance panel)
- **Phase 3 — Characters** — Bram and Pip static in rest pose with materials and outlines, reviewed on a turntable.
  - deliverables: Bram.tsx (44 parts), Pip.tsx (28 parts), parts.tsx helpers, CharacterOutlines; Dev route /dev/characters: turntable, 24 mm at 1.0 m vs 85 mm at 3.56 m side-by-side
  - verification: Part-count and pivot-name tests; Side-by-side screenshot shows nose/ear ratio difference clearly (manual visual gate); Draw calls per character <= 60 (outlines included)
- **Phase 4 — Choreography** — 6 s seamless loop driven by the shared timeline, with markers.
  - deliverables: dsl.ts, sample.ts, doorwayWave.ts data, procedural layers; Timeline singleton integration; TimelineBar markers
  - verification: performance.test.ts: pose(0) == pose(6) within 1e-6, seam velocity 0, keys sorted, parts exist; Scrub to 0.40/2.45/3.35 and compare stage vs monitor frames pixel-for-pose (same t); Visual: no popping at the loop seam over 10 consecutive loops
- **Phase 5 — Camera rig and accents** — Recognisable cinema camera on a rail with the lit frustum, target indicator, wires and pills; drag works.
  - deliverables: rigSpec.ts, CameraRig.tsx, Frustum.tsx, TargetIndicator.tsx, MeasureWire.tsx, ScenePill.tsx; Hover/drag/select states, rail-end feedback, Match travel damping, ring rotation
  - verification: rigSpec.test.ts lens axis 1.30 +/- 0.005; Frustum target rectangle coincides with the monitor frame edges (overlay comparison screenshot at 24/50/85); Drag along the rail updates the distance chip within one frame; clamping pulses end stops
- **Phase 6 — UI composition, intro, lessons polish** — Full lab layout at the three desktop sizes, intro and idle behaviors, hide-UI, help, filmstrip thumbnails.
  - deliverables: LabLayout, MonitorPanel, Filmstrip with round-robin thumbnails, LessonCard, HelpModal, Toast/Tooltip; useIntroScript, useIdleDrift, reduced-motion handling, keyboard map
  - verification: e2e/visual.spec.ts screenshots at 1920x1080, 1440x900, 1280x800 (and 1000x700 collapse); Intro cancels on first input; reduced-motion run shows no scripted motion; Thumbnail tiles update at >= 5 Hz each and match the main render at the same preset (visual diff tolerance)
- **Phase 7 — Optional Meshy lantern and docs** — Decide on the generated lantern after review; ship docs/art-direction.md.
  - deliverables: scripts/gen-prop.ts (guarded, max 3 attempts), public/models/lantern.glb if adopted; docs/art-direction.md with limitations
  - verification: gltf-transform inspect: < 15k tris, < 1.5 MB, webp textures <= 1024; Suspense fallback renders the procedural lantern when the GLB is removed

### Risks
- Two renderer roots double scene cost (outlines, N8AO, shadows) and may miss 60 fps on mid laptops [medium] → Monitor root uses halfRes AO, dpr cap 1.5 and its own smaller framebuffer; quality presets (auto-detect via a 2 s frame-time probe) drop outlines to screenspace off, AO to 'performance', bloom off; the World component is identical so switching to a shared-canvas renderer later only changes the Studio visibility mechanism (layers).
- drei SoftShadows (PCSS) misbehaves with r187 shadow map changes (PCFSoft deprecated) and forces Basic shadows [medium] → Keep PCSS behind a quality flag; default to PCFShadowMap with radius 3 and N8AO; verify SoftShadows in isolation on the dev route before enabling.
- Line2 (drei Line) lineWidth is in CSS pixels per root; resolution is taken from each root's size so the monitor root would draw different widths if it ever mounted technical layers [low] → Technical layers only mount in the stage root; frustum opacity/width constants live in one place.
- Html pills jitter or lag behind the damped camera position [low] → Pills are children of the rig group (move with it); only the distance pill recomputes its midpoint each frame; zIndexRange fixed; no distanceFactor.
- The 85 mm fixed shot clips Bram's crown or the doorway reads ambiguous at some observer angles [medium] → Anchor y 1.47 fits the box; positions are constants in one layout file with a test that recomputes frame coverage for the four configurations; adjust by <= 0.1 m if review disagrees.
- Round-robin thumbnail readback (readRenderTargetPixels) stalls the GPU pipeline [low] → 192x108 target, one readback per 8 frames; if a stall shows in profiling, switch tiles to a texture atlas rendered in the stage root and drawn with a textured quad View-less overlay canvas at the strip's position.
- Instrument Sans width axis increases the font payload and CLS [low] → Subset latin only, preload, adjustFontFallback default true; drop the wdth axis if the payload exceeds 60 KB.
- Meshy output ignores the stylized brief or has holes/thin parts [medium] → Procedural lantern is the committed default; generation is optional and capped at 3 attempts; reject if inspect shows > 15k tris or visible holes.

### Open questions
- Renderer architecture (engine/renderer perspective): two R3F roots mounting the same <World role> (preferred here for independent post stacks and crispness) vs a single Canvas with drei View/RenderTexture; the UI and scene plan are agnostic but the Studio visibility mechanism changes (prop vs object layers).
- Should toon outlines appear in the film image (current plan: yes, same world; alternative: outlines only in the stage root as a technical style)?
- Framing target for Pip/Both: static authored anchors at the final position (planned) vs live per-frame character position (physically honest but makes Match mode dolly during the performance).
- Does the 'grid' visualization toggle mean the 1 m floor grid on the plate (planned, low contrast) or should it also include the ruler strips (always on in the plan)?
- Whether the 'first 30 seconds' intro should run on every visit or once per browser (planned: once per browser via localStorage, with a replay button in Help).
- Exercise 3 saved-shot thumbnails: capture from the monitor root framebuffer (planned, 192x108) or store settings only and re-render on hover.
- Performance budget confirmation on the user's target machine (two roots with N8AO + outlines at 1920x1080 dpr 2) before committing to Outlines on every character mesh.
