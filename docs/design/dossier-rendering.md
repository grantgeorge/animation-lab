> **INPUT — superseded by the implementation and `docs/design/decisions.md` wherever they differ. Do not copy numbers from here.**

## Rendering, simulation engine and state architecture (R3F 9.8 + Next.js 16.4 specifics)

### Summary
One <Canvas>, ONE scene graph, one hand-written render orchestrator (useFrame priority 1) that each frame: ticks a deterministic master clock once, poses both puppets from pose(t), damps the camera rig in log space, renders shadow maps once (shadowMap.autoUpdate=false + needsUpdate), renders the STAGE pass with the observer camera (through a postprocessing EffectComposer when the stage is primary), renders the SHOT pass with a separate film PerspectiveCamera (filmGauge 36, aspect 16/9, setFocalLength) into a DOM-tracked 16:9 scissor rect, and renders ≤1 lens-preset thumbnail per frame into HalfFloat render targets blitted into filmstrip slots. Three.js layers (0 = world, 1 = tech) keep frustum/camera body/rulers/labels out of the film camera. drei View and dual-canvas designs were rejected because View portals children into a per-View THREE.Scene (world would have to exist twice; shadows twice; thumbnails impossible), and two canvases cannot share GPU resources. State: a single zustand 5 store with slices (camera rig, timeline controls, viz, ui, lesson, shots, interaction), canonical camera parametrized as an orbit rig about a static per-character framing anchor (azimuth, elevation, distance, aimOffset angles, focal) which makes matched framing (distance ∝ f + closed-form re-aim), dolly drag (one scalar), target switching (re-parametrize, camera does not move), future camera paths (keyframe rig fields) and export (derive position/quaternion) trivial. Eased presentation values live outside React and feed readouts through a vanilla measurement store + subscribe-to-DOM bindings (zero per-frame React renders). A pure-TS engine (three math classes only) owns optics, projection, matched-framing solve (closed-form guess + secant refine on the real projection), bounds, measurements, export (Blender/Unreal conversions) and the prompt-phrase classifier, all covered by Vitest in node. Next.js: keep the existing cacheComponents scaffold, client-only lab via next/dynamic ssr:false inside a client component, transpilePackages ['three'], tokens.ts as the single source for CSS (@theme inline) and three materials.

### Key decisions
- **View architecture**: (a) One Canvas, one scene, manual multi-pass rendering in a single useFrame(…, 1) orchestrator; shot pass via scissor/viewport into a DOM-tracked rect; layers separate tech-view objects from the film camera; thumbnails via render targets blitted into DOM slot rects.
  - why: Verified drei View source: each View owns a new THREE.Scene via createPortal and renders `children ? state.scene : scene` with the portal camera, so the same world would have to be mounted twice (double GPU resources, double shadow passes, divergence risk) and 6 thumbnails would need 6 more scene copies. Two canvases cannot share GPU resources at all. (a) gives literal same-world/same-time by identity, one shadow-map render reused by every pass, and trivial swap/fullscreen (just swap rects).
  - alternatives: (b) drei <View> per view with duplicated scene JSX; (c) two <Canvas frameloop="never"> advanced by one rAF via advance(timestamp).
- **Post-processing**: Use the `postprocessing` library directly (EffectComposer + RenderPass + EffectPass[Bloom, Vignette], multisampling 4, HalfFloat) for the stage pass only, driven from the orchestrator; the shot pass renders directly (no composer); shot vignette is a decorative DOM overlay; thumbnails tone-map in the blit shader.
  - why: @react-three/postprocessing renders inside its own useFrame at renderPriority (verified), which fights a hand-owned pass order. Driving the composer ourselves keeps shadow→stage→shot→thumbnail ordering explicit. Shot stays crisp with canvas MSAA and never goes through image resampling.
  - alternatives: @react-three/postprocessing <EffectComposer renderPriority={1}> plus a priority-2 shot pass; a second composer for the shot (requires resizing composer buffers to the monitor rect and renderer.setSize side effects).
- **Canonical camera parametrization**: Orbit rig about a static framing anchor: { targetId, azimuthDeg, elevationDeg, distanceM, aimOffsetDeg:[yaw,pitch], focalMm }; orientation derived with zero roll; position/quaternion derived for rendering and export.
  - why: Matched framing = distance ∝ f plus a closed-form aimOffset update; dolly drag = one scalar; Fixed mode = leave everything but focal; target switch = re-parametrize without moving the camera; future camera paths = keyframes of rig fields; export derives explicit pose. Anchors are static 'marks' so the camera never auto-tracks the animation.
  - alternatives: Explicit position+quaternion (every operation needs the anchor direction recomputed and re-aim solved); (target, az, el, dist) without an aim offset (cannot keep perspective and orientation fixed in Fixed mode while supporting off-centre framing).
- **State layering**: One zustand 5 root store (slices + subscribeWithSelector + persist with partialize/skipHydration) for canonical targets; a mutable Presentation object damped in the orchestrator (maath damp on log focal / log distance / angles); a vanilla measurementStore updated ≤1×/frame with quantized values and bound to DOM via subscribe (no React re-render per frame).
  - why: Instant canonical state keeps the UI, lessons and export deterministic and testable in node; eased values never enter React; readouts show actual eased camera values as the spec demands.
  - alternatives: Per-frame setState (re-render storm); refs only (untestable); springs in React state.
- **Frameloop**: frameloop="demand"; the orchestrator calls invalidate() at the end of a frame while playing, damping, controls moving, or thumbnails pending; store changes and controls change events invalidate.
  - why: Verified: invalidate() inside useFrame schedules 2 frames so the loop self-sustains; paused + idle costs zero GPU. Single loop, single place for time.
  - alternatives: frameloop="always" with an early-return dirty flag (CPU rAF never idles).
- **Timeline clock**: MasterClock based on an absolute mapping of performance.now() to timeline seconds (base + (now−anchor)·speed, wrapped to 6 s), ticked exactly once per frame by the orchestrator; every updater and every pass in that frame reads clock.frameT. Pure updater registry (not puppet useFrames) guarantees pose-before-render ordering.
  - why: Determinism (injectable now()), no drift, pause/seek/speed trivially correct, both views and thumbnails use the identical t by construction; future GLB rigs plug in as updaters calling mixer.setTime(t).
  - alternatives: R3F clock/delta accumulation (drifts, not seekable); per-component useFrame with priorities (ordering by sort order is fragile).
- **Observer controls**: drei CameraControls (camera-controls v3) with makeDefault, domElement = stage slot element, polar/distance limits, setBoundary(stage box), setLookAt/rotateTo transitions for presets and the idle tour.
  - why: Built-in smooth transitions (verified setLookAt(..., enableTransition), rotateTo, fitToBox, smoothTime) cover presets, the idle tour and reduced-motion snapping; OrbitControls would need hand-rolled target/position damping.
  - alternatives: drei OrbitControls (update at priority −1, change→invalidate verified) — simpler but no transitions.
- **Pointer events**: Canvas eventSource = lab root wrapper, eventPrefix="client", custom events.compute that maps clientX/Y through the stage slot rect with the observer camera and ignores events outside the stage slot; the shot monitor handles its own clicks with a Raycaster on the film camera.
  - why: Works identically whether the stage is full-bleed or PiP; mirrors drei View's verified compute gating; no accidental grabs through the monitor.
  - alternatives: 
- **Engine purity**: src/engine imports only three's math classes (Vector3, Quaternion, Matrix4, Euler, Box3, PerspectiveCamera for cross-checks); no R3F/drei/DOM. ESLint no-restricted-imports enforces it; Vitest runs in node.
  - why: Avoids reimplementing quaternions while staying renderer-independent; tests cross-check our projection against three's PerspectiveCamera matrices.
  - alternatives: 
- **Next.js config**: Keep cacheComponents: true + partialPrefetching: true (already scaffolded), add transpilePackages: ['three']; lab loaded with next/dynamic ssr:false inside a 'use client' loader; deep links parsed from window.location in an effect (no useSearchParams/Suspense needed).
  - why: Pages are static shells; Activity route preservation cleans up effects when hidden (verified) so the R3F root unmounts and releases the GL context; one-line fallback to cacheComponents:false if needed.
  - alternatives: 
- **Design tokens**: src/lib/tokens.ts is the source of truth; scripts/gen-tokens.mjs emits src/app/tokens.css (:root vars) consumed by Tailwind v4 @theme inline; three materials import tokens.ts; a Vitest test fails when the CSS is stale.
  - why: One source, both worlds, CI-guarded sync; R3F color management converts sRGB hex to linear so canvas and CSS colours match.
  - alternatives: 

### Verified API facts
- drei View (10.x) creates a new THREE.Scene per View and portals children into it; renders `children ? state.scene : scene` with the portal camera; `index` is the useFrame priority; compute gates on `event.target === track.current`; finishSkissor disables the scissor test — https://raw.githubusercontent.com/pmndrs/drei/master/src/web/View.tsx and https://drei.docs.pmnd.rs/portals/view
- R3F useFrame: callbacks run in ascending priority; a positive priority disables automatic rendering (`internal.priority` counter); negative priorities only order callbacks — https://r3f.docs.pmnd.rs/api/hooks and https://raw.githubusercontent.com/pmndrs/react-three-fiber/master/packages/fiber/src/core/store.ts
- R3F loop: frameloop 'demand' renders while `internal.frames > 0`; invalidate() inside a useFrame sets frames to 2; advance(timestamp) drives 'never' roots; auto-render only `if (!state.internal.priority)` — https://raw.githubusercontent.com/pmndrs/react-three-fiber/master/packages/fiber/src/core/loop.ts
- R3F RootState has invalidate(frames?), advance(timestamp, runGlobalEffects?), setFrameloop, setDpr, setEvents, performance {current,min,max,debounce,regress}, controls — same store.ts source
- R3F events: `compute(event, state, previous?)` sets state.pointer and `state.raycaster.setFromCamera(...)`; `eventSource` accepts DOM nodes/refs; `eventPrefix="client"`; pointer capture via `e.target.setPointerCapture(e.pointerId)`; event data includes ray, camera, delta — https://r3f.docs.pmnd.rs/api/events
- R3F Canvas props: frameloop always|demand|never, dpr [min,max], shadows (true → PCFSoft), gl, scene, camera (instance allowed), events, eventSource, eventPrefix, onCreated; renderer defaults antialias, alpha, high-performance, SRGB output, ACESFilmic — https://r3f.docs.pmnd.rs/api/canvas
- R3F applyProps: Layers props copy `.mask`; literal numbers call `target.setScalar` or `target.set(value)` (so `layers={1}` works); dashed props pierce (rotation-x) — https://raw.githubusercontent.com/pmndrs/react-three-fiber/master/packages/fiber/src/core/utils.tsx
- R3F Next.js guidance: add `transpilePackages: ['three']` in next.config; R3F 9 pairs with React 19 — https://r3f.docs.pmnd.rs/getting-started/installation
- R3F performance guidance: frameloop demand + invalidate; performance.regress() must be read via performance.current; PerformanceMonitor adjusts by average fps — https://r3f.docs.pmnd.rs/advanced/scaling-performance
- three r187 PerspectiveCamera: filmGauge default 35; setFocalLength uses `getFilmHeight() = filmGauge / max(aspect, 1)`; getViewBounds/getViewSize exist — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/cameras/PerspectiveCamera.js
- three r187 WebGLRenderer: setViewport/setScissor multiply by pixel ratio only for the canvas (getTargetPixelRatio); onContextRestore calls initGLContext() and restores shadowMap flags; projectObject layer-tests lights against the camera; setRenderTarget(null) restores the canvas viewport/scissor — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/renderers/WebGLRenderer.js and release notes https://github.com/mrdoob/three.js/releases/tag/r187 (#34460)
- three r187 WebGLShadowMap.render early-returns when `autoUpdate === false && needsUpdate === false` and sets `needsUpdate = false` after rendering; casters are layer-tested against the render camera (or the shadow camera's custom mask) — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/renderers/webgl/WebGLShadowMap.js
- three r187 WebGLBackground: Color backgrounds force a clear (`forceClear = true`), null backgrounds clear with clearColor/alpha when autoClear — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/renderers/webgl/WebGLBackground.js
- postprocessing EffectComposer: options depthBuffer/stencilBuffer/multisampling/frameBufferType; setSize calls renderer.setSize only when the size changes and resizes buffers/passes from the drawing-buffer size; render(deltaTime) iterates enabled passes; autoRenderToScreen marks the last pass — https://raw.githubusercontent.com/pmndrs/postprocessing/main/src/core/EffectComposer.js and https://pmndrs.github.io/postprocessing/public/docs/class/src/core/EffectComposer.js~EffectComposer.html
- @react-three/postprocessing EffectComposer renders in its own useFrame at `renderPriority` (default 1), multisampling default 4, frameBufferType HalfFloatType, sets gl.autoClear around composer.render — https://raw.githubusercontent.com/pmndrs/react-postprocessing/master/src/EffectComposer.tsx
- drei OrbitControls: props camera, domElement, makeDefault, regress, enableDamping, target, onChange/onStart/onEnd; domElement resolves `domElement || events.connected || gl.domElement`; update() at useFrame priority −1; change → invalidate() (+ performance.regress when regress) — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/OrbitControls.tsx
- drei CameraControls: props camera, domElement, makeDefault, impl, event callbacks (onControlStart/onControl/onControlEnd/onTransitionStart/onUpdate/onWake/onRest/onSleep); drei 10.5+ bundles camera-controls v3 — https://drei.docs.pmnd.rs/controls/camera-controls
- camera-controls library: minDistance/maxDistance, min/maxPolarAngle, min/maxAzimuthAngle, smoothTime 0.25, draggingSmoothTime 0.125, dollyToCursor; setLookAt(px,py,pz,tx,ty,tz,enableTransition), rotateTo, dollyTo, fitToBox, setBoundary(box3), update(delta): boolean; events controlstart/control/controlend/transitionstart/update/wake/rest/sleep; CameraControls.install({THREE}) — https://unpkg.com/camera-controls/README.md
- drei Html props: as, wrapperClass, prepend, center, fullscreen, distanceFactor, zIndexRange, portal, transform, sprite, calculatePosition, occlude (true | refs | 'blending'), onOcclude — https://drei.docs.pmnd.rs/misc/html
- drei PerformanceMonitor props: ms 250, iterations 10, threshold 0.75, bounds(refreshrate), flipflops, factor, step, onIncline/onDecline/onChange/onFallback; usePerformanceMonitor — https://drei.docs.pmnd.rs/performances/performance-monitor
- drei Line wraps three-stdlib Line2/LineSegments2 + LineGeometry + LineMaterial, resolution from canvas size; props points, color, vertexColors, lineWidth, segments (+ LineMaterial params such as dashed) — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/Line.tsx
- drei Text wraps troika-three-text (suspends on font preload, sync → invalidate) — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/Text.tsx
- zustand 5 vanilla: createStore, StoreApi {setState(partial, replace?), getState, getInitialState, subscribe(listener)}; setState merges with Object.assign unless replace; React useStore(api, selector) uses useSyncExternalStore — https://raw.githubusercontent.com/pmndrs/zustand/main/src/vanilla.ts and https://raw.githubusercontent.com/pmndrs/zustand/main/src/react.ts
- zustand subscribeWithSelector: `subscribe(selector, listener, { equalityFn?, fireImmediately? })` overload, Object.is default — https://raw.githubusercontent.com/pmndrs/zustand/main/src/middleware/subscribeWithSelector.ts
- zustand persist options: name, storage (createJSONStorage default localStorage), partialize, onRehydrateStorage, version, migrate, merge, skipHydration; api persist.rehydrate/hasHydrated/onFinishHydration — https://raw.githubusercontent.com/pmndrs/zustand/main/src/middleware/persist.ts
- zustand README: transient updates via subscribe + ref; useShallow for multi-field selectors — https://raw.githubusercontent.com/pmndrs/zustand/main/README.md
- maath 0.10.8 easing: `damp(current, prop, target, smoothTime = 0.25, delta = 0.01, maxSpeed = Infinity, easing = exp, eps = 0.001): boolean` (true while moving; velocity stored on current.__damp; omega = 2/smoothTime); damp2/damp3/dampE/dampQ/dampS/dampC/dampM return boolean; dampLookAt returns void; dampAngle wraps shortest path; exp(t) = 1/(1+t+0.48t²+0.235t³) — https://unpkg.com/maath@0.10.8/dist/declarations/src/easing.d.ts and https://unpkg.com/maath@0.10.8/dist/easing-0f4db1c0.esm.js; peerDependency three >= 0.134 — https://unpkg.com/maath@0.10.8/package.json
- Next.js next/dynamic: `ssr: false` works only in Client Components (error in Server Components); loading option — https://nextjs.org/docs/app/guides/lazy-loading
- Next.js cacheComponents: enables PPR + use cache; requires Node runtime; uses React <Activity> to keep up to 3 hidden routes mounted with effects cleaned up when hidden — https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents and https://nextjs.org/docs/app/guides/preserving-ui-state
- Next.js transpilePackages: compiles listed node_modules packages; Turbopack transpiles workspace packages automatically — https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages
- Next.js next/font: `variable` option + className on <html>; Tailwind v4 via `@theme inline { --font-sans: var(--font-inter) }` — https://nextjs.org/docs/app/api-reference/components/font
- Local repo: create-next-app 16.4.3 scaffold with next 16.4.3, react 19.3.0, typescript 5.9.3, tailwindcss 4.3.3, eslint 9.39.5, cacheComponents: true, partialPrefetching: true, Turbopack tailwind rule; three/R3F/drei/zustand not yet installed — /Users/gg/w/animation-lab/package.json, next.config.ts, node_modules

### Plan
# Animation Lab — Lens & Framing Lab: Rendering, Engine and State Architecture

Scope: this document answers items 1–8 of the perspective. Everything below is concrete to the fixed stack (Next 16.4.3, React 19.3.0, R3F 9.8.2, drei 10.7.9, three 0.187, zustand 5.0.16, maath 0.10.8, postprocessing ^6.39, Vitest 5, Playwright 1.64). "Verified" marks facts checked this session against docs/source (sources listed in the structured output).

## 0. Repository state and dependencies

Observed at /Users/gg/w/animation-lab (not greenfield anymore): create-next-app 16.4.3 scaffold, one commit ("Initial commit from Create Next App"), `next.config.ts` already has `cacheComponents: true`, `partialPrefetching: true` and the Turbopack `@tailwindcss/turbopack` CSS rule; `src/app/{layout,page}.tsx`, `globals.css`; Tailwind 4.3.3, TS 5.9.3, ESLint 9.39.5; `packageManager: pnpm@10.33.0`. Not installed yet: three, R3F, drei, zustand, maath, postprocessing, vitest, playwright. `.env.example` contains `FAL_API_KEY=` (task text says FAL_KEY) and `.gitignore` ignores `.env*` without `!.env.example`.

Add (runtime): `three@~0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`, `zustand@5.0.16`, `maath@0.10.8`, `postprocessing@^6.39.0`. Dev: `@types/three@~0.187.0`, `vitest@5.0.5`, `vite@^8`, `@playwright/test@1.64.1`, optional `@next/bundle-analyzer`. Not needed: `@react-three/postprocessing` (we drive `postprocessing` ourselves), jsdom (engine/store tests run in node; component tests, if any, opt into jsdom per file).

Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (tsc --noEmit), `test` (vitest run), `test:watch`, `e2e` (playwright test), `tokens` (node scripts/gen-tokens.mjs), `analyze` (ANALYZE=1 next build).

## 1. View architecture

### 1.1 Decision: one Canvas, one scene, orchestrated multi-pass (option a)

Why not (b) drei `<View>`: verified in drei `src/web/View.tsx` — every View does `const [virtualScene] = useState(() => new THREE.Scene())` and `createPortal(<Container…>{children}</Container>, virtualScene, { events: { compute, priority: index }, size })`; its `useFrame(…, index)` calls `gl.setViewport/setScissor/setScissorTest(true)` from `track.getBoundingClientRect()` and renders `children ? state.scene : scene` with `state.camera` (the portal's camera). A View without children renders the *default scene with the default camera*, so there is no way to render one shared scene with a second camera. Consequences for us: the world (puppets, set, lights) would be mounted twice (two React trees, two sets of Object3Ds, materials and shadow-casting lights), shadow maps rendered twice per frame, thumbnails would need six more copies, and "same world, same time" would be true only by construction. View is excellent for galleries of independent scenes; wrong tool here.

Why not (c) two Canvases with `frameloop="never"` + one rAF calling `advance(timestamp)` (R3F `advance(timestamp, runGlobalEffects?)` verified): two WebGL contexts cannot share buffers/textures; the world exists twice on the GPU; context-loss surface doubles; thumbnails need a third context or readbacks. Only benefit is DOM-trivial layout, which (a) gets with DOM-tracked rects anyway.

(a) gives: one scene graph (identity, not equivalence); puppets posed once; shadow maps rendered once and reused by stage, shot and thumbnail passes; the film camera is just another `PerspectiveCamera` object; swap/fullscreen = swapping rects; one event system.

### 1.2 Frame orchestrator (the only place that renders)

`src/renderer/runtime/FrameOrchestrator.tsx` registers `useFrame(frame, 1)`; priority > 0 disables R3F auto-render (verified `internal.priority` counting in store.ts). Per frame:

```ts
function frame(state: RootState, rawDelta: number) {
  const t = clock.tick()                           // 1. ONE clock tick → clock.frameT
  const dt = Math.min(rawDelta, 1 / 30)            // dt clamp for damping only
  for (const u of updaters) u({ t, dt, ...ctx })   // 2. puppets (order 0) → rig damping (10) → tech view (20)
  syncFilmCamera(filmCamera, presentation.pose)    // 3. same camera object used by shot + measurements
  publishMeasurements(presentation)                // 4. quantized, ≤1 setState per frame
  gl.shadowMap.needsUpdate = castersDirty           // 5. shadows once per frame (autoUpdate=false set in onCreated)
  renderStage(state)                               // 6. observer camera: composer (primary) or scissored direct (PiP)
  renderShot(state)                                // 7. film camera into shot rect (scissor+viewport)
  thumbnails.renderDue(state)                      // 8. ≤1 RT render while playing; all dirty when paused
  gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height)
  if (needsAnotherFrame()) state.invalidate()      // 9. demand loop self-sustains
}
```

Pass details:
- Rect math (`viewports.ts`): for slot element rect `r` and canvas rect `c`, `x = round(r.left − c.left)`, `y = round(c.bottom − r.bottom)`, `w = round(r.width)`, `h = round(r.height)` in CSS px; `gl.setViewport(x,y,w,h); gl.setScissor(x,y,w,h); gl.setScissorTest(true)`. Verified: for the canvas target three multiplies these by the pixel ratio internally (r187 only does this for the canvas, not render targets). Rects are refreshed by a ResizeObserver on each slot plus `getBoundingClientRect()` in the frame while a layout transition flag is set (swap animation), otherwise cached.
- Stage primary: `gl.setRenderTarget(null); gl.setScissorTest(false)`; `stagePost.enabled ? composer.render(dt) : gl.render(scene, observerCamera)`. The composer's RenderPass performs the first render of the frame, so the shadow-map update happens there (verified WebGLShadowMap early-return on `autoUpdate===false && needsUpdate===false`, and `needsUpdate=false` after rendering).
- Shot: film camera layers = {0}; `scene.background` is a Color so three force-clears inside the scissor (verified WebGLBackground `forceClear` for Color backgrounds); `gl.render(scene, filmCamera)`. Camera `aspect` stays exactly 16/9; the slot element is kept 16:9 by CSS (`aspect-ratio: 16/9`), so pixel rounding error is ≤1 px.
- Stage as PiP (shot primary): stage rendered direct (no composer) into its scissored rect; shot full-bleed; `ui.pipHidden` skips the stage pass entirely (fullscreen shot).
- `gl.autoClear` stays true; each pass clears only its scissor region.
- Layers (`scene/layers.ts`): `LAYER_WORLD = 0`, `LAYER_TECH = 1`. `observerCamera.layers.enable(1)`; `filmCamera.layers.set(0)`. Tech objects call `layers.set(1)` on every descendant (Layers do not inherit) via a `<TechLayer>` group that traverses on mount and whenever children change; tech objects have `castShadow=false`. Lights stay on layer 0 (verified: lights are layer-tested against the rendering camera in `projectObject`). R3F `layers={1}` works as a prop (verified applyProps literal `.set(value)` path), but the traverse helper is still needed for nested meshes.

### 1.3 Pointer events per view

`<Canvas eventSource={rootRef} eventPrefix="client" events={labEvents}>` where `labEvents` spreads R3F's default `events` factory and overrides `compute`:

```ts
compute: (e, state) => {
  const r = viewports.get('stage').rect; const el = viewports.get('stage').element
  if (!el.contains(e.target as Node)) { state.pointer.set(-10, -10); return }      // not over the stage → miss everything
  state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  state.raycaster.setFromCamera(state.pointer, state.camera)                       // observer camera = R3F default camera
}
```
(The `compute(event, state, previous?)` signature, `eventSource`, `eventPrefix="client"` and pointer capture via `e.target.setPointerCapture(e.pointerId)` are verified in the R3F events docs.) The shot monitor DOM element owns its own `pointerdown/click`: NDC inside the 16:9 rect → `raycaster.setFromCamera(ndc, filmCamera)` against the character hit volumes → `setTarget(id)`.

### 1.4 drei Html labels and the monitor overlap

In-scene pills use drei `<Html portal={stageHtmlLayerRef} zIndexRange={[20, 0]}>` (props verified). The `#stage-html` layer sits above the canvas and below the shot slot. To stop pills showing through the monitor's transparent picture area, the layer gets `clip-path: polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, L T, L B, R B, R T, L T)` recomputed only when the shot rect changes (ResizeObserver), zero per-frame cost. The monitor's guides (thirds, safe areas, readout strip) are an SVG overlay inside the shot slot with `pointer-events:none`, so they align exactly with the rendered rect at any DPR.

### 1.5 Post-processing

`src/renderer/stage/StagePost.ts` builds `new EffectComposer(gl, { multisampling: 4, frameBufferType: HalfFloatType, depthBuffer: true })` (constructor options verified), `addPass(new RenderPass(scene, observerCamera))`, `addPass(new EffectPass(observerCamera, new BloomEffect({ luminanceThreshold: 0.85, luminanceSmoothing: 0.2, intensity: 0.65, mipmapBlur: true }), new VignetteEffect({ offset: 0.28, darkness: 0.55 }), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })))`. `composer.setSize(w, h)` on canvas size/DPR change (verified: it calls `renderer.setSize` only if the size differs, and resizes buffers from the drawing-buffer size). Parity rule: the shot pass (direct) and the stage pass (composer) must show identical colours for world objects; Playwright samples a neutral card visible in both views (`maxDiff` 2/255 per channel). If parity fails with HalfFloat + ToneMappingEffect, fall back to `frameBufferType: UnsignedByteType` (buffer flagged sRGB by postprocessing; renderer tone mapping applied in RenderPass) which is parity-exact by construction. No AO in the MVP (toon/satin materials; AO is the first thing the degradation ladder would drop anyway).

### 1.6 Thumbnails (lens-preset filmstrip)

`src/live/thumbnails/ThumbnailRenderer.ts`: 6 × `WebGLRenderTarget(256, 144, { type: HalfFloatType, depthBuffer: true })` (linear HDR; three applies tone mapping only when rendering to the canvas, so the blit shader does `#include <tonemapping_fragment>` + `#include <colorspace_fragment>` with `material.toneMapped = true` → identical look to the shot). For preset `p` the scratch camera pose comes from the engine: `solveShot({ ...canonicalRig, focalMm: p }, mode)` — in Fixed mode the position is the current one, in Match mode the matched position, so the strip previews what each lens *would* give in the current mode. Scheduler: while playing, round-robin 1 RT per frame (each refreshed every 6 frames; drops to 1 per 3 frames at quality ≤ Q1); when paused, render all dirty RTs (max 2 per frame) until clean; dirty set = all on any camera/mode/target/time/quality change. Display: per-slot blit (`gl.setRenderTarget(null)`, scissor/viewport = slot rect, fullscreen-triangle `ShaderMaterial` with the RT texture) into the DOM filmstrip's transparent 16:9 windows. No readbacks, no `toDataURL`.

### 1.7 Frameloop, DPR, context loss

- `frameloop="demand"`. Keep-alive rule in step 9: `playing || !presentation.settled || controlsActive || thumbnails.dirty.size > 0 || layoutTransitioning`. Store changes → `useLabStore.subscribe(() => invalidate())` (installed once in `StageCanvas`); drei controls call `invalidate()` on change (verified for OrbitControls; CameraControls `update`/`onUpdate` wired the same way).
- DPR: `dpr={quality.dpr}` with default `Math.min(devicePixelRatio, 1.5)`; drei `<PerformanceMonitor flipflops={3} onDecline onIncline onFallback>` (props verified) drives `QualityController`; `performance.regress()` during orbit (`regress` prop) lowers `performance.current`, read via `useThree(s => s.performance.current)` to scale dpr temporarily.
- Context loss: in `onCreated`, `gl.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); ui.setContextLost(true) })` and `'webglcontextrestored'` → three re-inits GL state itself (verified `onContextRestore` → `initGLContext()` and restores shadowMap flags); we then set `shadowMap.needsUpdate = true`, mark all thumbnails dirty, `composer.setSize` (forces buffer re-creation), `invalidate()`, hide the overlay. Dev-only button uses `WEBGL_lose_context` to test.

### 1.8 Swap primary and fullscreen shot

`ui.primaryView: 'stage' | 'shot'`, `ui.pipHidden`. Both views are DOM slots laid out by CSS (`data-primary` attribute on the layout root); the orchestrator reads both rects every frame from the registry. Swap = change the attribute (CSS transition 240 ms; `layoutTransitioning` keeps frames flowing and rects refreshing per frame during the transition). Shot primary keeps a centered 16:9 inner element (letterbox bars are DOM background), so the camera aspect never changes. `CameraControls domElement` is re-pointed to the current stage slot element on swap. Key `Shift+S` swaps, `Shift+F` toggles fullscreen shot, `Esc` returns.

## 2. State

### 2.1 Root store (`src/ui/store/labStore.ts`)

```ts
export const labStore = createStore<LabState>()(subscribeWithSelector(persist((...a) => ({
  ...createCameraSlice(...a), ...createTimelineSlice(...a), ...createVizSlice(...a),
  ...createUiSlice(...a), ...createLessonSlice(...a), ...createShotsSlice(...a), ...createInteractionSlice(...a),
}), {
  name: 'animation-lab:lens-framing', version: 1, skipHydration: true,
  partialize: s => ({ lesson: s.lesson, shots: s.shots, viz: s.viz, quality: s.ui.quality }),
})))
export const useLabStore = <T>(sel: (s: LabState) => T) => useStore(labStore, sel)
```
(zustand 5 verified: `createStore`/`useStore(api, selector)` via useSyncExternalStore; `subscribeWithSelector` adds `subscribe(selector, listener, { equalityFn, fireImmediately })`; `persist` supports `partialize`, `version/migrate`, `skipHydration`; `labStore.persist.rehydrate()` is called in a `useEffect` of the lab root to avoid hydration mismatch.) Vanilla store first so engine-level tests and trackers run without React; `useShallow` for multi-field selectors.

Slices (canonical, instant):

```ts
type FramingTargetId = 'primary' | 'secondary' | 'both'
interface CameraRig { targetId: FramingTargetId; azimuthDeg: number; elevationDeg: number; distanceM: number; aimOffsetDeg: [yaw: number, pitch: number]; focalMm: number }
interface CameraSlice {
  camera: { rig: CameraRig; mode: 'fixed' | 'match'; matchRef: { metric: number } | null; clampHint: null | 'min' | 'max' | 'stage'; filmback: { widthMm: 36; heightMm: 20.25 }; clip: { near: 0.05; far: 60 } }
  setFocal(mm: number, source?: 'slider' | 'preset' | 'ring' | 'key'): void
  setDistance(m: number, source?: 'slider' | 'drag' | 'key'): void
  setTarget(id: FramingTargetId): void
  setMode(mode: 'fixed' | 'match'): void
  nudgeAim(dYaw: number, dPitch: number): void          // used by lesson presets only
  applyShot(shot: ShotExport): void
  resetCamera(): void
}
interface TimelineSlice { timeline: { playing: boolean; speed: 0.25 | 0.5 | 1; loop: true; durationS: 6; takeId: 'doorway-wave'; seekTime: number }; play(); pause(); toggle(); seek(t: number); step(frames: number); setSpeed(s); restart() }
interface VizSlice { viz: { frustum: boolean; rulers: boolean; labels: boolean; dollyAxis: boolean; thirds: boolean; safeAreas: boolean; shotVignette: boolean; focalReadoutOnShot: boolean }; toggleViz(k) }
interface UiSlice { ui: { primaryView: 'stage' | 'shot'; pipHidden: boolean; uiHidden: boolean; panels: { controls: boolean; lesson: boolean; help: boolean; exportDialog: boolean }; toasts: Toast[]; quality: 'auto' | 'high' | 'low'; contextLost: boolean; observerPresetId: string }; … }
interface LessonSlice { lesson: { activeExerciseId: 'ex1' | 'ex2' | 'ex3' | null; progress: { ex1: { visited: Record<'24'|'50'|'85', boolean> }; ex2: { started: boolean; compared: Record<'24'|'85', boolean> }; ex3: { saved: Record<'reaction'|'relationship', boolean> } } }; … }
interface ShotsSlice { shots: { saved: Partial<Record<'reaction' | 'relationship', ShotExport>>; recent: ShotExport[] }; saveShot(objective, shot); clearShot(objective) }
interface InteractionSlice { interaction: { dragging: null | 'dolly' | 'ring'; hover: null | 'camera' | 'ring' | 'primary' | 'secondary'; lastInputAt: number }; … }  // not persisted
```

Action semantics (all computed through engine functions, see §3):
- `setFocal(f)`: clamp 18–135. Fixed: only `rig.focalMm` changes (position and orientation untouched → perspective preserved). Match: `solveMatchedFraming({ rig, anchor, subject, newFocalMm: f, refMetric: matchRef.metric, bounds })` returns `{ rig, clamped }` (distance ∝ f + re-aim + clamp); `clampHint` set when clamped.
- `setDistance(d)`: `rig.distanceM = clampDistance(rig, d, bounds)`; in Match mode the reference metric is re-captured (`matchRef.metric = measure(...).subjectMetric`) so later focal changes hold the framing the user just chose.
- `setTarget(id)`: camera does not move: `rig' = rigFromPose(poseFromRig(rig, oldAnchor), newAnchor, focal)`; in Match mode recapture `matchRef`.
- `setMode('match')`: capture `matchRef.metric` from the current rig; `setMode('fixed')`: `matchRef = null`.
- `applyShot`: validates schema, sets rig from `shot.framing.rig` + target + focal + mode, seeks the timeline to `shot.timeline.timeS`.

### 2.2 Presentation (eased) state — outside React

`src/renderer/runtime/presentation.ts`:

```ts
interface Presentation {
  eased: { logF: number; logD: number; azimuthDeg: number; elevationDeg: number; aimYawDeg: number; aimPitchDeg: number }
  pose: CameraPose                     // { position: Vector3; quaternion: Quaternion; focalMm: number; vfovDeg: number }
  settled: boolean
}
export function advancePresentation(p: Presentation, target: CameraRig, anchor: Vector3, dt: number, opts: { dragging: boolean; reducedMotion: boolean; travel: boolean }) {
  const st = opts.dragging ? 0.06 : opts.travel ? 0.42 : 0.2          // smoothTime (s); 'travel' = Match-mode focal/mode change
  let moving = false
  moving = damp(p.eased, 'logF', Math.log(target.focalMm), st, dt) || moving
  moving = damp(p.eased, 'logD', Math.log(target.distanceM), st, dt) || moving
  moving = damp(p.eased, 'azimuthDeg', target.azimuthDeg, st, dt) || moving
  moving = damp(p.eased, 'elevationDeg', target.elevationDeg, st, dt) || moving
  moving = damp(p.eased, 'aimYawDeg', target.aimOffsetDeg[0], st, dt) || moving
  moving = damp(p.eased, 'aimPitchDeg', target.aimOffsetDeg[1], st, dt) || moving
  if (opts.reducedMotion) { snapAll(p.eased, target); moving = false }
  p.pose = poseFromRig(rigFromEased(p.eased, target), anchor); p.settled = !moving
}
```
maath verified: `damp(current, prop, target, smoothTime = 0.25, delta = 0.01, maxSpeed = Infinity, easing = exp, eps = 0.001): boolean` returns `true` while still moving (velocity stored on `current.__damp`), SmoothDamp with `omega = 2/smoothTime`. Log-space damping of focal and distance with the same smoothTime means that during a Match-mode travel `d/f` stays constant at every intermediate frame, so the subject keeps its size while the background visibly stretches/compresses — the teaching moment happens during the animation, not only at the end. `dt` is clamped to 1/30 before damping; `prefers-reduced-motion` snaps.

### 2.3 Readouts without React re-renders

`src/renderer/runtime/measurementStore.ts` = `createStore<Measurements>()(subscribeWithSelector(() => initial))`. The orchestrator computes `measure(pose, …)` each frame, quantizes (focal 0.1 mm, hFOV/vFOV 0.1°, distance 0.01 m, fraction 0.001, time 1/240 s, position 0.001 m) and calls `measurementStore.setState(next)` only if any quantized field changed. UI binding hook:

```ts
export function useMeasurementText<T>(select: (m: Measurements) => T, format: (v: T) => string) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => measurementStore.subscribe(select, v => { if (ref.current) ref.current.textContent = format(v) }, { fireImmediately: true }), [])
  return ref
}
```
Chips, the frustum pill, the monitor's readout strip, the scrubber thumb and the dev stats all use this. Accessibility text (`aria-valuetext`, the caption `aria-live="polite"` region) is derived from canonical targets in React and only changes on state changes (debounced 300 ms for the caption), per the Anatomy principle.

How every view derives from the same state: canonical store → (damping) → `presentation.pose` → written once per frame into the single `filmCamera` object (`position`, `quaternion`, `filmGauge 36`, `aspect 16/9`, `setFocalLength(f)`, `updateMatrixWorld()`) → used by the shot pass, the frustum lines (`frustumCornersAtDistance` from the same pose/fov), the camera body (`matrixWorld` copy), the measure wire, measurements, thumbnails (same rig with the preset focal substituted) and export (canonical, settled values; documented).

## 3. Simulation engine (`src/engine`, pure TS + three math only)

### 3.1 Modules and signatures

`math.ts`: `DEG`, `RAD`, `clamp`, `wrap(t, period)`, `lerpLog(a, b, u)`, `approxEq`.

`optics.ts`
```ts
export const GATE_36x20_25 = { widthMm: 36, heightMm: 20.25 } as const
export function hfovDeg(f: number, gate = GATE_36x20_25): number            // 2·atan(w/2f)
export function vfovDeg(f: number, gate = GATE_36x20_25): number            // 2·atan(h/2f)
export function frameSizeAtDistance(f: number, z: number, gate): { widthM: number; heightM: number }   // z·w/f, z·h/f
export function heightFraction(subjectHeightM: number, z: number, f: number, gate): number            // f·H/(z·h)
export function distanceForFraction(subjectHeightM: number, f: number, fraction: number, gate): number  // f·H/(F·h)
export function focalForFraction(subjectHeightM: number, z: number, fraction: number, gate): number
export function focalFromHfov(hfovDeg: number, gate): number
```

`projection.ts`
```ts
export interface Intrinsics { focalMm: number; gate: Gate; aspect: number; near: number; far: number }
export interface CameraPose { position: Vector3; quaternion: Quaternion }
export function projectionMatrix(i: Intrinsics): Matrix4                 // identical to three's PerspectiveCamera (tested)
export function viewMatrix(pose: CameraPose): Matrix4
export function projectPoint(pose, i, p: Vector3): { ndc: Vector2; depth: number; inFront: boolean }
export function ndcToDirectionCam(ndc: Vector2, i): Vector3              // (x·tan(h/2), y·tan(v/2), −1) normalized
export function frustumCornersAtDistance(pose, i, z: number): [Vector3, Vector3, Vector3, Vector3]  // TL, TR, BR, BL in world
export function frustumWire(pose, i, planes: number[]): Vector3[]        // line list for the tech view
```

`rig.ts`
```ts
export interface SceneDescriptor { anchors: Record<'primary'|'secondary', Vector3>; framingBoxes: Record<'primary'|'secondary', { bottom: Vector3; top: Vector3; heightM: number; name: string }>; depths: { foregroundZ: -1.5; primaryZ: -3; secondaryZ: -5; backdropZ: number }; stageBox: Box3; cameraMinDistanceM: 0.6; cameraMaxDistanceM: 14; noGoRadiusM: 0.45 }
export function anchorFor(id: FramingTargetId, d: SceneDescriptor): Vector3            // 'both' = midpoint of the two anchors
export function poseFromRig(rig: CameraRig, anchor: Vector3): CameraPose
export function rigFromPose(pose: CameraPose, anchor: Vector3, focalMm: number, targetId): CameraRig
export function dollyAxis(rig: CameraRig, anchor: Vector3): { origin: Vector3; dir: Vector3 }   // dir = unit(anchor→camera)
export function orientationZeroRoll(anchorDirWorld: Vector3, aimYawDeg: number, aimPitchDeg: number): Quaternion
```
`poseFromRig`: `position = anchor + distance · (sin az · cos el, sin el, cos az · cos el)` (az 0 → camera on +Z looking −Z). Orientation solves `R·c = d` with `R = Ry(ψ)·Rx(θ)` (zero roll), `c = (sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)` (where the anchor must appear) and `d = unit(anchor − position)`: with `r = √(c_y²+c_z²)`, `φ = atan2(c_z, c_y)`, `θ = ±acos(d_y / r) − φ` (pick the root with smaller |θ|), `v = Rx(θ)·c`, `ψ = atan2(d_x, d_z) − atan2(v_x, v_z)`; quaternion from Euler(θ, ψ, 0, 'YXZ'). `rigFromPose` inverts: `distance = |C−A|`, az/el from `C−A`, `c = R⁻¹·unit(A−C)`, `yaw = atan2(c_x, −c_z)`, `pitch = asin(c_y)`.

`matchFraming.ts`
```ts
export type SubjectSpec = { kind: 'box'; bottom: Vector3; top: Vector3 } | { kind: 'pair'; a: Vector3; b: Vector3 }
export function subjectMetric(pose, i, s: SubjectSpec): number     // box: (ndcTop.y − ndcBottom.y)/2 = height fraction of frame; pair: |ndc(a) − ndc(b)| in frame-height units
export function aimOffsetForNdc(ndc: Vector2, focalMm: number, gate): [yaw, pitch]   // tan(yaw) = x·tan(hfov/2), tan(pitch) = y·tan(vfov/2)
export function solveMatchedFraming(in: { rig: CameraRig; anchor: Vector3; subject: SubjectSpec; newFocalMm: number; refMetric: number; bounds: RigBounds; gate }): { rig: CameraRig; achievedMetric: number; clamped: null | 'min' | 'max' | 'stage' }
```
Algorithm: (1) record `anchorNdc0 = projectPoint(pose0, i0, anchor).ndc`; (2) closed-form guess `d1 = d0 · f1 / f0` (exact when the camera is level and the subject points share the anchor depth — this is the teachable Z ∝ f law); (3) refine `d` with ≤4 secant iterations on `g(d) = subjectMetric(poseFromRig({…rig, distanceM: d, focalMm: f1, aimOffsetDeg: aimOffsetForNdc(anchorNdc0, f1)}), …) − refMetric` (handles elevation, off-centre anchors and the 'pair' metric for Both, which has no closed form); (4) clamp via `bounds.ts` (`[0.6, 14] m`, stage box intersection along the dolly axis via ray–box slab test, no-go sphere around the anchor); (5) return new rig with recomputed aim offset so the anchor keeps its normalized screen position; `clamped` drives the UI hint ("Stage edge — 135 mm can't fully match from here").

`bounds.ts`: `RigBounds`, `clampDistanceAlongAxis(axis, d, bounds)`, `isInsideStage(p)`. Default stage box x∈[−5,5], y∈[0.3,4.5], z∈[−8.5,6.0] (135 mm matched from the 50 mm/3 m default needs z = +5.1).

`measure.ts`
```ts
export interface Measurements { focalMm; hfovDeg; vfovDeg; distanceM; cameraPosition: [x,y,z]; subjectFraction; subjectMetric; frameWidthAtSubjectM; frameHeightAtSubjectM; backdropCoverageWidthM; fgBgMagnification; clamped; shotSize: ShotSize; timeS; frame24 }
export function measure(pose, i, d: SceneDescriptor, targetId, timeS): Measurements
```
`subjectFraction` projects the target's static framing box (feet→crown at rest) through the actual projection — deterministic and testable; the UI labels it "subject height (standing)".

`observer.ts`: presets `{ id, label, position, target }`: `overview (−4.6, 3.1, 3.4 → 0, 1.1, −4)`, `profile (7.2, 1.7, −2.2 → 0, 1.2, −2.6)` (dolly travel reads best), `topdown (0, 12, −3 → 0, 0, −3.5)`, `overShoulder` (computed: film position + 1.2 m back + 0.6 m up, target = anchor), `throughLens` (= film pose; used for the swap transition). `nextPreset(id)`.

`threeAdapter.ts`: `applyIntrinsics(cam: PerspectiveCamera, i)`: `cam.filmGauge = 36; cam.aspect = 16/9; cam.near/far; cam.setFocalLength(f)` (verified: fov = 2·atan(getFilmHeight()/2/f) with `getFilmHeight = filmGauge / max(aspect,1)` = 20.25) plus an assertion `|cam.fov − vfovDeg(f)| < 1e-9`; `applyPose(cam, pose)`.

`export/schema.ts`, `export/build.ts`, `export/blender.ts`, `export/unreal.ts`, `export/prompt.ts` — see §3.3.

`timeline/clock.ts`, `timeline/tracks.ts`, `timeline/take.ts` — see §4.

### 3.2 Unit tests and invariants (Vitest, node)

- `optics.test.ts`: FOV table ±0.05°: 18 → 90.00/58.72, 24 → 73.74/45.75, 35 → 54.43/32.27, 50 → 39.60/22.90, 85 → 23.91/13.59, 135 → 15.19/8.58 (h/v). Frame at 3 m, 50 mm = 2.160 × 1.215 m. `distanceForFraction∘heightFraction` identity.
- `projection.test.ts`: `projectionMatrix(i)` equals `new PerspectiveCamera().{filmGauge=36,aspect=16/9,setFocalLength(f)}.projectionMatrix` element-wise (1e-9) for all presets; `projectPoint` equals `Vector3.project(camera)` for 200 random points (1e-9).
- `fixed-mode.test.ts`: for random rigs and points in front: `ndc(f2) === ndc(f1) · (f2/f1)` (1e-9) — NDC scales about the centre, perspective preserved; projected-size ratio of two objects at Z1, Z2 is independent of f.
- `match-mode.test.ts`: from 50 mm/3 m, for every preset: `achievedMetric` within 0.1 % of ref (unclamped), `distance ∝ f` within 0.5 % when level/centred (exact closed form), anchor NDC preserved ±1e-6; elevation 10° + aim (0.15, 0.2) still within 0.5 %; 'pair' (Both) metric held; clamped cases never leave the stage box and report `clamped`; solve is monotonic in f; idempotent (solving f→f returns the same rig).
- `rig.test.ts`: `rigFromPose(poseFromRig(r))` round-trip 1e-9; anchor projects to `tan(yaw)/tan(hfov/2)`; camera right vector has y = 0 (zero roll) for all presets; dolly axis passes through the anchor.
- `frustum.test.ts`: corners at Z project to NDC (±1, ±1) (1e-9); rectangle size = `frameSizeAtDistance`; rectangle height × subjectFraction = framing-box height → "frustum rectangle at the subject plane equals live coverage".
- `measure.test.ts`: default shot → 39.6°/22.9°, 3.00 m, fraction 1.48 (1.8 m character, 1.215 m frame); backdrop coverage at 9 m width = 6.48 m at 50 mm.
- `store.test.ts` (vanilla store): Fixed `setFocal` leaves position/quaternion unchanged; Match `setFocal` moves distance ∝ f and keeps metric; `setTarget` leaves the world pose unchanged (1e-9); `setMode('match')` captures `matchRef`; `applyShot` round-trips.
- `clock.test.ts`, `tracks.test.ts`, `export.test.ts`, `prompt.test.ts`, `tokens.test.ts` — see §4, §3.3, §7.

### 3.3 Export and prompt phrase

```ts
interface ShotExport {
  schemaVersion: 1; generator: 'animation-lab/lens-framing'; appVersion: string; createdAt: string
  units: { length: 'm'; angle: 'deg' }
  world: { handedness: 'right'; up: '+Y'; forward: '-Z'; origin: 'stage floor centre; default film plane at z=0' }
  camera: { position: [number, number, number]; quaternion: [number, number, number, number]; eulerYXZDeg: { yaw: number; pitch: number; roll: 0 }; forward: [n,n,n]; up: [n,n,n]; focalLengthMm: number; filmback: { widthMm: 36; heightMm: 20.25; fit: 'horizontal' }; aspectRatio: 1.7777778; fovDeg: { horizontal: number; vertical: number }; clip: { near: 0.05; far: 60 } }
  framing: { mode: 'fixed' | 'match'; targetId: FramingTargetId; anchor: [n,n,n]; distanceToAnchorM: number; subjectHeightFraction: number; rig: { azimuthDeg; elevationDeg; distanceM; aimOffsetDeg: [yaw, pitch] } }
  timeline: { takeId: 'doorway-wave'; timeS: number; durationS: 6; fps: 24; frame: number }
  conversions: { blender: { location: [x, -z, y]; rotation_euler_xyz_deg: [n,n,n]; lens_mm; sensor_fit: 'HORIZONTAL'; sensor_width: 36; sensor_height: 20.25; clip_start; clip_end }
                 unreal: { location_cm: [-z*100, x*100, y*100]; rotation_deg: { pitch; yaw; roll: 0 }; filmback: { sensorWidth: 36; sensorHeight: 20.25 }; currentFocalLength; lensSettings: { minFocalLength: 18; maxFocalLength: 135 } } }
  promptPhrase: string
}
```
Blender: `R_b = Rx(+90°)·R_three`, Euler XYZ in degrees via `new Euler().setFromRotationMatrix(m, 'XYZ')`. Unreal: `f_u = (−f_z, f_x, f_y)` from the three forward vector; `yaw = atan2(f_u.y, f_u.x)`, `pitch = asin(f_u.z)`, `roll = 0`. Tests pin: default pose (0, 1.45, 0) looking −Z → Blender `location (0, 0, 1.45)`, `rotation (90, 0, 0)`; Unreal `location_cm (0, 0, 145)`, rotator `(0, 0, 0)`; three yaw +30° → Blender rot_z +30°, Unreal yaw −30°; `parseShotExport(JSON.stringify(build(s)))` deep-equals; `applyShot` then `build` equals the input (1e-9); wrong `schemaVersion` rejected. `docs/EXPORT_SCHEMA.md` documents conventions.

`prompt.ts` (deterministic): focal class 18–24 "wide-angle" (18 "ultra-wide"), 28–40 "moderately wide", 45–60 "normal", 70–100 "short telephoto", ≥105 "telephoto"; shot size from `subjectFraction` (body height / frame height): <0.45 wide establishing, 0.45–0.85 wide shot, 0.85–1.2 full shot, 1.2–1.55 medium full, 1.55–2.2 medium shot, 2.2–3.1 medium close-up, 3.1–5 close-up, >5 extreme close-up; angle: elevation >12° high angle, <−8° low angle, else eye level; perspective note: wide & d<2 m "exaggerated depth, foreground looms", tele & d>5 m "compressed depth, background drawn close", else "natural perspective". Template: `"{f} mm {focalClass} {shotSize} of {subjectName}, {angle}, camera {d} m from subject, {perspectiveNote}; background spans {coverage} m"`. Tests pin a table of 8 cases.

## 4. Deterministic timeline

```ts
export class MasterClock {
  constructor(private now: () => number = () => performance.now()) {}
  durationS = 6; loop = true; speed = 1; frameT = 0
  private playing = false; private baseS = 0; private anchorMs = 0
  play()  { if (!this.playing) { this.anchorMs = this.now(); this.playing = true } }
  pause() { if (this.playing)  { this.baseS = this.peek(); this.playing = false } }
  seek(t: number) { this.baseS = wrap(t, this.durationS); this.anchorMs = this.now() }
  setSpeed(s: number) { this.baseS = this.peek(); this.anchorMs = this.now(); this.speed = s }
  peek(): number { const raw = this.playing ? this.baseS + ((this.now() - this.anchorMs) / 1000) * this.speed : this.baseS; return this.loop ? wrap(raw, this.durationS) : clamp(raw, 0, this.durationS) }
  tick(): number { return (this.frameT = this.peek()) }   // exactly once per frame, first thing in the orchestrator
}
```
- Absolute mapping (no accumulation) → no drift; `visibilitychange: hidden` pauses and `visible` resumes so a paused inspection never jumps. dt clamping applies to damping, not to timeline time.
- Store ↔ clock: timeline slice actions call clock methods and update `playing/speed/seekTime` for the UI; the scrubber reads `measurementStore.timeS` while playing (transient binding) and writes `seek(t)` on input; `step(±1)` moves 1/24 s when paused.
- Updater registry (`frameBus.ts`): `registerUpdater(fn, order)` / `useFrameUpdater(fn, order)` (effects register/unregister; idempotent under StrictMode). Orders: 0 puppets, 10 camera rig + film camera sync, 20 tech view geometry, 30 measurements. All read `ctx.t` = `clock.frameT`, so stage, shot and thumbnails render the identical pose.
- Pose evaluation: `tracks.ts` — `Track { times: Float32Array; values: Float32Array; interp: 'linear' | 'step' | 'cubic'; ease?: 'inOut' | 'out' | 'in' }`, `sampleTrack(track, t)`; `take.ts` — `Take { id; durationS; performances: Record<'primary'|'secondary', Performance>; cameraPaths: CameraPath[] }` (camera paths = keyframed rig fields; empty for the MVP), `Performance { channels: Record<string, Track> }`, `evaluatePerformance(perf, t, out)`. `scene/performances/doorwayWave.ts` holds the 6 s data; every channel returns to its start value at 6.0 s (loop-closure test `pose(0) ≈ pose(6)`). Puppets bind channels to refs in `usePuppetChannels(bindings)` whose updater writes `ref.rotation.y = v` etc.
- Future GLB rig: `useGlbRig(url)` registers an updater calling `mixer.setTime(clamp(t))` on a three `AnimationMixer` (LoopRepeat actions) — standard three API, not re-verified this session.
- Scrubbing while paused: `seek` → store change → `invalidate()` → one frame: tick returns the seeked t, all updaters run, both passes render, thumbnails marked dirty and refreshed (≤2 per frame) → pause-and-compare under different lenses works because camera changes never touch the clock.

## 5. Interaction mechanics

- Dolly drag (`useDollyDrag`): `onPointerDown` on the camera body: `e.stopPropagation(); e.target.setPointerCapture(e.pointerId)`; `axis = dollyAxis(rig, anchor)`; `s0 = closestParamOnAxis(axis, e.ray)`; `grab = s0 − rig.distanceM`; `interaction.dragging = 'dolly'`; `controls.enabled = false`. `onPointerMove`: `s = closestParamOnAxis(axis, e.ray)`; `setDistance(s − grab, 'drag')`. `onPointerUp`: release capture, re-enable controls, `dragging = null`. `closestParamOnAxis({o, d}, {p, u})`: `w = o − p; b = d·u; den = 1 − b²; if den < 0.02 → keep last s; s = (b·(u·w) − d·w) / den`. Cursor `grab`/`grabbing` via drei `useCursor`; readout follows with smoothTime 0.06 (feels instant).
- Lens ring (`useLensRingDrag`): project the ring centre with the observer camera; `Δangle` of the pointer around it (unwrapped) → `ΔlogF = Δangle / (1.5π) · ln(135/18)` (270° throw = full range); fallback to horizontal pixels (`Δx / 520 px · ln(135/18)`) when the projected ring radius < 14 px or the ring is edge-on; release snaps to a preset if within 3 %; ring mesh rotation = `(ln f − ln 18)/(ln 135 − ln 18) · 270°` from the eased focal; wheel over the camera body nudges log f.
- Click-to-target: invisible capsule hit volumes per character (`visible={false}`, layer 1; three's Raycaster does not test `visible`), `onClick` with `e.delta <= 4` → `setTarget(id)`; the monitor's own click handler raycasts with the film camera. Hover sets `interaction.hover` → DOM tooltip following the pointer ("Drag to dolly", "Drag to turn the lens ring", "Click to frame Juno").
- Observer camera: drei `<CameraControls makeDefault domElement={stageEl} minPolarAngle={0.12} maxPolarAngle={Math.PI/2 − 0.04} minDistance={1.2} maxDistance={28} smoothTime={0.18} draggingSmoothTime={0.06} dollyToCursor regress>` + `controls.setBoundary(stageBox)`; presets via `setLookAt(px,py,pz,tx,ty,tz,true)`; idle tour: after 1.4 s without input, `rotateTo(az + 0.08·k, polar, true)` beats cancelled by any input, resumes after 3.6 s; `R`/double-click resets; reduced motion → `enableTransition=false`. Independence: controls only ever touch the R3F default (observer) camera; the film camera is a plain object synced from presentation.
- Keyboard (`useShortcuts`): ignored when `e.target` is input/textarea/select/contenteditable or a dialog is open (except Esc). `1–6` presets 18/24/35/50/85/135; `[`/`]` ∓1 mm (Shift ×5); `-`/`=` distance ∓0.1 m; `M` mode; `T` target; `Space` play/pause; `R` restart; `←/→` step frame when paused; `V` observer preset; `Shift+S` swap; `Shift+F` fullscreen shot; `Shift+H` hide UI; `Shift+C` copy shot settings; `G` guides; `?` help. Every shortcut emits a toast.
- Touch: `touch-action: none` on the stage slot; CameraControls handles 1-finger rotate / 2-finger dolly+truck; pointer capture covers touch drags; hover-only affordances hidden under `(hover: none)`; 44 px targets.

## 6. Performance budget

Targets: 60 fps at 2560×1440 CSS px on M1/M2 (DPR cap 1.5 → 3840×2160 stage + ~1.3 MP shot), ≥30 fps on a mid-range Windows iGPU at 1920×1080 DPR 1.
- Draw calls per stage pass ≤ 110 (primary puppet ≤ 22 after `mergeGeometries` of same-material parts, secondary ≤ 16, set ≤ 35, tech ≤ 20: one `Line2` for the frustum wire, one `LineSegments` for all ruler ticks, ≤ 8 merged camera-body meshes, markers); shot pass ≤ 90; thumbnail pass ≤ 90 (≤1 per frame while playing).
- Triangles ≤ 250 k; unique materials ≤ 24 (shared via `scene/materials/palette.ts`); lights ≤ 4 (1 directional key with 2048² PCFSoft shadows, 1 hemisphere, 2 practical points without shadows); shadows rendered once per frame and only when casters moved.
- Post (stage primary only): Bloom mipmap + Vignette + ToneMapping, composer MSAA 4; budget ≤ 3.5 ms at 3840×2160 on M1.
- Measure: `DevStats` overlay (`?debug=1`) reads `gl.info.render.calls/triangles` and per-phase `performance.now()` deltas from the orchestrator (tick, updaters, shadows, stage, shot, thumbs); r3f-perf optional.
- Degradation ladder (QualityController, driven by `PerformanceMonitor` and the manual Auto/High/Low control): Q3 dpr ≤1.5 + post + shadows 2048 + live thumbs → Q2 dpr 1.25 + shadows 1024 → Q1 dpr 1 + post off + thumbs idle-only → Q0 dpr 0.75 + shadows 512 + bloom off; `flipflops={3}` → `onFallback` pins Q1; `regress` during orbit scales dpr by `performance.current` (min 0.6).

## 7. Next.js integration

- Routes: `src/app/page.tsx` (server, static) renders the registry from `src/labs/registry.ts` — available lab links to `/labs/lens-framing`; concept labs render as non-interactive cards (`aria-disabled`, "Concept — not built yet" badge, no href). `src/app/labs/lens-framing/page.tsx` (server, static) renders `<LensFramingLabLoader/>`; the loader is `'use client'` with `dynamic(() => import('./LensFramingLab'), { ssr: false, loading: LabSkeleton })` (verified: `ssr:false` only in Client Components).
- `next.config.ts`: keep `cacheComponents: true`, `partialPrefetching: true`, add `transpilePackages: ['three']` (R3F docs recommendation; harmless under Turbopack). Activity (verified) keeps ≤3 hidden routes mounted with effects cleaned up: the R3F root unmounts (context released) when navigating home; the lab root also pauses the clock in an effect cleanup. Fallback: `cacheComponents: false` is a one-line change (no `use cache` usage anywhere).
- Deep links `?f=50&d=3&mode=match&target=primary&t=2.4&view=shot` parsed from `window.location.search` in a mount effect (no `useSearchParams`, so no Suspense requirement); `history.replaceState` mirrors state (debounced 500 ms).
- Fonts: `next/font/google` with `variable` (`--font-sans-next`, `--font-mono-next`) on `<html>`; Tailwind v4 `@theme inline { --font-sans: var(--font-sans-next); --font-mono: var(--font-mono-next); --color-…: var(--al-…) }` (verified pattern). Fonts must not be Outfit / DM Mono.
- Tokens: `src/lib/tokens.ts` (TS source: stage graphite/navy, warm practical amber, cyan measurement, amber active, glass alphas, radii, durations) → `scripts/gen-tokens.mjs` → `src/app/tokens.css` (`:root { --al-… }`, committed) → `globals.css` imports it; three materials import `tokens` (R3F sets `ColorManagement.enabled = true`, so hex is sRGB → linear and matches CSS); `tokens.test.ts` regenerates in memory and fails if the CSS is stale.
- Vercel: default Next output (static prerender, no server functions, no special headers); pnpm 10 via `packageManager`. Bundle: the home route must not import three (dynamic boundary at the lab); named drei imports; check with `@next/bundle-analyzer`; target ≤ 450 kB gz JS for the lab route.
- ESLint: `src/engine/**` override with `no-restricted-imports` for `react`, `@react-three/*`, `three/addons/*`, `next/*`.
- Vitest: `vitest.config.ts` `{ test: { environment: 'node', include: ['src/**/*.test.ts'] }, resolve: { alias: { '@': '/src' } } }`. Playwright: production server (`pnpm build && pnpm start`), Chromium projects at 1280×720, 1440×900, 1920×1080, 2560×1440 (deviceScaleFactor 1); `e2e/lab.spec.ts` (canvas present; readout 39.6°; slider → 73.7°; Match toggles change distance readout; export JSON validates; exercise 1 completes after 24/50/85; swap/fullscreen; stage/monitor screenshots with `maxDiffPixelRatio 0.02`; colour-parity sample), `e2e/home.spec.ts` (future labs are not links). `docs/LIMITATIONS.md` documents pinhole-only optics, static framing anchors, no DOF/distortion, thumbnails refreshed at ≤10 Hz, WebGL2 required, Safari DPR behaviour.

## 8. File tree (src/) — see `file_tree` for the per-file list

Module split: `engine/` (pure simulation) · `scene/` (world, puppets, performances, materials, layers) · `renderer/` (runtime orchestrator, presentation, viewports, quality, stage technical view, interaction) · `live/` (shot pass, monitor DOM, guides, thumbnails/filmstrip) · `lessons/` (exercises, trackers, copy) · `ui/` (store, controls, readouts, transport, export, overlays, shortcuts, primitives) · `labs/` (registry, lab entry) · `lib/` (tokens, format, clipboard, storage). Dependency rule: `engine` ← `scene`/`renderer`/`live`/`lessons`/`ui`; `renderer` and `live` share `renderer/runtime`; `ui` never imports three objects except through `renderer/runtime` hooks.

## 9. Default numbers (engine config, adjustable by the scene work)

Film camera default: 50 mm, rig {targetId primary, az 0°, el 0°, distance 3.0 m, aim (0°, 0°)} → position (0, 1.45, 0) looking −Z. Primary anchor (0, 1.45, −3.0), framing box 0–1.8 m; secondary anchor (0.9, 0.8, −5.0), framing box 0–1.1 m (its 'mark' after emerging from the doorway at x≈1.3); Both = midpoint (0.45, 1.125, −4.0); foreground object at z −1.5; backdrop z −9 (adjustable 7–12). Observer default = `overview`. Monitor default ≈ 40 % width, 16:9. Presets 18/24/35/50/85/135.

## 10. Phases and verification — see `phases`.


### File tree
- src/app/layout.tsx — root layout: next/font variables, metadata, html/body classes
- src/app/globals.css — Tailwind v4 import + @theme inline mapping to tokens.css
- src/app/tokens.css — GENERATED from lib/tokens.ts (:root --al-* variables)
- src/app/page.tsx — home: Lab Registry grid (server component, static)
- src/app/labs/lens-framing/page.tsx — static page shell rendering LensFramingLabLoader
- src/labs/registry.ts — LabDefinition[] (id, title, description, category, preview, status, entry)
- src/labs/types.ts — LabDefinition/LabStatus types
- src/labs/lens-framing/LensFramingLabLoader.tsx — 'use client' + next/dynamic(ssr:false)
- src/labs/lens-framing/LensFramingLab.tsx — lab root: rehydrate store, deep links, shortcuts, layout, canvas mount
- src/labs/lens-framing/layout/LabLayout.tsx — DOM slots (stage, shot), panels, filmstrip, swap/fullscreen CSS
- src/labs/lens-framing/config.ts — defaults: focal 50, distance 3, presets, bounds, gate, observer default
- src/engine/math.ts — deg/rad, clamp, wrap, log lerp
- src/engine/optics.ts — hfov/vfov, frame size at distance, height fraction, inverse formulas
- src/engine/projection.ts — projection/view matrices, projectPoint, ndc→direction, frustum corners/wire
- src/engine/rig.ts — CameraRig, SceneDescriptor, poseFromRig/rigFromPose, dollyAxis, zero-roll orientation
- src/engine/matchFraming.ts — subjectMetric, aimOffsetForNdc, solveMatchedFraming (closed form + secant + clamp)
- src/engine/bounds.ts — RigBounds, stage box clamp along the dolly axis, no-go radius
- src/engine/measure.ts — Measurements from actual pose/intrinsics/scene descriptor
- src/engine/observer.ts — observer camera presets
- src/engine/threeAdapter.ts — applyIntrinsics/applyPose to THREE.PerspectiveCamera (filmGauge 36, aspect 16/9)
- src/engine/export/schema.ts — ShotExport v1 types + validation
- src/engine/export/build.ts — buildShotExport / parseShotExport
- src/engine/export/blender.ts — three→Blender location/rotation/sensor conversion
- src/engine/export/unreal.ts — three→Unreal cm/rotator/filmback conversion
- src/engine/export/prompt.ts — shot-language promptPhrase classifier
- src/engine/timeline/clock.ts — MasterClock (play/pause/seek/speed/loop, injectable now)
- src/engine/timeline/tracks.ts — keyframe Track + sampleTrack + easings
- src/engine/timeline/take.ts — Take/Performance types, evaluatePerformance
- src/engine/__tests__/*.test.ts — optics, projection, fixed-mode, match-mode, rig, frustum, measure, clock, tracks, export, prompt, store
- src/scene/SceneWorld.tsx — lights, fog/background, set, characters composition
- src/scene/layers.ts — LAYER_WORLD/LAYER_TECH + <TechLayer> traverse helper
- src/scene/sceneDescriptor.ts — static anchors, framing boxes, depths, stage box for the engine
- src/scene/environment/StageSet.tsx, Doorway.tsx, PracticalLamp.tsx, ForegroundObject.tsx, Backdrop.tsx — set pieces
- src/scene/characters/PrimaryPuppet.tsx, SecondaryPuppet.tsx, parts/*.tsx, hitVolumes.tsx — procedural puppets + click volumes
- src/scene/materials/palette.ts — shared toon/satin materials built from tokens
- src/scene/performances/doorwayWave.ts — the 6 s take (keyframe channel data)
- src/scene/animation/usePuppetChannels.ts — binds channels to refs via frame updater
- src/renderer/runtime/FrameOrchestrator.tsx — the single useFrame(…,1): tick → updaters → shadows → passes → invalidate
- src/renderer/runtime/frameBus.ts — updater registry + useFrameUpdater(order)
- src/renderer/runtime/presentation.ts — eased presentation state + advancePresentation (maath damp, log space)
- src/renderer/runtime/filmCamera.ts — the film PerspectiveCamera singleton + sync
- src/renderer/runtime/viewports.ts — DOM slot registry, ResizeObserver, rect→GL viewport/scissor
- src/renderer/runtime/quality.ts — QualityController (dpr/post/shadows/thumbs), PerformanceMonitor glue
- src/renderer/runtime/contextLoss.ts — webglcontextlost/restored handling
- src/renderer/runtime/measurementStore.ts — vanilla zustand store for per-frame readouts (quantized)
- src/renderer/stage/StageCanvas.tsx — <Canvas frameloop='demand' dpr shadows eventSource events={…}> + providers
- src/renderer/stage/ObserverControls.tsx — drei CameraControls config, presets, idle tour, boundary
- src/renderer/stage/StagePost.ts — postprocessing EffectComposer stack (Bloom, Vignette, ToneMapping, MSAA 4)
- src/renderer/stage/tech/CameraBody.tsx, LensRing.tsx, Frustum.tsx, DollyAxis.tsx, TargetIndicator.tsx, StageRulers.tsx, MeasureWire.tsx, StagePills.tsx — technical visualization (layer 1)
- src/renderer/stage/interaction/useDollyDrag.ts, useLensRingDrag.ts, useTargetClick.ts, cursors.ts — direct manipulation
- src/renderer/events/computePointer.ts — custom R3F events.compute gated on the stage slot
- src/live/ShotPass.ts — renders the scene with filmCamera into the shot slot rect
- src/live/ShotMonitor.tsx — DOM frame: 16:9 slot, SVG guides, readout strip, click-to-target
- src/live/guides/ThirdsOverlay.tsx, SafeAreaOverlay.tsx — crisp DOM/SVG framing guides
- src/live/thumbnails/ThumbnailRenderer.ts — 6 HalfFloat RTs, scheduler, tone-mapped blit
- src/live/thumbnails/Filmstrip.tsx — DOM filmstrip slots (buttons with transparent windows)
- src/lessons/exercises.ts — exercise definitions + completion predicates
- src/lessons/trackers.ts — store subscriptions → progress updates
- src/lessons/LessonPanel.tsx, LessonCaption.tsx — lesson UI
- src/lessons/copy/*.ts — educational text per focal class/mode
- src/ui/store/labStore.ts — root zustand store (slices, subscribeWithSelector, persist)
- src/ui/store/slices/camera.ts, timeline.ts, viz.ts, ui.ts, lesson.ts, shots.ts, interaction.ts — slices
- src/ui/store/useMeasurement.ts — transient DOM binding hook (subscribe → textContent)
- src/ui/controls/ControlsPanel.tsx, FocalSlider.tsx, LensDial.tsx, DistanceSlider.tsx, ModeSegmented.tsx, TargetSegmented.tsx, VizToggles.tsx — controls
- src/ui/readouts/ReadoutChips.tsx, Caption.tsx — top-left chips + aria-live caption
- src/ui/timeline/TransportBar.tsx, Scrubber.tsx — play/pause/restart/scrub/speed
- src/ui/export/CopyShotButton.tsx, ShotJsonDialog.tsx — Copy Shot Settings + prompt phrase
- src/ui/overlays/HelpDialog.tsx, Toasts.tsx, KeyLegend.tsx, ContextLostOverlay.tsx — overlays
- src/ui/shortcuts/useShortcuts.ts, keymap.ts — keyboard routing
- src/ui/primitives/Glass.tsx, Segmented.tsx, Slider.tsx, IconButton.tsx, Pill.tsx — design primitives
- src/ui/dev/DevStats.tsx — draw calls/triangles/phase timings (?debug=1)
- src/lib/tokens.ts — design tokens (source of truth)
- src/lib/format.ts — mm/m/°/% formatting
- src/lib/clipboard.ts, storage.ts, reducedMotion.ts — small utilities
- scripts/gen-tokens.mjs — emits src/app/tokens.css from tokens.ts
- scripts/gen-hero-asset.mjs — optional offline fal.ai mesh generation (never at runtime)
- e2e/lab.spec.ts, e2e/home.spec.ts — Playwright tests + screenshots
- vitest.config.ts, playwright.config.ts — test configs
- docs/LIMITATIONS.md, docs/EXPORT_SCHEMA.md — documentation

### Phases
- **P0 — Foundation and engine** — Install the stack, lock config, and ship the pure engine with tests before any pixels.
  - deliverables: pnpm add three@~0.187 @react-three/fiber@9.8.2 @react-three/drei@10.7.9 zustand@5.0.16 maath@0.10.8 postprocessing; dev: @types/three, vitest@5, vite@^8, @playwright/test@1.64.1; next.config.ts: + transpilePackages ['three'] (keep cacheComponents/partialPrefetching); .gitignore + !.env.example; align env key name (FAL_KEY vs FAL_API_KEY); src/lib/tokens.ts + scripts/gen-tokens.mjs + src/app/tokens.css + globals.css @theme inline; fonts via next/font variables; src/engine/* (optics, projection, rig, matchFraming, bounds, measure, observer, threeAdapter, export/*, timeline/*) with Vitest suites; src/ui/store/labStore.ts with all slices and node tests; src/labs/registry.ts + home page cards
  - verification: pnpm test green: FOV table ±0.05°, projection == three PerspectiveCamera (1e-9), fixed-mode NDC scaling, match-mode metric within 0.1 %, rig round-trips, export round-trips, clock determinism, tokens in sync; pnpm typecheck + lint clean; eslint engine import restriction enforced; pnpm build succeeds; home route bundle contains no three
- **P1 — Rendering core** — One canvas, orchestrated passes, same world and same time in both views.
  - deliverables: StageCanvas (frameloop demand, dpr, shadows, eventSource/compute), FrameOrchestrator, frameBus, presentation damping, filmCamera sync, viewports registry, measurementStore; SceneWorld with placeholder puppets bound to doorwayWave channels via usePuppetChannels; layers helper; lights; ShotPass into the DOM-tracked 16:9 slot; ShotMonitor frame; swap primary + fullscreen shot; CameraControls observer with limits; Readout chips + caption bound transiently; FocalSlider/DistanceSlider/Mode/Target controls wired to store actions
  - verification: Playwright: readout 39.6° at 50 mm, 73.7° at 24 mm, 23.9° at 85 mm; Fixed keeps cameraPosition readout constant; Match changes distance ∝ f; Manual: pause, scrub, change lens → both views show the identical frame; DevStats shows shadow pass once per frame; Colour parity sample between stage (direct) and shot passes within 2/255
- **P2 — Stage technical view and direct manipulation** — The crafted rig: frustum, camera body, rulers, measure wire, drag interactions.
  - deliverables: Frustum (Line2 wire + subject-plane and backdrop rectangles), CameraBody + LensRing, DollyAxis, TargetIndicator, StageRulers (single LineSegments ticks), MeasureWire with Html pills (clip-path hole under the monitor); useDollyDrag (closest point on axis, pointer capture, controls disabled while dragging), useLensRingDrag (log-space angular drag, preset snap), useTargetClick + monitor click-to-target, cursors/tooltips; Keyboard shortcuts + toasts; observer presets + idle tour; reduced-motion snapping
  - verification: Unit: frustum corners project to (±1,±1); subject rectangle height × fraction = framing box height; Playwright: drag camera body changes distance readout; ring drag changes focal; click character switches target; swap keeps interactions working in PiP; Perf: ≤110 draw calls stage pass (DevStats)
- **P3 — Shot polish, thumbnails, post, quality, export** — Director's monitor feel, filmstrip previews, cinematic stage look, resilient performance.
  - deliverables: StagePost composer (Bloom/Vignette/ToneMapping, MSAA 4) with parity test; shot vignette DOM overlay; thirds/safe-area SVG guides; focal/FOV/distance strip on the monitor; ThumbnailRenderer (6 HalfFloat RTs, scheduler, tone-mapped blit) + Filmstrip slots; previews reflect current mode; QualityController + PerformanceMonitor ladder; context-loss overlay and recovery; DevStats; Copy Shot Settings (JSON + promptPhrase), ShotJsonDialog, deep links
  - verification: Playwright: export JSON validates against schema; promptPhrase matches classifier for the default shot; thumbnails update after lens change while paused; Perf: 60 fps on M1 at 1440p DPR 1.5 with post; ladder drops to Q1 under forced load (dev flag); Parity: stage vs shot vs thumbnail colour sample within tolerance
- **P4 — Lessons, help, registry polish** — Three exercises tracking real state; beginner-correct copy; home registry with clearly unavailable concepts.
  - deliverables: exercises.ts + trackers.ts (ex1 visited 24/50/85 in Fixed with settle ≥400 ms; ex2 Match compare 24/85 from an MCU start; ex3 one saved shot per objective) persisted; LessonPanel, LessonCaption, HelpDialog with KEYS legend and physical assumptions footnote; Home registry cards (available vs concept, aria-disabled, no links for concepts)
  - verification: Store tests: tracker transitions on simulated sequences; Playwright: exercise 1 completes; exercise 3 saves two shots and persists across reload; concept labs not clickable
- **P5 — Hardening, tests, docs** — Ship-ready: browser tests at multiple sizes, documented limitations, bundle and perf audits.
  - deliverables: Playwright screenshot suites at 1280×720, 1440×900, 1920×1080, 2560×1440; docs/LIMITATIONS.md, docs/EXPORT_SCHEMA.md, README sections (architecture split, scripts); Bundle analysis report; final degradation tuning; Vercel preview deploy checklist
  - verification: All vitest + playwright suites green in CI; screenshots stable (maxDiffPixelRatio 0.02); Lab route JS ≤ 450 kB gz; home route without three; Manual acceptance walk-through of the 15 criteria

### Risks
- Colour mismatch between the stage pass (composer, HalfFloat + ToneMappingEffect) and the direct shot pass / tone-mapped thumbnail blit, which would make the 'same world' claim visibly false. [medium] → Parity Playwright test on a neutral card from the first composer commit; fallback to UnsignedByteType composer buffers (renderer tone mapping in RenderPass) which is parity-exact; thumbnails use the same tonemapping/colorspace includes as three.
- R3F events.compute gating / eventSource on a wrapper misroutes pointer events after swapping primary (PiP stage). [medium] → Mirror drei View's verified compute pattern (gate on element containment, map through the slot rect); Playwright tests exercise drag/click in both layouts.
- Match-mode clamping at the stage edge (135 mm from far targets, 18 mm into the no-go radius) feels broken rather than graceful. [medium] → Engine returns a clamped reason; UI shows a hint chip and the frustum/measure wire turns amber; stage box sized so all presets from the default shot are reachable.
- Activity route preservation (cacheComponents) keeps the lab mounted hidden, leaving timers/contexts alive or breaking Playwright visibility assumptions. [low-medium] → Verified: effects are cleaned up when hidden (R3F root unmounts); clock paused in cleanup; Playwright uses visibility-aware getByRole locators; one-line fallback cacheComponents:false.
- Per-frame thumbnail renders plus post push iGPU laptops below 30 fps. [medium] → Thumbnails ≤1 per frame and idle-only at Q1; PerformanceMonitor ladder with flipflop fallback; DevStats timings per phase to find the culprit.
- Damping aim offset linearly during Match travel lets the anchor drift slightly mid-transition. [low] → Drift is bounded (converges exactly); if visible, recompute aim offset per frame from eased f via aimOffsetForNdc (closed form, cheap).
- three r187 reversed-depth/shadow changes or drei 10.7 CameraControls (camera-controls v3) API differences surprise at integration time. [low] → Pin exact versions; CameraControls methods verified against the library README; keep OrbitControls as a drop-in fallback behind the same ObserverControls component.
- Zero-roll orientation solve has no solution for extreme aim offsets combined with steep elevation (|d_y| > r). [low] → Aim offsets are bounded to ±25° and elevation to ±60° in bounds.ts; solver falls back to lookAt∘offset⁻¹ composition when out of domain (unit-tested).

### Open questions
- Env key naming: the scaffolded .env.example uses FAL_API_KEY= while the task text says .env.local holds FAL_KEY — which name should scripts/gen-hero-asset.mjs read?
- Monitor default placement (bottom-right vs right-centre) and exact size (40 % width) — layout decided, position for the design pass to confirm.
- Framing target 'Both' semantics: proposed metric is the on-screen separation of the two characters' anchors (midpoint anchor); acceptable, or should 'Both' hold the union framing box height instead?
- Should thumbnails in Match mode preview the *matched* camera positions (proposed) or always the current position with the preset focal only?
- Composer buffer type: start with HalfFloat + ToneMappingEffect (nicer bloom) or UnsignedByteType (parity-exact by construction)? Plan starts with HalfFloat and falls back on parity failure.
- Observer controls: CameraControls (transitions, boundary) chosen; confirm no objection to the extra camera-controls dependency pulled by drei.
- Font choice (any except Outfit/DM Mono): proposal Instrument Sans + JetBrains Mono, or Geist/Geist Mono already wired by the scaffold.
- Deep links: keep state mirrored in the URL (replaceState) or export-only? Proposed: read on load, mirror debounced.
- Quality presets: should 'High' allow DPR 2 on M-series laptops (cost ≈ 1.8× stage pixels)?
