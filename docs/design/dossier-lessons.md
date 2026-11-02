> **INPUT — superseded by the implementation and `docs/design/decisions.md` wherever they differ. Do not copy numbers from here.**

## Product, lessons, copy, extensibility, export, verification and delivery plan (read-only architecture pass; no files created)

### Summary
The directory is no longer bare: create-next-app 16.4.3 has already run (one commit "Initial commit from Create Next App" on main; next 16.4.3, react 19.3.0, tailwind 4.3.3, eslint 9.39.5, typescript 5.9.3 installed; no three/R3F/drei/zustand/vitest/playwright yet; .env.example says FAL_API_KEY= and .gitignore lacks !.env.example). The plan therefore "adjusts the scaffold" rather than scaffolding. It specifies: (1) a data-driven lesson engine (free-explore + 3 exercises) whose completion predicates are evaluated from real store events (1 s hold timers, Match travel accumulation, saved-shot objectives), a Save-shot tray with canvas-cropped thumbnails, and localStorage persistence via zustand persist with skipHydration; (2) the full educational copy: 6 lens classes x Fixed/Match titles+sentences, live caption templates, perspective-guide pill copy, help modal and assumptions footnote, Exercise 3 suggested configurations; (3) the promptPhrase generator (shot size from full-body frame fraction, lens class bins, angle from pitch/roll, perspective class from k = Zs/Zb with 0.5/0.15 thresholds, static movement) and the animation-lab.shot/1 JSON export with precomputed Blender (x,-z,y; Euler 'ZYX' decomposition of Rx(90)·R) and Unreal (100·(-z,x,y); FRotator from the similarity-transformed matrix) blocks plus hand-computed worked examples; (4) a Lab Registry (types, data, / and /labs/[labId] with generateStaticParams + notFound, future labs visibly "Concept · not yet built"); (5) a complete key map (resolving the '?' vs Shift+/ collision by using Shift+U for hide-UI) and accessibility rules; (6) a verification plan: Vitest suites with exact expected numbers, Playwright flows using a window.__animationLab hook and data-* attributes, screenshots at 1920x1080/1440x900/1280x800, a monitor visual baseline at 24/50/85, a screenshot review protocol, perf budgets and the "green build is never completion" rule; (7) a six-phase delivery plan with exit criteria, exact package pins (R3F 9.8.2 requires react >=19 <19.4; drei 10.7.9; three 0.187; zustand 5.0.16; maath 0.10.8; vitest 5.0.5 + vite ^8; @playwright/test 1.64.1; @fal-ai/client 1.10.1), engines.node "26.x" (Vercel default), mise.toml, env/gitignore fixes, an optional cost-guarded Meshy script (fal-ai/meshy/v7.1/text-to-3d: $0.80 untextured / $1.20 textured); (8) a risk register. All library behaviour cited is verified against package sources/docs listed in verified_api_facts.

### Key decisions
- **Project state**: Treat the repo as an existing create-next-app 16.4.3 scaffold (already committed by CNA) and only adjust it; do not re-scaffold.
  - why: ls shows .git, node_modules, src/app, package.json with next 16.4.3 / react 19.3.0; git log has one commit. Re-scaffolding would collide with .env files and the existing commit.
  - alternatives: Scaffold in a temp sibling and merge (the brief's workaround) — unnecessary now.
- **Lesson completion semantics**: Completion predicates are evaluated from a typed event log fed by zustand subscribeWithSelector subscriptions and a 1000 ms hold timer (HOLD_MS), never from button clicks.
  - why: The spec requires exercises to track real interaction state; a hold timer distinguishes 'explored' from 'passed through while dragging'.
  - alternatives: Counting slider release events (misses keyboard/preset paths); per-frame polling (wasteful, non-deterministic in tests).
- **Progress persistence**: Separate useProgressStore (zustand persist, name 'animation-lab.progress.v1', skipHydration: true, rehydrate() in useEffect) holding exercise progress, saved shots (<=12, JPEG data URLs 320x180) and UI prefs; the live lab store is never persisted.
  - why: Avoids SSR hydration mismatches on the home page and keeps the canonical camera/scene state transient and testable.
  - alternatives: Persisting the whole lab store (would restore stale camera poses and fight exercise initial states).
- **Thumbnails**: Crop the presented canvas (gl.domElement → 2D canvas drawImage) inside a post-render useFrame callback in the same rAF tick; do not read an FBO.
  - why: Same-tick capture works without preserveDrawingBuffer (default false, verified) and yields the tone-mapped, sRGB image the user sees; drei's useFBO defaults to HalfFloatType and off-screen targets skip tone mapping.
  - alternatives: readRenderTargetPixelsAsync on a UnsignedByteType target plus a copy pass (more code, colour drift risk).
- **Shot-size classification**: Classify from p = projected full-body height / frame height: <0.30 EWS, <0.65 WS, <1.15 FS, <2.0 MS, <3.5 MCU, <7 CU, else ECU; measured by projecting the target's body segment endpoints with the real projection matrix.
  - why: Shot sizes are defined by how much of the body is in frame; p is monotonic in distance and lens and is exactly the quantity Match mode holds constant.
  - alternatives: Head-height based fractions (ambiguous for wide shots); fixed distance bins (lens-dependent, wrong).
- **Engine conversions in export**: Blender: location (x,-z,y), rotation_euler (mode XYZ) = Three Euler decomposition of M_b = Rx(90°)·R_three with order 'ZYX'; Unreal: location 100·(-z,x,y) cm, FRotator from R_u = P·R_three·P⁻¹ via yaw=atan2(Fy,Fx), pitch=atan2(Fz,hypot(Fx,Fy)), roll=atan2(-Right.z, Up.z).
  - why: Blender's XYZ Euler is extrinsic (R = Rz·Ry·Rx), which is three's 'ZYX' intrinsic order; the P map has det -1 and converts handedness; worked examples verified by hand in the plan.
  - alternatives: Exporting only quaternions (correct but not pasteable into Blender/Unreal UIs).
- **Key collision**: '?' (Shift+/) opens help; hide-UI moves to Shift+U. Letters fire only without Cmd/Ctrl/Alt and never inside editable elements; second-tier actions are Shift-qualified.
  - why: On US layouts '?' and Shift+/ are the same chord; the brief assigned both. Help on '?' is the web convention.
  - alternatives: Help on H only (keeps Shift+/ for hide) — rejected because '?' discoverability matters more than matching Plane of Focus.
- **Routing & registry**: /labs/[labId] is a server page: generateStaticParams over available labs, notFound() for unknown or non-available ids; a client LabShell loads the lab module with next/dynamic ssr:false through a literal import map.
  - why: Verified: ssr:false is only allowed in Client Components; with cacheComponents, generateStaticParams produces a static shell; import() paths must be literal.
  - alternatives: Rendering concept pages for unavailable labs (spec says notFound).
- **E2E determinism**: A build-time flag NEXT_PUBLIC_E2E=1 (inlined) plus URL params e2e=1&freeze=<s>&nomotion=1&dpr=1 expose window.__animationLab and data-* attributes; visual baselines only for the monitor at 24/50/85 with maxDiffPixelRatio 0.02.
  - why: WebGL output varies by GPU; deterministic time/pose and a tolerance keep the visual tests meaningful without flakiness.
  - alternatives: Full-page visual diffs (too flaky); no visual tests (misses frustum/shot agreement).
- **Definition of done**: pnpm verify (typecheck, lint, test, build, test:e2e) is necessary but never sufficient; each phase needs the screenshot review protocol completed in docs/screenshots/REVIEW-<phase>.md and acceptance items ticked with evidence.
  - why: The spec explicitly forbids claiming completion from a green build; visual quality is the top priority.
  - alternatives: CI-only gating.

### Verified API facts
- three r187 PerspectiveCamera: constructor defaults fov=50 (vertical degrees), filmGauge=35; getFilmHeight() = filmGauge / max(aspect,1); getFilmWidth() = filmGauge * min(aspect,1); setFocalLength(f) sets fov = RAD2DEG*2*atan(0.5*getFilmHeight()/f) and calls updateProjectionMatrix(); getFocalLength() inverts it; getViewSize(distance) available — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/cameras/PerspectiveCamera.js
- three r187 Euler: DEFAULT_ORDER 'XYZ'; setFromRotationMatrix supports 'XYZ' and 'YXZ' (formulas quoted); setFromQuaternion(q, order, update); angles in radians — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/math/Euler.js
- three r187 Object3D.lookAt: for isCamera||isLight uses _m1.lookAt(_position, _target, this.up) (camera looks down local −Z); DEFAULT_UP = (0,1,0) — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/core/Object3D.js
- three r187 WebGLRenderer: preserveDrawingBuffer default false; readRenderTargetPixels(renderTarget, x, y, width, height, buffer, activeCubeFaceIndex, textureIndex=0) and async variant; setRenderTarget(rt, activeCubeFace=0, activeMipmapLevel=0); setViewport/setScissor(x,y,w,h); setScissorTest(bool); setSize(w,h,updateStyle=true) — https://raw.githubusercontent.com/mrdoob/three.js/r187/src/renderers/WebGLRenderer.js
- R3F 9 useThree root state fields: gl, scene, camera, clock, size{width,height,top,left}, viewport, invalidate, advance, setSize, get, set, events, performance{current,min,max,debounce,regress}; useFrame((state, delta, xrFrame), priority) — a positive priority disables automatic rendering ('It will now be your responsibility to render', gl.render(scene, camera)); callbacks run in ascending priority; negative priorities only order — https://r3f.docs.pmnd.rs/api/hooks
- R3F 9 Canvas props and defaults: gl ({} | instance | sync/async factory), camera default {fov:75, near:0.1, far:1000, position:[0,0,5]}, shadows false, frameloop 'always'|'demand'|'never' (default always), dpr [1,2], flat false (ACESFilmic by default), events, eventSource, eventPrefix 'offset', onCreated, onPointerMissed, resize config; performance settings mergeable — https://r3f.docs.pmnd.rs/api/canvas
- R3F 9 Next.js guidance: add transpilePackages: ['three'] for Next ≥ 13.1; fiber@9 pairs with react@19; install pnpm add three @react-three/fiber — https://r3f.docs.pmnd.rs/getting-started/installation
- R3F 9 scaling-performance: frameloop='demand' + invalidate(); performance={{min:0.5}} and regress() on control change; PerformanceMonitor onIncline/onDecline for dpr stepping — https://r3f.docs.pmnd.rs/advanced/scaling-performance
- R3F 9.8.2 createPortal(children: React.ReactNode, container: THREE.Object3D, state?: InjectState): JSX.Element where InjectState = Partial<Omit<RootState,'events'> & { events?: { enabled?, priority?, compute?, connected? } }> — https://unpkg.com/@react-three/fiber@9.8.2/dist/declarations/src/core/portal.d.ts
- @react-three/fiber@9.8.2 peerDependencies: react >=19 <19.4, react-dom >=19 <19.4 (optional), three >=0.156; depends on zustand ^5.0.3 — https://unpkg.com/@react-three/fiber@9.8.2/package.json
- @react-three/drei@10.7.9 peerDependencies: @react-three/fiber ^9.0.0, react ^19, three >=0.159; dependencies include maath ^0.10.8, zustand ^5.0.1, troika-three-text ^0.52.4, camera-controls ^3.1.0, @use-gesture/react ^10.3.1, stats-gl ^2.2.8, detect-gpu — https://unpkg.com/@react-three/drei@10.7.9/package.json
- drei PerspectiveCamera props: makeDefault (registers as system default), manual (stops responsiveness; compute aspect yourself), children as render-function (texture) hidden while filming, frames, resolution (FBO 256), envMap — https://drei.docs.pmnd.rs/cameras/perspective-camera
- drei OrbitControls (source): props camera, domElement, enableDamping, makeDefault, onChange, onEnd, onStart, regress, target, keyEvents; makeDefault sets controls in the R3F store and restores the old on unmount; regress calls performance.regress() on change; update runs in useFrame(..., -1) only if controls.enabled — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/OrbitControls.tsx
- drei DragControls (source): autoTransform (default true), matrix, axisLock 'x'|'y'|'z', dragLimits, onHover, onDragStart(origin), onDrag(localMatrix, deltaLocalMatrix, worldMatrix, deltaWorldMatrix), onDragEnd, dragConfig; it sets defaultControls.enabled=false on drag start and true on drag end — https://raw.githubusercontent.com/pmndrs/drei/master/src/web/DragControls.tsx and https://drei.docs.pmnd.rs/gizmos/drag-controls
- drei View (source/docs): props as, id, className, style, visible, index (default 1 = render priority), frames, children, track (deprecated); View.Port renders inside Canvas; views use gl.setViewport/setScissor/setScissorTest(true) on the tracked rect; portal injects events {compute, priority: index} and size; events should be reconnected to a parent containing canvas + HTML via eventSource — https://drei.docs.pmnd.rs/portals/view and https://raw.githubusercontent.com/pmndrs/drei/master/src/web/View.tsx
- drei RenderTexture (source/docs): props width, height (default viewport), samples (8), stencilBuffer false, depthBuffer true, generateMipmaps false, renderPriority 0, eventPriority 0, frames Infinity, compute; implemented as useFBO((width||size.width)*dpr, ...) + createPortal(children, scene, { events: { compute, priority } }) and useFrame: setRenderTarget(fbo); render(state.scene, state.camera); restore old target — https://drei.docs.pmnd.rs/portals/render-texture and https://raw.githubusercontent.com/pmndrs/drei/master/src/core/RenderTexture.tsx
- drei useFBO(width?, height?, settings?) (source): defaults width/height to size * viewport.dpr, samples 0, minFilter/magFilter LinearFilter, type HalfFloatType unless overridden; depth deprecated in favour of depthBuffer — https://raw.githubusercontent.com/pmndrs/drei/master/src/core/Fbo.tsx
- drei Html props: as, wrapperClass, prepend, center, fullscreen, distanceFactor, zIndexRange (default [16777271,0]), portal, transform, sprite, calculatePosition, occlude (true | refs | 'blending'), onOcclude, plus group and div props; transform mode may render blurry — https://drei.docs.pmnd.rs/misc/html
- drei Text: troika-based, suspends while loading fonts; pass characters to avoid FOUC; anchorX/anchorY/color/font props — https://drei.docs.pmnd.rs/abstractions/text
- drei PerformanceMonitor props: ms 250, iterations 10, threshold 0.75, bounds(refreshrate), flipflops Infinity, factor 0.5, step 0.1, onIncline/onDecline/onChange/onFallback; dpr examples setDpr(2)/setDpr(1) — https://drei.docs.pmnd.rs/performances/performance-monitor
- drei useCursor(hovered, onPointerOver='pointer', onPointerOut='auto', container=document.body) sets container.style.cursor in an effect — https://raw.githubusercontent.com/pmndrs/drei/master/src/web/useCursor.tsx
- zustand 5 README: create<State>()(...) curried TS form; getState/setState/subscribe outside components; subscribeWithSelector gives subscribe(selector, callback, { equalityFn, fireImmediately }); useShallow from 'zustand/react/shallow'; persist from 'zustand/middleware' with createJSONStorage (localStorage default); transient updates via useRef + subscribe — https://raw.githubusercontent.com/pmndrs/zustand/main/README.md
- zustand@5.0.16 persist types: PersistOptions { name, storage (default createJSONStorage(() => window.localStorage)), partialize, onRehydrateStorage, version, migrate, merge, skipHydration (default false) }; store.persist API { setOptions, clearStorage, rehydrate, hasHydrated, onHydrate, onFinishHydration, getOptions }; peers react >=18, use-sync-external-store >=1.2 — https://unpkg.com/zustand@5.0.16/middleware/persist.d.ts and https://unpkg.com/zustand@5.0.16/package.json
- maath@0.10.8 easing (published d.ts): damp(current, prop, target, smoothTime?, delta?, maxSpeed?, easing?, eps?): boolean; damp2/damp3/damp4/dampE/dampC/dampQ/dampS/dampM/dampLookAt/dampAngle with the same tail; exp/linear/rsqw and sine/cubic/quint/circ/quart/expo in/out/inOut; peers three >=0.134; entrypoints buffer, easing, geometry, matrix, misc, random, three, triangle, vector2, vector3 — https://unpkg.com/maath@0.10.8/dist/declarations/src/easing.d.ts and https://unpkg.com/maath@0.10.8/package.json
- Next 16.4.3 lazy loading: next/dynamic ssr:false 'will only work for Client Components'; using it in a Server Component errors ('Please move it into a Client Component'); import() paths must be literal — node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
- Next 16.4.3 notFound(): throws NEXT_HTTP_ERROR_FALLBACK;404, usable in Server Components/Server Functions/Route Handlers, renders nearest not-found.tsx; PageProps<'/route'> and LayoutProps are global helpers generated by next dev/build/typegen — node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md and 01-getting-started/03-layouts-and-pages.md
- Next 16.4.3 dynamic segments: params is a Promise (await or React use); with cacheComponents, without generateStaticParams param access must be inside Suspense; with generateStaticParams the sample pages are prerendered and other params render at request time — node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
- Next 16.4.3 cacheComponents: set with partialPrefetching explicitly; requires Node.js runtime; uses React Activity to keep recently visited routes mounted hidden (effects cleaned up when hidden) — node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md
- Next 16.4.3 transpilePackages: package names only (no globs); Turbopack transpiles workspace packages automatically; needed for node_modules deps shipping raw TS/JSX — node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/transpilePackages.md
- Next 16.4.3 env: only NEXT_PUBLIC_-prefixed variables are inlined into the browser bundle at build time; others are server-only — node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
- eslint-config-next 16.4.3 sets 'react/no-unknown-property': 'off' (and react-in-jsx-scope, prop-types off) — node_modules/eslint-config-next/dist/index.js:173
- Vitest 5.0.5: engines.node ^22.12 || ^24 || >=26; peer vite ^6.4 || ^7 || ^8; environment default 'node' with 'jsdom'|'happy-dom'|'edge-runtime' and per-file // @vitest-environment docblocks; include default ['**/*.{test,spec}.?(c|m)[jt]s?(x)']; defineConfig from 'vitest/config' — https://unpkg.com/vitest@5.0.5/package.json, https://vitest.dev/config/environment, https://vitest.dev/config/include, https://vitest.dev/guide/
- @playwright/test@1.64.1: engines node >=20; TestOptions include reducedMotion ('reduce'|'no-preference'), permissions, viewport, deviceScaleFactor, colorScheme, contextOptions, launchOptions, screenshot/trace/video; browserContext.grantPermissions supports 'clipboard-read'/'clipboard-write' (browser-dependent); toHaveScreenshot options animations (default 'disabled'), caret, clip, fullPage, mask, maxDiffPixelRatio, maxDiffPixels, threshold 0.2, stylePath; snapshots stored in <spec>-snapshots and are platform-specific; webServer { command, url, reuseExistingServer: !process.env.CI, timeout } — https://unpkg.com/@playwright/test@1.64.1/package.json, https://playwright.dev/docs/api/class-testoptions, https://playwright.dev/docs/api/class-browsercontext, https://playwright.dev/docs/api/class-pageassertions, https://playwright.dev/docs/test-snapshots, https://playwright.dev/docs/test-webserver, https://playwright.dev/docs/api/class-browser
- Clipboard API (MDN): secure context required; Chromium writes need clipboard-write permission or transient activation; Firefox/Safari do not support the clipboard-read/write permissions and require transient activation for writes — https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- @fal-ai/client@1.10.1 (commonjs, node >=18): reads FAL_KEY from the environment on import; fal.config({ credentials }) for environments without env; fal.subscribe(endpointId, { input }) returns result.data; keys must never live in browser code — https://unpkg.com/@fal-ai/client/package.json and https://fal.ai/docs/clients/javascript
- fal.ai Meshy endpoint 'fal-ai/meshy/v7.1/text-to-3d': input prompt (≤600 chars), mode 'preview'|'full' (default full), model_type, topology 'quad'|'triangle', target_polycount 30000, should_remesh true, symmetry_mode 'auto', enable_pbr, geometry_resolution; output model_glb{url}, model_urls{glb,fbx,obj,usdz,stl,blend}, thumbnail, texture_urls; price $0.80 untextured, $1.20 textured (+$0.20 rigging, +$0.12 animation) — https://fal.ai/models/fal-ai/meshy/v7.1/text-to-3d and https://fal.ai/models/fal-ai/meshy/v7.1/text-to-3d/api
- Seedance prompting guidance (third-party/fal): give each shot one clear action and one camera movement, name subject/action first then camera — https://fal.ai/learn/tools/how-to-use-seedance-2-0
- Vercel Node.js: available 26.x (default), 24.x, 22.x; engines.node '26.x' in package.json overrides project settings — https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- mise registry provides node (core) and pnpm (aqua:pnpm/pnpm, npm:pnpm) — `mise registry` on this machine (mise 2026.10.25)

### Plan
# Animation Lab — Lens & Framing Lab
## Product · Lessons · Copy · Export · Registry · Keys/A11y · Verification · Delivery

All paths are absolute under `/Users/gg/w/animation-lab`. Nothing was created or modified during planning.

---

## 0. Ground truth observed on 2026-11-01 (corrections to the brief)

The brief says "greenfield, not a git repo". Reality:

| Item | Observed |
|---|---|
| Scaffold | `create-next-app` 16.4.3 already ran: `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}`, `public/*.svg`, `next.config.ts` (`cacheComponents: true`, `partialPrefetching: true`, Turbopack rule `*.css → @tailwindcss/turbopack`), `eslint.config.mjs` (flat, `eslint-config-next` core-web-vitals + typescript), `tsconfig.json` (`@/* → ./src/*`, strict, target ES2017), `pnpm-workspace.yaml` (`ignoredBuiltDependencies: sharp, unrs-resolver`), `AGENTS.md` (Next agent rules block), `README.md` (CNA default) |
| Git | Repo exists, branch `main`, one commit `6de1122 Initial commit from Create Next App`. Working tree clean. Do **not** add commits unless the user asks. |
| Installed | next 16.4.3, react/react-dom 19.3.0, tailwindcss 4.3.3, eslint 9.39.5, eslint-config-next 16.4.3, typescript 5.9.3, @types/node ^20. **Not** installed: three, @react-three/*, zustand, maath, vitest, playwright. |
| Env files | `.env.example` contains `FAL_API_KEY=` → must become `FAL_KEY=` (the fal client reads `FAL_KEY`). `.env.local` exists (81 bytes; not read). `.gitignore` has `.env*` and no `!.env.example`. |
| Lint | `eslint-config-next` sets `react/no-unknown-property: off` (checked `node_modules/eslint-config-next/dist/index.js:173`) → R3F JSX props (`position`, `args`, `intensity`) will not trip lint. |
| Toolchain | node v26.13.0, pnpm 10.33.0, git 2.56.0, mise 2026.10.25 (registry: `node` core, `pnpm` aqua/npm). Playwright cache has `chromium-1243`, `chromium_headless_shell-1243`, `webkit-2359` (1.64.1 may need `pnpm exec playwright install chromium`). |
| Next docs | Bundled agent docs at `node_modules/next/dist/docs/01-app/**` (AGENTS.md insists they be read; relevant ones were). |

Consequences: the setup phase is "adjust scaffold" (Section 8.1), not "scaffold in a temp sibling".

---

## 1. Canonical state contract (what every section below consumes)

One canonical lab store (zustand 5, `create<LabState>()(subscribeWithSelector(...))`), one timeline store, one persisted progress store. The engine/scene/renderer planners own the internals; this plan depends only on the shape below.

```ts
// src/state/labStore.ts
export type TargetId = 'primary' | 'secondary' | 'both';
export type CameraMode = 'fixed' | 'match';
export type ShotSize = 'ews' | 'ws' | 'fs' | 'ms' | 'mcu' | 'cu' | 'ecu';
export type LensClass = 'ultra-wide' | 'wide' | 'moderate-wide' | 'normal' | 'portrait-tele' | 'tele';
export type AngleClass = 'eye-level' | 'high' | 'low' | 'steep-high' | 'steep-low';
export type PerspectiveClass = 'compressed' | 'natural' | 'deep';

export interface CameraState {
  focalMm: number;                 // 18..135 continuous; presets snap exactly
  mode: CameraMode;
  targetId: TargetId;
  distanceM: number;               // camera → target anchor along the view axis (fixed: user; match: solver)
  matchFraction: number | null;    // p locked when Match was enabled (full-body height / frame height)
  pose: { position: [number, number, number]; quaternion: [number, number, number, number] }; // settled target pose, world metres
  clamped: null | 'min' | 'max' | 'both-infeasible';
}
export interface Overlays { frustum: boolean; rulers: boolean; thirds: boolean; safeAreas: boolean; perspectiveGuide: boolean; readouts: boolean }
export interface UiState { primaryView: 'stage' | 'monitor'; uiHidden: boolean; helpOpen: boolean; exportOpen: boolean; reducedMotion: boolean }

export interface Derived {                    // pure selectors in src/camera/measure.ts, memoised
  hFovDeg: number; vFovDeg: number;
  frameWidthAtTargetM: number; frameHeightAtTargetM: number;
  targetFraction: number;                     // p = projected body height / frame height (real projection of segment endpoints)
  subjectDepthM: number;                      // Zs: depth of target anchor along forward
  backgroundDepthM: number;                   // Zb: depth of the doorway reference point
  kRatio: number;                             // Zs / Zb
  faceStretch: number;                        // (Zs + 0.10) / (Zs − 0.12)   nose-tip vs ear magnification
  apparentHeightRatio: number;                // (Hsec/Zsec) / (Hpri/Zpri)
  doorwayWidthFraction: number;               // doorwayWidth / (Zb·36/f)
  shotSize: ShotSize; lensClass: LensClass; angle: AngleClass; perspective: PerspectiveClass;
  pitchDeg: number; yawDeg: number; rollDeg: number;  // Euler 'YXZ' of the pose
}
```

Scene constants used by copy, classification and tests (world = Three.js, Y-up, metres, camera default looks along −Z):

```ts
// src/scenes/doorway-set/world.ts
export const WORLD = {
  primary:   { id: 'primary',   name: 'Bramble', heightM: 1.70, root: [0, 0, -3.0],    headAnchor: [0, 1.45, -3.0],  eyeHeightM: 1.45 },
  secondary: { id: 'secondary', name: 'Pip',     heightM: 1.05, root: [0.9, 0, -5.0],  headAnchor: [0.9, 0.92, -5.0], eyeHeightM: 0.92 },
  foreground:{ id: 'lamp',      position: [-0.7, 0.9, -1.5], heightM: 0.9 },
  doorway:   { id: 'doorway',   center: [0.4, 1.1, -9.0], widthM: 1.6, heightM: 2.2 },     // background reference plane z = −9
  cameraDefault: { position: [0, 1.45, 0], lookAt: [0, 1.45, -3.0], focalMm: 50, distanceM: 3.0 },
  bounds: { minDistanceM: 0.45, maxDistanceM: 14, stageZ: [-12, 4] },
  gate: { widthMm: 36, heightMm: 20.25, aspect: 16 / 9 },
} as const;
```
(Names "Bramble"/"Pip" are placeholders; all copy uses `{primaryName}`/`{secondaryName}` tokens so the character designer can rename.)

Timeline (`src/timeline/store.ts`): `{ playing: boolean; timeSeconds: number; loopDurationSeconds: 6; clipId: 'doorway-wave-v1'; rate: 1 }`. Time advances only in the frame loop (`dt` clamped to 1/30) and wraps `((t % L) + L) % L`. **No camera action touches this store** (tested).

Event bus (`src/state/events.ts`): a typed emitter; every store action emits one event. Event union used by lessons, toasts, and e2e:
`focalChanged{f, source:'slider'|'preset'|'key'|'ring'|'restore'}`, `presetHeld{f, mode, target}` (after HOLD_MS = 1000 unchanged), `modeChanged{mode}`, `targetChanged{target}`, `distanceChanged{d, source:'slider'|'drag'|'key'|'solver'}`, `cameraTravelled{metres}` (Match solver moves), `clampHit{kind}`, `playbackChanged{playing}`, `timeScrubbed{t}`, `viewSwapped`, `shotSaved{id, objectiveId}`, `shotRestored{id}`, `exportCopied{kind:'json'|'phrase'}`, `overlayToggled{key,on}`, `exerciseStarted{id}`, `exerciseCompleted{id}`.

Test hook (`src/state/testHook.ts`): when `process.env.NEXT_PUBLIC_E2E === '1'` (inlined at build; verified Next docs) **or** `location.search` has `e2e=1` in dev, install `window.__animationLab = { getState, setState, timeline: {get,set,play,pause}, events: LabEvent[] (ring buffer 500), settle(): Promise<void>, captureMonitor(): Promise<string> }` and mirror `data-focal-mm`, `data-mode`, `data-target`, `data-distance-m`, `data-time-s`, `data-playing`, `data-shot-size`, `data-exercise` on `<main data-testid="lab-root">`. URL params honoured in e2e mode: `freeze=<seconds>` (pause at t), `nomotion=1` (damping off, idle tour off), `dpr=1`.

---

## 2. Lessons

### 2.1 Lesson state machine

```ts
// src/education/types.ts
export type ExerciseId = 'ex1-how-wide' | 'ex2-why-perspective' | 'ex3-tell-the-story';
export type LessonMode =
  | { kind: 'free' }
  | { kind: 'exercise'; id: ExerciseId; stepIndex: number; startedAt: number };

export type UiTargetId =
  | 'focal-slider' | 'preset-18' | 'preset-24' | 'preset-35' | 'preset-50' | 'preset-85' | 'preset-135'
  | 'mode-toggle' | 'target-toggle' | 'distance-slider' | 'monitor' | 'stage-camera'
  | 'save-shot' | 'objective-reaction' | 'objective-relationship' | 'filmstrip' | 'perspective-guide';

export interface ExerciseStep {
  id: string;
  instruction: string;                 // ≤ 90 chars
  hint?: string;                       // mono, dim, ≤ 60 chars
  highlight: UiTargetId[];
  isDone: (p: ExerciseProgress, s: LabSnapshot) => boolean;
}
export interface ExerciseDefinition {
  id: ExerciseId; number: 1 | 2 | 3; title: string; objective: string; minutes: number;
  initialState: ExerciseInitialState;  // applied on start (Section 2.4)
  steps: ExerciseStep[];
  isComplete: (p: ExerciseProgress) => boolean;
  completionCopy: string;
  nextId: ExerciseId | null;
}
```

Transitions (`src/education/LessonEngine.ts`, a plain class with `attach(store)`/`detach()`):
- `free → exercise(id)`: `startExercise(id)` applies `initialState` (animated camera move unless reduced motion), emits `exerciseStarted`, sets `highlight` from step 0.
- `exercise.stepIndex` advances when `steps[i].isDone` becomes true (evaluated on every event); steps are not strictly sequential — `isDone` for later steps may already be true, the card shows all ticks.
- `exercise → complete` when `isComplete(progress)`: toast + card shows "Done" and `Next exercise ›`; the exercise remains active (user can keep playing) until `exit()` or `startExercise(next)`.
- `exit()` returns to `free` without resetting camera state (never reset the performance or the camera on exit — spec: changing lessons never resets the loop).
- Progress is cumulative across sessions (persisted); re-entering a completed exercise shows it complete but allows "Reset this exercise".

### 2.2 Progress model and predicates (evaluated from real events)

```ts
// src/education/progress.ts
export interface ExerciseProgress {
  ex1: { heldFixedMm: number[] };                                   // presets held ≥ 1 s in Fixed
  ex2: { target: TargetId | null; heldMatchMm: number[]; travelM: number; faceGuideSeen: boolean };
  ex3: { savedByObjective: { reaction: string | null; relationship: string | null } };
  completed: Partial<Record<ExerciseId, string>>;                   // ISO timestamp
}
export const HOLD_MS = 1000;
export const PRESET_TOLERANCE_MM = 0.5;
export const PRESETS = [18, 24, 35, 50, 85, 135] as const;
export const snapPreset = (f: number) => PRESETS.find(p => Math.abs(p - f) <= PRESET_TOLERANCE_MM) ?? null;
```

Hold timer: the engine subscribes with `store.subscribe(s => [s.camera.focalMm, s.camera.mode, s.camera.targetId], ([f, mode, target]) => { clearTimeout(t); t = setTimeout(() => emit('presetHeld', { f: snapPreset(f), mode, target }), HOLD_MS) }, { equalityFn: shallow })` (subscribeWithSelector signature verified). `presetHeld` with `f === null` is ignored.

Predicates:
- **Ex1 complete** ⇔ `heldFixedMm ⊇ {24, 50, 85}`. Reducer: on `presetHeld` with `mode === 'fixed'` push `f` (dedupe). Order does not matter; 18/35/135 are recorded but not required.
- **Ex2 complete** ⇔ `ex2.target !== null && heldMatchMm ⊇ {24, 85} && travelM ≥ 0.5`. Reducer: on `presetHeld` with `mode === 'match'`: if `ex2.target` is null set it to `target`; if `target !== ex2.target` reset `heldMatchMm = []`, `travelM = 0`, `ex2.target = target` (same-target rule); push `f`. On `cameraTravelled{metres}` while `mode === 'match'` add to `travelM`. (Physics guarantees travel: Z85/Z24 = 85/24, so travel = 2.54·Z24 ≥ 1.5 m at the Ex2 start; the 0.5 m floor only guards clamped cases.)
- **Ex3 complete** ⇔ both `savedByObjective.reaction` and `.relationship` are non-null and still exist in `savedShots` (deleting a shot un-completes until another is saved).

Step lists (what the card shows):
- Ex1: ① "Press 2 — hold 24 mm for a second" (done: 24 ∈ heldFixedMm) ② "Now 5 — 50 mm" ③ "And 6? No — 85 mm is key 5; try 85" (keep it plain: "Now 85 mm") ④ "Watch the frustum: only the angle changed" (done when ①–③ done).
  Final wording: ① "Hold 24 mm for a second (key 2)" ② "Hold 50 mm (key 4)" ③ "Hold 85 mm (key 5)" ④ "Look at the stage: the camera never moved".
- Ex2: ① "Match is on — the camera now keeps {primaryName} the same size" (done: mode === 'match') ② "Hold 24 mm: the camera rushes in" (24 ∈ heldMatchMm) ③ "Hold 85 mm: it backs away" (85 ∈ heldMatchMm) ④ "Compare the nose, the ears, the doorway" (perspectiveGuide toggled on at least once → `faceGuideSeen`, optional, not required for completion).
- Ex3: ① "Pick an objective" (an objective card selected) ② "Shape a shot — lens, distance, mode" (any focal/distance/mode event after selection) ③ "Save it for that objective (S)" (saved) ④ "Now the other objective".

### 2.3 Exercise definitions as data (`src/education/exercises.ts`)

```ts
export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'ex1-how-wide', number: 1, minutes: 2,
    title: 'How wide is your shot?',
    objective: 'Change the lens while the camera stays put. Only the field of view changes.',
    initialState: { mode: 'fixed', focalMm: 50, targetId: 'primary', distanceM: 3.0, pose: 'default', playing: true, overlays: { frustum: true, rulers: true } },
    steps: [...], isComplete: p => [24, 50, 85].every(f => p.ex1.heldFixedMm.includes(f)),
    completionCopy: 'Three lenses, one viewpoint. The drawing never changed — only the crop did.',
    nextId: 'ex2-why-perspective',
  },
  {
    id: 'ex2-why-perspective', number: 2, minutes: 3,
    title: 'Why does perspective change?',
    objective: 'Keep {primaryName} the same size in frame while the lens changes. Now the camera has to move.',
    initialState: { mode: 'match', focalMm: 50, targetId: 'primary', matchFraction: 2.5 /* MCU → 1.68 m at 50 mm */, playing: true, overlays: { frustum: true, perspectiveGuide: true } },
    steps: [...], isComplete: p => p.ex2.target !== null && [24, 85].every(f => p.ex2.heldMatchMm.includes(f)) && p.ex2.travelM >= 0.5,
    completionCopy: 'Same size, different face. Perspective came from the distance, not the glass.',
    nextId: 'ex3-tell-the-story',
  },
  {
    id: 'ex3-tell-the-story', number: 3, minutes: 4,
    title: 'Tell the story',
    objective: 'Choose a shot for each objective. There is no single right answer — save what you believe.',
    initialState: { keepCamera: true, playing: true, overlays: { thirds: true } },
    steps: [...], isComplete: p => !!p.ex3.savedByObjective.reaction && !!p.ex3.savedByObjective.relationship,
    completionCopy: 'Two objectives, two lenses, two distances. That is directing.',
    nextId: null,
  },
];
```

### 2.4 How exercises set initial state

`startExercise(def)` calls `labStore.actions.applyExerciseState(def.initialState)`:
- `pose: 'default'` → `WORLD.cameraDefault`; `distanceM` recomputed from the target anchor.
- Match with `matchFraction` → solver computes `distanceM = (H_body · f) / (p · gateH)` as the initial guess then 2 secant iterations on the real projection; for Ex2: `1.70·50 / (2.5·20.25) = 1.679 m`, camera at `(0, 1.45, −1.321)` aiming at the head anchor. Expected matched distances: 18 mm 0.604 m · 24 mm 0.806 m · 35 mm 1.175 m · 50 mm 1.679 m · 85 mm 2.854 m · 135 mm 4.533 m (all inside bounds 0.45–14 m).
- `keepCamera: true` → no camera change (Ex3 starts from wherever the user is).
- The camera travels with `maath/easing.damp3` (smoothTime 0.35 s, maxSpeed 6 m/s) to the new pose; with `reducedMotion` it jumps. The timeline is untouched except `playing: true` if it was paused **and** the user has not scrubbed in this session (never move the playhead).

### 2.5 Save shot + saved-shots tray

```ts
// src/state/progressStore.ts  (persist)
export interface SavedShot {
  id: string;                  // nanoid-ish: Date.now().toString(36) + counter
  createdAt: string;           // ISO
  objectiveId: 'reaction' | 'relationship' | null;
  label: string;               // default 'Shot 3'; editable inline (input → shortcuts suppressed)
  summary: string;             // 'MCU · 85 mm · 2.9 m · Match · Bramble'
  thumbnailDataUrl: string;    // image/jpeg q0.72, 320×180 (~12–18 KB)
  settings: ShotSettings;      // { focalMm, mode, targetId, distanceM, matchFraction, pose, timeSeconds, overlays? }
}
```
- Trigger: monitor toolbar button **Save shot** (`data-ui-target="save-shot"`) or key `S`. In Ex3 a 2-option popover "Save for: ◯ Reaction ◯ Relationship" (pre-selects the active objective; Enter confirms). Outside Ex3 `objectiveId = null`.
- Thumbnail capture (`src/lib/thumbnails.ts`): `captureMonitor()` sets a one-shot flag; the monitor renderer's post-render `useFrame(cb, MONITOR_RENDER_PRIORITY + 1)` runs in the same rAF tick after `gl.render`, computes the monitor rectangle in device pixels, `ctx.drawImage(gl.domElement, sx, sy, sw, sh, 0, 0, 320, 180)` into an offscreen `<canvas>` and resolves `toDataURL('image/jpeg', 0.72)`. Same-tick capture needs no `preserveDrawingBuffer` (three default `false`, verified) and yields the tone-mapped image users see.
- Tray: docked at the right end of the bottom filmstrip rail, separated by a divider; shows up to 6 thumbnails, horizontal scroll beyond; each tile: thumbnail, 2-line summary (mono), objective chip (amber "Reaction" / cyan "Relationship"), hover actions Restore · Copy JSON · Delete. Click = restore.
- Restore: `applyShot(settings, { animate: !reducedMotion })` then `timeline.scrubTo(settings.timeSeconds)` and `pause()`; toast "Restored Shot 2 · paused at 2.40 s · Space to play". Restoring never changes lesson state.
- Limits: 12 shots max; adding the 13th prompts "Delete oldest shot?" (never silent). Quota: 12 × ~18 KB ≪ 5 MB.

### 2.6 Persistence

`useProgressStore = create<ProgressState>()(persist(..., { name: 'animation-lab.progress.v1', version: 1, storage: createJSONStorage(() => localStorage), partialize: s => ({ exercises: s.exercises, savedShots: s.savedShots, prefs: s.prefs, lastExerciseId: s.lastExerciseId }), skipHydration: true }))`. `useProgressStore.persist.rehydrate()` runs in a `useEffect` inside `LabShell` and in the home page's client "Continue" chip; UI renders a neutral state until `persist.hasHydrated()` (API verified in `middleware/persist.d.ts`). `migrate(persisted, version)` is present from day one (returns defaults for unknown versions).

### 2.7 Lesson card UI (top-left column, under the chips + caption; width 340 px; glass)

Free mode (collapsed pill): `GUIDED EXERCISES · 0 / 3 ▸` — click expands a list: three rows with number, title, minutes, state (`○ not started`, `◐ in progress`, `● done 2 Nov`).
Active exercise card:
```
EXERCISE 2 · 3 MIN                                   Exit ×
Why does perspective change?
Keep Bramble the same size while the lens changes.
✓ Match is on — the camera keeps Bramble the same size
✓ Hold 24 mm: the camera rushes in
○ Hold 85 mm: it backs away                 ← current (amber)
○ Compare the nose, the ears, the doorway
hint  press 5 · or drag the slider
[progress dots ● ● ○ ○]
```
On completion: a one-line banner `Done — Same size, different face. Perspective came from the distance, not the glass.` and buttons `Next exercise ›` / `Keep exploring`.
Highlights: elements carry `data-ui-target`; the engine writes `lesson.highlight: UiTargetId[]`; matched elements get `.is-highlighted` (2 px amber ring + soft outer glow, pulsing 1.6 s; static under reduced motion).
Ex3 card adds two objective tiles (`data-ui-target="objective-reaction|relationship"`), each: title, one-line brief, `Suggested: 85 mm · Match · MCU` ghost, and `Save shot for this` button; a saved tile shows the thumbnail and `Replace`.

---

## 3. Educational copy (single source: `src/education/copy.ts`; `{tokens}` substituted at render)

Lens classes by focal: `18–20 ultra-wide · 21–28 wide · 29–42 moderate wide · 43–62 normal · 63–105 portrait telephoto · 106–135 telephoto`.

### 3.1 Lens class × mode — title + sentences

**FIXED (camera stays put; only the field of view changes)**

| Class | Title | Text |
|---|---|---|
| Ultra-wide | **18 mm — Ultra-wide: the whole set in one frame** | A 90° view takes in the floor, the doorway and both characters at once. The camera has not moved, so every shape keeps its proportions — you are seeing more of the same drawing. |
| Wide | **24 mm — Wide angle: room to stage the action** | 74° across the frame: {primaryName}, {secondaryName} and the doorway all fit, with air around them. Proportions are identical to 50 mm — only the crop is looser. |
| Moderate wide | **35 mm — Moderate wide: the all-rounder** | 54° keeps the environment readable without stretching the edges. This is a tighter crop of the exact image you had at 24 mm. |
| Normal | **50 mm — Normal: how we picture a scene** | 40° feels natural. From here {secondaryName} looks about {apparentHeightRatio}× {primaryName}'s height — that ratio comes from their distances, not from the lens. |
| Portrait tele | **85 mm — Portrait telephoto: tight crop, same perspective** | 24° isolates {primaryName}'s face and reaction. It is the centre of the 24 mm frame, enlarged: a zoom crops the drawing, it does not change it. |
| Telephoto | **135 mm — Telephoto: magnified detail** | 15° across: a sliver of the scene, blown up. The perspective is still locked to where the camera stands. |

**MATCH (camera dollies to keep the subject the same size)**

| Class | Title | Text |
|---|---|---|
| Ultra-wide | **18 mm, matched: nose-first caricature** | To keep {primaryName} this size the camera parks {d} m from the face. Near features grow fastest: the nose balloons, the ears recede, the doorway shrinks into the distance. |
| Wide | **24 mm, matched: close and confrontational** | The camera is {d} m away. {primaryName}'s face pushes toward us and {secondaryName} looks far smaller than she is — closeness exaggerates depth. Comedy, menace, intrusion. |
| Moderate wide | **35 mm, matched: present but honest** | At {d} m the exaggeration is mild: a little extra depth in the face, the room still part of the story. Much animated dialogue lives here. |
| Normal | **50 mm, matched: the reference frame** | From {d} m the proportions read as true. Use it as the baseline, then decide: lean the audience in (wider, closer) or sit them back (longer, farther). |
| Portrait tele | **85 mm, matched: flattering and calm** | The camera has pulled back to {d} m. Features flatten, the face composes itself, and the doorway looms behind {primaryName} because the whole scene is now far from the lens. |
| Telephoto | **135 mm, matched: compressed and watchful** | From {d} m, depth collapses: {primaryName} and the doorway stack onto one plane and {secondaryName} seems to stand beside him. A telephoto look is a position, not a trick. |

Key sentence shown under every title in Match mode (small, dim): *Perspective is set by where the camera is. The lens only decides how much of it you see.*

### 3.2 Live caption templates (aria-live="polite", rewritten only on state change, key words colour-coded: lens amber, distance cyan, percentage white)

- Fixed: `At {f} mm from {d} m, {targetName} fills {pct}% of the frame height · {hfov}° field of view. Change the lens: the crop changes, the perspective does not.`
- Match: `At {f} mm the camera sits {d} m from {targetName} to keep {pct}% frame height · the doorway now appears {bgRatio}× its size at 24 mm.`
- While dragging the camera: `Dolly · {d} m · {pct}% · {shotSizeLabel}`
- Clamped (min): `Minimum distance reached — the lens would be inside {targetName}. Framing is {pctActual}% instead of {pctTarget}%.`
- Clamped (max / Both infeasible): `Both characters do not fit at {f} mm from inside the set. Try ≤ {fMax} mm or switch the target.`
- Paused inspection: `Paused at {t} s — change the lens or distance; the performance stays on this frame.`

Formatting: `f` integer mm; `d` two decimals below 1 m, else one decimal; `pct` integer (may exceed 100 — show `184%` and the shot-size label beside it); `hfov` one decimal; `bgRatio` one decimal (`1.0×` at 24 mm in Match; in Fixed the variable is omitted). `bgRatio = (f / Zb(f)) / (24 / Zb(24))` with `Zb = Zs + 6.0`; example Ex2: 85 mm → `(85/8.854)/(24/6.806) = 2.72×`.

### 3.3 Perspective-guide overlay (in-monitor pills; `P` key; on by default in Ex2)

- Face: `Nose vs ears · {faceStretch}×` — tooltip: *Features nearer the lens are magnified more. 24 mm matched: 1.32× · 50 mm: 1.14× · 85 mm: 1.08×.*
- Foreground/background: `Lamp vs doorway · {fgbg}×` where `fgbg = (Zb / Zfg)` normalised to the 50 mm Fixed baseline — tooltip: *Close camera: the lamp grows, the doorway shrinks. Far camera: they converge.*
- Character ratio: `{secondaryName} appears {apparentHeightRatio}× {primaryName}'s height · true 0.62×` — tooltip: *In Fixed mode this number never changes with the lens (0.37× from the default spot). In Match mode it swings from 0.18× at 24 mm to 0.36× at 85 mm.*
- Background coverage: `Doorway spans {doorwayWidthFraction}% of the frame width` — reference values: Fixed 24/50/85 from 3 m: 12% / 25% / 42%; Match MCU 24/85: 16% / 43%.

### 3.4 Help modal (`?`), small-caps section headers, ≤ 2 lines each

- **WHAT THIS LAB SHOWS** — One animated take, one cinema camera. Change the lens and the distance; watch the shot and the stage at the same time.
- **FIXED VS MATCH** — Fixed: the camera stays; the lens only crops. Match: the camera dollies so the subject keeps its size; now the lens changes everything behind and in front of it.
- **WHY PERSPECTIVE CHANGES** — Size on screen = focal length × real size ÷ distance. Two things at different distances always image in the ratio of their distances, whatever the lens. Only moving the camera changes that ratio.
- **SHOT LANGUAGE** — The one-line phrase under the monitor describes your shot the way a storyboard or a video-model prompt would: shot size first, then lens, angle, distance, perspective, movement. `C` copies it; `⇧C` copies the full JSON.
- **EXERCISES** — Three short exercises track what you actually do: hold a lens for a second to count it as explored.
- **KEYS** — table from Section 6.1.
- Footnote (mono, dim): *Assumptions: ideal pinhole camera · 36 × 20.25 mm gate (16:9) · no focus breathing · no depth of field · no lens distortion · distances measured from the film plane (camera position) to the framing anchor, in metres.*

### 3.5 Exercise 3 — suggested configurations (shown as ghosts, never auto-applied)

| Objective | Suggested | Rationale (one line) | Alternative |
|---|---|---|---|
| **Emphasize {primaryName}'s reaction** | 85 mm · Match · target {primaryName} · MCU (p 2.5 → 2.85 m) · eye level | A longer lens from farther away keeps the face natural and calm, the doorway fills the background and {secondaryName} slips out of frame — nothing competes with the reaction. | 50 mm · Match · CU (p 4 → 2.1 m) for a more intimate, slightly rounder face. |
| **Establish both characters' relationship with the environment** | 24 mm · Fixed from 3.0 m · target Both · eye level | A wide lens from close keeps the doorway, the floor and both characters in one frame; the exaggerated depth makes the distance between them part of the story. | 35 mm · Match · target Both · WS (fit both in 80% of the frame) for a calmer, less distorted establishing shot. |

---

## 4. Shot language + export

### 4.1 promptPhrase generator (`src/export/prompt-phrase.ts`)

Order: **shot size → lens → angle → distance → perspective → movement**. Rules (pure, unit-tested):
- Shot size from `p = targetFraction` (full-body projected height / frame height): `p < 0.30 → "Extreme wide shot"`, `< 0.65 → "Wide shot"`, `< 1.15 → "Full shot"`, `< 2.0 → "Medium shot"`, `< 3.5 → "Medium close-up"`, `< 7 → "Close-up"`, else `"Extreme close-up"`. Target `both` prefixes `"Two-shot — "` and uses the union extent.
- Lens class from focal (bins above) → `"18 mm ultra-wide lens"`, `"24 mm wide-angle lens"`, `"35 mm moderate wide lens"`, `"50 mm normal lens"`, `"85 mm portrait telephoto"`, `"135 mm telephoto"` (integer mm, actual value).
- Angle from pitch/roll (Euler 'YXZ' of the pose; pitch < 0 looks down): `|pitch| ≤ 5° → "eye level"`, `−25° ≤ pitch < −5° → "high angle"`, `pitch < −25° → "steep high angle"`, `5° < pitch ≤ 25° → "low angle"`, `> 25° → "steep low angle"`; append `", dutch tilt"` when `|roll| > 3°`.
- Distance: `"camera {d} m from {targetName}"` (same formatting rule as captions).
- Perspective from `k = Zs / Zb` (Zb = depth of the doorway reference): `k > 0.5 → "compressed perspective"`, `k < 0.15 → "deep, exaggerated perspective"`, else `"natural perspective"`.
- Movement: MVP always `"locked-off static shot"`. Future: say *zoom* only when focal changes over the shot, *dolly/push-in/pull-out* only when position changes (documented in the help and in `docs/shot-settings.md`; Seedance guidance: name the shot first, one camera move per shot — fal.ai Seedance guide).
- Output: `parts: { shotSize, subject, lens, angle, distance, perspective, movement }` and `phrase = [shotSize + ' of ' + subject, lens, angle, distance, perspective, movement].join(', ') + '.'`.

Examples (expected test strings): Ex2 @ 85 → `Medium close-up of Bramble, 85 mm portrait telephoto, eye level, camera 2.9 m from Bramble, natural perspective, locked-off static shot.` · Ex2 @ 24 → `Medium close-up of Bramble, 24 mm wide-angle lens, eye level, camera 0.81 m from Bramble, deep, exaggerated perspective, locked-off static shot.` · Default → `Medium shot of Bramble, 50 mm normal lens, eye level, camera 3.0 m from Bramble, natural perspective, locked-off static shot.`

UI: the phrase sits under the monitor in a mono line with a copy icon; `C` copies it; toast `Copied: "Medium close-up of Bramble, 85 mm …"` (truncated 48 chars).

### 4.2 JSON export schema `animation-lab.shot/1` (`src/export/shot-export.ts`, JSON Schema at `src/export/shot-settings.schema.json`)

```ts
export interface ShotExportV1 {
  schemaVersion: 'animation-lab.shot/1';
  meta: { app: 'animation-lab'; appVersion: string; labId: 'lens-and-framing'; exportedAt: string; url?: string };
  coordinateSystem: {
    engine: 'three.js'; handedness: 'right'; up: 'Y'; units: 'meters'; cameraLooksAlong: '-Z';
    blenderMap: '(x, -z, y)'; unrealMap: '100 * (-z, x, y)';
  };
  frame: { aspect: 1.7777777778; width: 1920; height: 1080 };          // nominal monitor resolution
  sensor: { fit: 'horizontal'; gateWidthMm: 36; gateHeightMm: 20.25 };
  lens: { focalLengthMm: number; hFovDeg: number; vFovDeg: number; lensClass: LensClass };
  camera: {
    mode: CameraMode;
    position: [number, number, number]; target: [number, number, number]; up: [0, 1, 0];
    forward: [number, number, number]; quaternion: [number, number, number, number];    // (x,y,z,w)
    yawDeg: number; pitchDeg: number; rollDeg: number;                                    // Euler 'YXZ'
  };
  clip: { nearM: number; farM: number };
  derived: { hFovDeg: number; vFovDeg: number; frameWidthAtSubjectM: number; frameHeightAtSubjectM: number; subjectFrameFraction: number; backgroundDepthM: number; kRatio: number };
  subject: { id: TargetId; name: string; position: [number, number, number]; heightM: number; distanceM: number; anchor: 'head' | 'both-mid' };
  classification: { shotSize: ShotSize; lensClass: LensClass; angle: AngleClass; perspective: PerspectiveClass; movement: 'static' };
  prompt: { phrase: string; parts: PromptParts };
  engines: {
    blender: { lensMm: number; sensorFit: 'HORIZONTAL'; sensorWidthMm: 36; sensorHeightMm: 20.25; location: [number, number, number]; rotationEulerDeg: [number, number, number]; rotationMode: 'XYZ'; clipStart: number; clipEnd: number };
    unreal: { locationCm: [number, number, number]; rotator: { yaw: number; pitch: number; roll: number }; filmback: { sensorWidthMm: 36; sensorHeightMm: 20.25 }; currentFocalLengthMm: number; lensSettings: { minFocalLengthMm: 18; maxFocalLengthMm: 135 } };
  };
  animation: { timeSeconds: number; loopDurationSeconds: 6; clipId: string; frameRate: 24; frame: number };
}
```

Conversion math (`src/export/engines/blender.ts`, `unreal.ts`):
- Blender location `(x, −z, y)`. Rotation: `M_b = Rx(+90°) · R_three` (R_three from the quaternion). Blender's `rotation_mode 'XYZ'` is extrinsic X→Y→Z, i.e. `R = Rz(γ)·Ry(β)·Rx(α)`, which is three's `'ZYX'` order → `new Euler().setFromRotationMatrix(M_b, 'ZYX')` and export `[deg(x), deg(y), deg(z)]`. Verified: three `Euler` default order 'XYZ' builds `Rx·Ry·Rz`; `setFromRotationMatrix` supports all six orders.
- Unreal location `100·(−z, x, y)` cm. Let `P = [[0,0,−1],[1,0,0],[0,1,0]]` (det −1: converts handedness). `R_u = P · R_three · Pᵀ`. Forward `F = R_u·(1,0,0)`, Right `Rt = R_u·(0,1,0)`, Up `U = R_u·(0,0,1)`. `yaw = atan2(F.y, F.x)`, `pitch = atan2(F.z, hypot(F.x, F.y))`, `roll = atan2(−Rt.z, U.z)` (0 when level). Degrees.
- Three-side: `forward = (0,0,−1)` rotated by the quaternion (three cameras look down local −Z; `Object3D.lookAt` uses `_m1.lookAt(position, target, up)` for cameras — verified).

Worked examples (used verbatim in `docs/shot-settings.md` and as Vitest expectations, tolerance 1e-3 / 0.01°):
1. Default pose: position (0, 1.45, 0), target (0, 1.45, −3), quaternion (0,0,0,1) → Blender location (0, 0, 1.45), rotation (90, 0, 0); Unreal location (0, 0, 145), rotator (0, 0, 0).
2. Yaw-only: position (3, 1.4, −3) looking at (0, 1.4, −3) → forward (−1,0,0), quaternion (0, 0.70711, 0, 0.70711), yaw +90° → Blender location (3, 3, 1.4), rotation (90, 0, 90); Unreal location (300, 300, 140), rotator yaw −90, pitch 0, roll 0.
3. Pitch-only: position (0, 2.0, 0) looking at (0, 1.45, −3) → pitch −10.39° → Blender rotation (79.61, 0, 0); Unreal rotator pitch −10.39, yaw 0, roll 0.
4. Ex2 at 85 mm: position (0, 1.45, −0.146), hFov 23.91, vFov 13.59, frameWidthAtSubject 1.209 m, frameHeightAtSubject 0.680 m, subjectFrameFraction 2.50, Zb 8.854, k 0.322 → Blender location (0, 0.146, 1.45), rotation (90,0,0), lens 85; Unreal location (14.6, 0, 145), focal 85.

UX: in the monitor toolbar `Copy JSON` and `Copy prompt` buttons (+ keys ⇧C / C), toasts `Copied shot settings JSON (1.9 KB)`; `X` opens a right-side read-only drawer: pretty-printed JSON (`<pre>` with line numbers, syntax tint, `user-select: all`), header shows schema version and the phrase, footer `Copy JSON · Download .json` (download via Blob URL; file name `shot-85mm-mcu-2026-11-01T10-22.json`). Clipboard (`src/lib/clipboard.ts`): `navigator.clipboard.writeText` in a user-activation handler; on `NotAllowedError`/insecure context fall back to selecting the `<pre>` text and showing `Press ⌘C to copy` (MDN: writes need secure context + transient activation or the clipboard-write permission).

---

## 5. Lab registry + home

### 5.1 Types and data (`src/labs/types.ts`, `src/labs/registry.ts`)

```ts
export type LabStatus = 'available' | 'concept';
export type LabCategory = 'camera' | 'staging' | 'composition' | 'lighting' | 'focus';
export interface LabEntry {
  id: 'lens-and-framing' | 'camera-movement' | 'staging-and-blocking' | 'shot-types-and-composition' | 'lighting-studio' | 'focus-and-dof';
  title: string; description: string; category: LabCategory; status: LabStatus;
  order: number; minutes?: number;
  preview: { kind: 'image'; src: string; alt: string } | { kind: 'gradient'; from: string; to: string };
  concepts: string[];                         // chips on the card
}
export const LABS: readonly LabEntry[] = [
  { id: 'lens-and-framing', title: 'Lens & Framing', status: 'available', order: 0, minutes: 10, category: 'camera', description: 'Focal length, distance and why perspective comes from where the camera stands.', preview: { kind: 'image', src: '/labs/lens-and-framing/preview.jpg', alt: '…' }, concepts: ['Field of view', 'Perspective', 'Matched framing', 'Shot language'] },
  { id: 'camera-movement', title: 'Camera Movement', status: 'concept', order: 1, category: 'camera', description: 'Dolly, push-in, pan and the zoom-versus-dolly difference in motion.', preview: { kind: 'gradient', from: 'var(--color-stage-800)', to: 'var(--color-stage-600)' }, concepts: ['Dolly', 'Zoom', 'Pan'] },
  { id: 'staging-and-blocking', title: 'Character Staging & Blocking', status: 'concept', order: 2, category: 'staging', ... },
  { id: 'shot-types-and-composition', title: 'Shot Types & Composition', status: 'concept', order: 3, category: 'composition', ... },
  { id: 'lighting-studio', title: 'Lighting Studio', status: 'concept', order: 4, category: 'lighting', ... },
  { id: 'focus-and-dof', title: 'Focus & Depth of Field', status: 'concept', order: 5, category: 'focus', ... },
];
export const getLab = (id: string) => LABS.find(l => l.id === id);
export const availableLabs = () => LABS.filter(l => l.status === 'available');
```
Lab modules (`src/labs/loaders.ts`, client file): `export const LAB_LOADERS = { 'lens-and-framing': () => import('@/labs/lens-and-framing') } as const satisfies Partial<Record<LabEntry['id'], () => Promise<{ default: LabModule }>>>` and `export interface LabModule { id: LabEntry['id']; Component: React.ComponentType; exercises?: ExerciseDefinition[] }`.

### 5.2 Routing

- `src/app/page.tsx` (server, static): hero + lab grid.
- `src/app/labs/[labId]/page.tsx` (server): `export function generateStaticParams() { return availableLabs().map(l => ({ labId: l.id })) }`; `export default async function LabPage({ params }: PageProps<'/labs/[labId]'>) { const { labId } = await params; const lab = getLab(labId); if (!lab || lab.status !== 'available') notFound(); return <LabShell labId={lab.id} title={lab.title} /> }`. (Verified: `params` is a Promise; `PageProps<>` is a global helper generated by `next dev/build/typegen`; with `cacheComponents` + `generateStaticParams` the page is prerendered for the samples; `notFound()` throws and renders the nearest `not-found`.)
- `src/app/labs/[labId]/not-found.tsx`: "That lab is not built yet." + list of available labs + link home.
- `src/app/labs/[labId]/LabShell.tsx` (`'use client'`): `const Lab = useMemo(() => dynamic(LAB_LOADERS[labId], { ssr: false, loading: () => <LabLoading /> }), [labId])` — `ssr: false` only works in Client Components (verified in bundled Next docs). Also installs the key map provider, toasts, help modal, and rehydrates progress.
- `src/app/not-found.tsx` global 404.
- `next.config.ts`: add `transpilePackages: ['three']` (R3F install docs for Next ≥ 13.1); keep `cacheComponents`, `partialPrefetching`, Turbopack CSS rule.

### 5.3 Home page (`/`)

- Hero (full-bleed dark stage gradient, no WebGL on the home page to keep it instant): eyebrow `ANIMATION LAB`, title `An interactive school for animated filmmaking`, one sentence, primary button `Open Lens & Framing →`, secondary `What is this?` (anchors to a 3-bullet section). A static preview image of the lab (`public/labs/lens-and-framing/preview.jpg`, produced by the Phase 6 screenshot run) with a subtle parallax disabled under reduced motion.
- Lab grid: available card is a real link (`<Link href="/labs/lens-and-framing">`), shows `10 min`, concept chips, and a client-only `Continue · 1/3 exercises` badge read from the progress store after hydration.
- Concept cards: `aria-disabled="true"`, not focusable, no hover lift, 60% opacity thumbnail with a diagonal hatch, top-left label `CONCEPT · NOT YET BUILT`, description ends with `Planned`. They render as `<article>` (not links or buttons) so nothing can be mistaken for working. Roadmap order fixed by `order`.
- Footer: `Built with Next.js, React Three Fiber and three.js · Source · Limitations` (links to docs).

### 5.4 Shared infrastructure folders and how a second lab plugs in

```
src/camera/       simulation engine: optics.ts (fov, frame size), framing.ts (match solver, clamps), pose.ts (aim/quaternion), measure.ts (projection-based measurements), classify.ts (shot/lens/angle/perspective)
src/scenes/       environments + composition: doorway-set/ (world.ts, Environment.tsx, props/), index.ts (scene registry)
src/characters/   procedural puppets + clips: bramble/, pip/, rig/ (joints, materials), clips/doorway-wave-v1.ts, index.ts
src/timeline/     store.ts, clock.ts (deterministic advance/wrap), controls/ (Transport, Scrubber)
src/education/    types.ts, LessonEngine.ts, progress.ts, exercises.ts, copy.ts, components/ (LessonCard, Caption, HelpModal, PerspectiveGuide)
src/design/       tokens.css (all colours/spacing/radii as CSS variables + Tailwind @theme), primitives/ (GlassPanel, Chip, Segmented, Slider, IconButton, Toast, Kbd, Tooltip)
src/renderers/    stage/ (StageView, CameraRig, Frustum, Rulers, TargetIndicator, DragDolly), monitor/ (MonitorView, FramingGuides, Readouts)
src/export/       shot-export.ts, prompt-phrase.ts, engines/{blender,unreal}.ts, shot-settings.schema.json, validate.ts
src/state/        labStore.ts, progressStore.ts, events.ts, selectors.ts, testHook.ts
src/labs/         types.ts, registry.ts, loaders.ts, lens-and-framing/ (index.tsx, LensLab.tsx, layout/, controls/)
src/lib/          keys.ts, a11y.ts, clipboard.ts, thumbnails.ts, format.ts, idle.ts
```
A second lab (e.g. Camera Movement): add `src/labs/camera-movement/index.tsx` exporting a `LabModule` (its `Component` composes `StageView`/`MonitorView` with its own controls), add the loader entry, flip the registry `status` to `'available'`, add its exercises via the same `ExerciseDefinition` type, reuse `scenes/doorway-set` or register a new scene in `scenes/index.ts`, and extend the export `classification.movement` union + a `cameraPath` block under `schemaVersion 'animation-lab.shot/2'` with a `migrate` in the validator. The timeline already carries `clipId`, so a second performance is a new clip in `characters/clips`.

---

## 6. Keyboard & accessibility

### 6.1 Key map (`src/lib/keys.ts`; one `keydown` listener on `window`; ignored when `metaKey || ctrlKey || altKey`, or when `event.target` is editable (`input, textarea, select, [contenteditable]`) — except `Escape`; `event.code` for digits/brackets, `event.key` for letters; Shift-qualified = second tier)

| Key | Action | Toast |
|---|---|---|
| `1 2 3 4 5 6` | 18 / 24 / 35 / 50 / 85 / 135 mm | `24 mm` |
| `[` / `]` | focal −1 / +1 mm (`⇧` ±5 mm), clamped 18–135 | — (chip updates) |
| `←` / `→` | Fixed: dolly −0.10 / +0.10 m (`⇧` ±0.5 m). Match: framing −5 % / +5 % of p | Match only: `Framing 250 % → 262 %` |
| `M` | toggle Fixed ↔ Match | `Match framing — camera will move to keep Bramble 140 %` / `Fixed camera` |
| `T` | cycle target Primary → Secondary → Both | `Target: Pip` |
| `Space` | play / pause | — |
| `Home` | restart loop (t = 0, keeps playing state) | — |
| `,` / `.` | step −1 / +1 frame (1/24 s) when paused | — |
| `G` | rulers / ground markings | `Rulers off` |
| `F` | frustum | `Frustum hidden` |
| `O` | monitor overlays cycle: off → thirds → thirds + safe areas → off | `Overlays: thirds + safe areas` |
| `P` | perspective-guide pills | `Perspective guide on` |
| `V` | swap primary view (stage ↔ monitor) | `Monitor is now the main view` |
| `S` | save shot | `Saved Shot 2 · 85 mm · Match` |
| `C` / `⇧C` | copy prompt phrase / copy JSON | `Copied …` |
| `X` | export drawer | — |
| `L` | lesson card expand/collapse | — |
| `R` / `⇧R` | reset observer (stage) view / reset film camera to lab default (toast has `Undo`) | `View reset` / `Camera reset · Undo` |
| `?` (`⇧/`) or `H` | help modal | — |
| `⇧U` | hide / show all UI (clean captures); a 2 s toast `UI hidden · ⇧U to show` then nothing | — |
| `Esc` | close modal / drawer / popover; cancel an active drag | — |

Decision: the brief listed both `?` → help and `⇧/` → hide UI; they are the same chord on US layouts, so hide-UI is `⇧U`. Browser chords are never swallowed (⌘R, ⌘F, ⌘C with a selection).

Toasts: bottom-centre above the filmstrip, `role="status"`, 1600 ms, max 2 stacked, amber left rule; reduced motion: no slide, 120 ms fade.

### 6.2 Accessibility rules

- Sliders are native `<input type="range">` (styled; focal uses a log scale internally but exposes `aria-valuemin=18 aria-valuemax=135 aria-valuenow={f}` and `aria-valuetext="50 millimetres, 39.6 degrees horizontal field of view"`; distance `aria-valuetext="3.0 metres from Bramble"`). `aria-valuetext` is written on state change only (React re-render). The lens-ring dial mirrors the slider and is `role="slider"` with `aria-orientation="horizontal"`, arrow keys ±1 mm, PageUp/Down ±10 mm.
- Segmented controls: `role="radiogroup"` + `role="radio" aria-checked`, roving tabindex. Toggles: `aria-pressed`. Icon buttons have `aria-label` and a visible tooltip on focus.
- The caption is `aria-live="polite" aria-atomic="true"`; readout chips are not live (they update too often). Toasts `role="status"`.
- Focus order: chips/caption → lesson card → controls panel → monitor toolbar → filmstrip → tray. The 3D canvas is `tabIndex=0` with `aria-label="3D stage; use the controls panel or keyboard shortcuts"`; a skip link `Skip to controls`.
- `:focus-visible`: 2 px `--color-accent` (amber) outline, 2 px offset, on glass. Never remove outlines.
- Reduced motion (`prefers-reduced-motion: reduce`, mirrored into `ui.reducedMotion`; `?nomotion=1` forces it): camera moves jump (damp smoothTime → 0), no idle tour, no pulsing highlights, no slider track shimmer, transitions ≤ 120 ms. The character loop keeps playing because it is content and has a pause control (WCAG 2.2.2).
- Colour/contrast tokens (`src/design/tokens.css`): panel `rgba(12,16,24,0.72)` + `backdrop-filter: blur(14px)`; text primary `#E9EEF5` (≥ 12:1), secondary `#A8B3C2` (≥ 4.5:1 against the darkest plausible composite `#1a2130`), accent amber `#FFB454` (≥ 8:1 on panel), cyan line `#5BE3FF` for 3D lines only — cyan text uses `#8FEBFF` at ≥ 14 px; inverted "on" state for segmented pills `#E9EEF5` bg / `#0B0F17` text. Contrast is checked in Phase 6 with the review protocol (screenshots) and an axe pass in Playwright (`@axe-core/playwright`, dev dep) on the home page and lab shell (canvas excluded).
- Idle tour (free-explore only): starts 1.4 s after first paint if the user has not interacted; after any interaction it pauses and may resume after 3.6 s idle, only in free mode, never during exercises, never under reduced motion; it orbits the observer camera only (film camera untouched).

---

## 7. Verification plan

### 7.1 Vitest (`vitest.config.ts`: `environment: 'node'` default, `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`, `resolve.alias['@'] = './src'`; jsdom only per-file via `// @vitest-environment jsdom` for component tests)

| File | Cases (expected values) |
|---|---|
| `src/camera/optics.test.ts` | hFov/vFov table (tolerance 0.01°): 18 → 90.00/58.72 · 24 → 73.74/45.75 · 35 → 54.43/32.27 · 50 → 39.60/22.90 · 85 → 23.91/13.59 · 135 → 15.19/8.58. Frame size at Z=3, f=50: 2.160 × 1.215 m. Cross-check against three: `cam.aspect = 16/9; cam.filmGauge = 36; cam.setFocalLength(50)` → `cam.fov ≈ 22.90`, `cam.getFilmHeight() === 20.25`, `cam.getFocalLength() ≈ 50` (formulas verified in r187 source). Projected height `f·H/Z` equals NDC-based measurement within 0.1 % for a level camera. |
| `src/camera/perspective.test.ts` | Fixed mode: two points at depths 2 m and 4 m → NDC height ratio 2.000 for every f ∈ {18,24,35,50,85,135}; `apparentHeightRatio` from the default spot is 0.372 for all f; `faceStretch` constant across f in Fixed. |
| `src/camera/framing.test.ts` | Match: `Z(f) = Z(50)·f/50` (±0.5 %) for Ex2 (p = 2.5): 0.604/0.806/1.175/1.679/2.854/4.533 m; `targetFraction` stays 2.50 ± 0.0125 across f; re-aim keeps the anchor on the optical axis (NDC (0,0) ± 1e-6); clamps: p = 12 at 18 mm → `clamped: 'min'`, distance 0.45, `targetFraction < 12`; p = 0.2 at 135 mm → `clamped: 'max'` at 14 m; Both: horizontal fit rule (`max(hFrac, vFrac) = 0.8`) and `'both-infeasible'` when the solution exceeds 14 m; monotonicity: `p` decreases as `distanceM` increases. |
| `src/camera/classify.test.ts` | Shot-size boundaries (0.30, 0.65, 1.15, 2.0, 3.5, 7 — inclusive/exclusive as specified); lens bins at 20/21, 28/29, 42/43, 62/63, 105/106; angle at ±5°, ±25°, roll 3°; perspective at k = 0.15/0.5 (boundary values are `natural`). |
| `src/export/engines.test.ts` | The four worked examples (Section 4.2) for Blender and Unreal; `P·Pᵀ = I`; `det(P) = −1`; round trip: quaternion → Euler 'YXZ' → quaternion. |
| `src/export/shot-export.test.ts` | Full export for Ex2@85 matches a snapshot; validates against `shot-settings.schema.json` with Ajv (`ajv` dev dep, strict mode); `animation.frame === round(timeSeconds·24)`; `derived` equals `camera/measure` output. |
| `src/export/prompt-phrase.test.ts` | The three expected strings in 4.1; part ordering; two-shot prefix; dutch-tilt suffix. |
| `src/timeline/clock.test.ts` | Deterministic advance: `advance(t, dt)` with dt clamped to 1/30; wrap 5.9 + 0.2 → 0.1; negative scrub wraps; `scrubTo(2.4)` exact; pause freezes; camera actions (`setFocal`, `setMode`, `setDistance`, `applyShot`) never change `timeSeconds`/`playing` (store integration test). |
| `src/education/LessonEngine.test.ts` | Fake timers: Fixed 24 mm for 999 ms → not held; 1000 ms → held; sequence 24/50/85 completes Ex1; changing to Match before 1 s does not count; Ex2: Match + 24 + 85 with `cameraTravelled` 2.0 m → complete; switching target resets Ex2 holds; Ex3: save with `reaction`, then `relationship` → complete; deleting one → incomplete; `presetHeld` with f = 23.4 ignored (tolerance). Snapshot of card copy tokens substituted. |
| `src/state/progressStore.test.ts` (jsdom) | persist writes `animation-lab.progress.v1`; `partialize` excludes transient fields; 13th shot requires confirmation; `migrate` from version 0 returns defaults. |
| `src/lib/keys.test.ts` | Key map dispatch table; ignores modifiers/editable targets; `?` opens help; `⇧U` hides UI. |

### 7.2 Playwright (`playwright.config.ts`: `testDir: 'e2e'`, `use: { baseURL: 'http://localhost:3100', viewport: {1440×900}, deviceScaleFactor: 1, permissions: ['clipboard-read','clipboard-write'], reducedMotion: 'no-preference' }`, project `chromium` (+ `chromium-reduced` with `reducedMotion: 'reduce'`); `webServer: { command: 'pnpm start -p 3100', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI, timeout: 120_000 }` after `NEXT_PUBLIC_E2E=1 pnpm build`; `launchOptions.args` fallback `['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']` enabled only if the WebGL canary fails on the machine)

| Spec | Flow / assertions |
|---|---|
| `e2e/00-webgl-canary.spec.ts` | `/labs/lens-and-framing?e2e=1` → `canvas` visible; `page.on('console')` collects errors → none; `page.on('pageerror')` none; `window.__animationLab` defined. |
| `e2e/01-home.spec.ts` | `/` renders hero; available card is a link to `/labs/lens-and-framing`; concept cards have `aria-disabled=true`, no `href`, contain text `Concept · not yet built`; `/labs/camera-movement` → 404 page text; `/labs/nope` → 404. |
| `e2e/02-focal.spec.ts` | Drag `getByTestId('focal-slider')` to 24 → `data-focal-mm="24"`, chip `73.7°`, caption contains `24 mm`; preset buttons 1–6 via click and keys; `[`/`]` nudge. |
| `e2e/03-mode-moves-camera.spec.ts` | Start Fixed; record `getState().camera.pose.position`; press `M`, `settle()` → position unchanged at same f; press `2` then `settle()` → position z changed by ≥ 0.5 m and `distanceM ≈ 0.806·(matchFraction/2.5)…` (assert `|Z(24)/Z(50) − 0.48| < 0.01`); `data-shot-size` constant across 24/85 in Match. |
| `e2e/04-drag-dolly.spec.ts` | Mouse-drag the stage camera handle (`getByTestId('stage-camera-handle')`) 120 px along its axis → `distanceM` changes monotonically, monitor readout distance updates, `data-mode` stays `fixed`; Esc cancels mid-drag. |
| `e2e/05-pause-compare.spec.ts` | Space → `data-playing=false`, read `data-time-s`; press `2`, `5`, `M`, drag slider → `data-time-s` unchanged (string equality). `Home` → 0.000. |
| `e2e/06-sync.spec.ts` | `freeze=2.0`: `captureMonitor()` and a stage screenshot at the same time; `getState()` time equals 2.000 in both renderers' debug attributes (`data-stage-time`, `data-monitor-time`). |
| `e2e/07-exercises.spec.ts` | Start Ex1 from the card; hold 24 (wait 1100 ms), 50, 85 → `data-exercise="ex1-how-wide:complete"`, toast; Ex2: initial state `data-mode=match`, `distanceM ≈ 1.68`; hold 24, 85 → complete, travel ≥ 0.5; Ex3: select objective, press `S`, pick Reaction; repeat → complete. Reload → progress persisted (badge `3/3`). |
| `e2e/08-save-shot.spec.ts` | `S` → tray tile appears with `img[src^="data:image/jpeg"]` natural size 320×180; change lens; click tile → restored `data-focal-mm` and `data-time-s` equal the saved values and `data-playing=false`. |
| `e2e/09-export.spec.ts` | Click `Copy JSON` → `navigator.clipboard.readText()` parses; `validateShotExport(json).ok === true` (import the TS validator in the test); `schemaVersion === 'animation-lab.shot/1'`; `engines.blender.location[2] === camera.position[1]`; `Copy prompt` → text matches `/^(Extreme wide shot|Wide shot|Full shot|Medium shot|Medium close-up|Close-up|Extreme close-up)( — )?/`; drawer `X` shows the same JSON. |
| `e2e/10-keys.spec.ts` | Every key in 6.1 produces its state change / toast; shortcuts suppressed while the label input is focused; `⇧U` hides UI (no `[data-ui]` visible) and restores. |
| `e2e/11-reduced-motion.spec.ts` (project chromium-reduced) | `M` + `2` → pose reaches the target within 2 frames (`settle()` resolves < 100 ms); no `.is-highlighted` animation (computed `animation-name: none`). |
| `e2e/12-screenshots.spec.ts` | For viewports 1920×1080, 1440×900, 1280×800 and states {default, 24-fixed, 85-fixed, 24-match-mcu, 85-match-mcu, monitor-primary, ex2-card, export-drawer, help} → `page.screenshot({ path: docs/screenshots/<vw>/<state>.png })` with `freeze=2.0&nomotion=1`. 27 images for human review. |
| `e2e/13-visual-monitor.spec.ts` | `expect(getByTestId('monitor-canvas-region')).toHaveScreenshot('monitor-<f>-fixed.png', { maxDiffPixelRatio: 0.02, animations: 'disabled' })` for f ∈ {24, 50, 85} at `freeze=2.0`, 1440×900, dpr 1; baselines committed for darwin; skipped on other platforms unless `VISUAL=1`. |
| `e2e/14-frustum-agreement.spec.ts` | With `debugFrustum=1` the monitor draws the projected frustum rectangle at the target depth (should coincide with the monitor edges): screenshot the monitor region, scan a 3 px border band with `pngjs` and assert the cyan outline occupies ≥ 95 % of the band and nothing cyan lies > 3 px inside. Also compare `getState().derived.frameWidthAtTargetM` with `Z·36/f` (±0.5 %). |
| `e2e/15-a11y.spec.ts` | `@axe-core/playwright` on `/` and the lab shell (exclude `canvas`): no serious/critical violations; `focal-slider` has `aria-valuetext` matching `/\d+ millimetres, [\d.]+ degrees/`. |

### 7.3 Screenshot review protocol (`docs/screenshots/REVIEW-<phase>.md`, filled by a human or the agent reading every image)

For each of the 27 images: (1) no clipped text or panels at the viewport edges; (2) no label overlap (chips, pills, ruler ticks, filmstrip captions); (3) all numbers fit their chips without ellipsis; (4) the monitor shows the same frame/time as the stage (compare character pose); (5) the frustum rectangle at the target depth, overlaid on the monitor thumbnail (the `14-frustum-agreement` artefact `docs/screenshots/overlays/<state>.png`), aligns within 3 px; (6) frustum is visible and not occluding the characters in the default observer view; (7) character silhouettes read at thumbnail size; (8) contrast of secondary text on glass is legible; (9) the lesson card and controls do not cover the characters in the monitor at 1280×800. Each row: PASS / FIX with a note; a phase cannot close with any FIX open.

### 7.4 Performance check

- Dev-only `StatsGl` (drei) and the R3F `PerformanceMonitor` are mounted when `?stats=1`; `PerformanceMonitor onDecline` steps dpr 2 → 1.5 → 1 and disables soft shadows; `onIncline` restores (API verified).
- Budgets: M-series laptop at 1440×900: ≥ 55 fps with both views, dpr ≤ 2; Intel iGPU (2019 MBP class) at dpr 1: ≥ 30 fps; draw calls ≤ 150 per view, triangles ≤ 300 k total, monitor render ≤ 1280×720 (drops to 960×540 on decline); JS main thread per frame ≤ 6 ms excluding GPU; initial lab bundle (client JS, gzip) ≤ 650 kB; home page ships no WebGL.
- Recorded in `docs/limitations.md` → Performance section with the measured numbers and machine.

### 7.5 Gates and the completion rule

`package.json` scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"typecheck": "next typegen && tsc --noEmit"`, `"lint": "eslint ."`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"build:e2e": "NEXT_PUBLIC_E2E=1 next build"`, `"test:e2e": "pnpm build:e2e && playwright test"`, `"test:e2e:update": "pnpm build:e2e && playwright test --update-snapshots"`, `"verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e"`, `"meshy": "node --env-file=.env.local scripts/meshy-generate.ts"`.

Rule (written into README and AGENTS.md project section): **a green `pnpm verify` is necessary, never sufficient.** A phase or the MVP is "done" only when (a) `pnpm verify` is green, (b) the screenshot review protocol for that phase has zero open FIX rows, (c) the acceptance checklist in `docs/acceptance.md` (15 spec items) has evidence links (test name or screenshot path) for every item the phase claims, and (d) the limitations doc lists anything approximated.

---

## 8. Delivery plan

### 8.1 Project setup (Phase 1 start; all steps are edits to the existing scaffold)

1. `package.json`: add `"engines": { "node": "26.x" }` (Vercel: 26.x is the default and `engines.node` overrides project settings — verified); keep `"packageManager": "pnpm@10.33.0"`; scripts from 7.5.
2. Dependencies (exact pins where R3F peer ranges are tight): `three@0.187.0`, `@react-three/fiber@9.8.2` (peer `react >=19 <19.4` — 19.3.0 OK), `@react-three/drei@10.7.9` (peer fiber ^9, three ≥ 0.159), `zustand@5.0.16`, `maath@0.10.8`, optional `@react-three/postprocessing@3.2.2` + `postprocessing@^6.39.3` (peer `postprocessing ^6.36.0`; only if the renderer plan adopts bloom). Dev: `@types/three@0.187.0`, `vitest@5.0.5`, `vite@^8` (vitest peer `^6.4 || ^7 || ^8`; node `>=26` satisfies `^22.12 || ^24 || >=26`), `@playwright/test@1.64.1`, `@axe-core/playwright`, `ajv@^8`, `pngjs` + `@types/pngjs`, `@fal-ai/client@1.10.1` (script only), `@types/node@^24` (vitest peer `^22 || >=24`; replaces `^20`).
3. `pnpm install`; if pnpm 10 reports blocked build scripts, approve only known ones via `pnpm approve-builds` (none expected beyond the already-ignored `sharp`, `unrs-resolver`). `pnpm exec playwright install chromium`.
4. `next.config.ts`: `transpilePackages: ['three']`.
5. `.env.example` → `FAL_KEY=`; `.gitignore`: append `!.env.example` directly after `.env*`. Confirm `git status` shows `.env.local` untracked-ignored.
6. `mise.toml`: `[tools]\nnode = "26.13.0"\npnpm = "10.33.0"` (both in the mise registry; `packageManager` remains the source of truth for pnpm).
7. `src/app/layout.tsx`: keep Geist/Geist Mono (not Outfit/DM Mono), set metadata title `Animation Lab`, `<html lang="en" className="dark">`, `color-scheme: dark`; `globals.css`: import `@/design/tokens.css`, dark stage background tokens.
8. `vitest.config.ts`, `playwright.config.ts`, `e2e/`, `docs/`, `scripts/` skeletons. `tsconfig.json`: add `"vitest/globals"` only if globals are enabled (default: not).
9. Git: no commits unless asked (the CNA commit stays). Vercel: no deploy unless asked; when the user deploys, add `FAL_KEY` in the Vercel project only if a server route ever needs it (the MVP does not; the Meshy script runs locally) — note this in README.
10. Optional `scripts/meshy-generate.ts` (Node 26 type-stripping, erasable TS only): flags `--prompt`, `--out public/models/<name>.glb`, `--mode preview|full` (price $0.80 / $1.20 per verified fal page), `--budget <usd>` required for a real run, `--dry-run` default; a ledger `scripts/.meshy-ledger.json` accumulates spend and refuses when `spent + estimate > min(budget, 10)`; uses `fal.subscribe('fal-ai/meshy/v7.1/text-to-3d', { input: { prompt, mode, topology: 'quad', target_polycount: 20000, symmetry_mode: 'auto', enable_pbr: true, should_remesh: true } })` and downloads `result.data.model_glb.url`; the client reads `FAL_KEY` from env (verified) — never from browser code. GLBs are committed; nothing runs at runtime.

### 8.2 Phases (mapped to the spec's six phases), exit criteria, demoable

| Phase | Goal | Exit criteria | Demoable |
|---|---|---|---|
| **1 Foundation** | Scaffold adjustments, tokens, stores (lab/timeline/progress/events), registry + routes, LabShell with dynamic ssr:false Canvas, key map provider, toast/help primitives, Vitest + Playwright skeleton, WebGL canary | `pnpm verify` green with canary + home specs; `/labs/camera-movement` 404; store/timeline unit tests pass | Home with 1 real + 5 concept cards; lab route opens a dark stage with a placeholder cube and working chips |
| **2 Simulation engine** | `src/camera/*` + `src/export/*` + classifier + prompt phrase, all pure, fully unit-tested | optics/framing/classify/engines/export/prompt tests pass with the expected numbers in 7.1; `docs/shot-settings.md` draft with worked examples | Readout chips and caption react to a focal slider; Copy JSON works against the placeholder scene |
| **3 Animated scene** | Doorway set, Bramble + Pip procedural puppets, `doorway-wave-v1` 6 s clip, deterministic clock, materials/lighting per theme | Art review: 6 stage screenshots pass the protocol's silhouette/colour rows; loop seamless (frame 0 == frame 6.0 pose within 1e-3); time determinism tests | The performance loops in the stage view; pause/scrub works |
| **4 Renderers & interaction** | StageView (orbit, rig, frustum, rulers, target indicator, drag dolly), MonitorView (16:9, guides, readouts), swap, filmstrip, controls panel, Match solver animation, idle tour | e2e 02–06, 10, 14 pass; perf budget met on the dev machine; screenshot protocol for Phase 4 clean | **The 30-second demo**: drag the slider, toggle Match, watch the camera travel through the set |
| **5 Lessons, education, export UX** | LessonEngine, exercises, lesson card, copy, perspective guide, Save-shot tray, persistence, export drawer, prompt line | e2e 07–09 pass; lesson predicate tests pass; copy proofread against the optics facts | Complete all three exercises; saved shots restore; copy JSON/phrase |
| **6 Polish, a11y, verification, docs** | Reduced motion, axe, contrast, toasts, help, screenshots at 3 sizes, visual baselines, docs, limitations, acceptance checklist | `pnpm verify` green; all 15 acceptance items evidenced; REVIEW-6 has zero FIX rows; README/architecture/shot-settings/limitations written | Release candidate ready for the user to deploy |

### 8.3 Docs to write

- `README.md`: what it is, setup (`mise install`, `pnpm install`, `pnpm dev`), scripts, architecture map (folders in 5.4), testing, the completion rule, deployment notes (Vercel, Node 26.x, `FAL_KEY` not needed at runtime).
- `docs/architecture.md`: the six-module split (engine / scene / stage renderer / live renderer / lessons / UI), the single-store rule, data flow diagram (events → lessons/toasts), render loop ordering (priorities), how views share one Canvas, extension guide for a second lab.
- `docs/shot-settings.md`: schema field by field, coordinate conventions, Blender/Unreal math (Section 4.2) with the four worked examples, the prompt-phrase grammar and Seedance guidance, versioning policy.
- `docs/limitations.md`: pinhole model; no focus breathing; no DoF; procedural characters (not production rigs); "Both" target heuristic (80 % fit rule, infeasible cases); min/max distance clamps; thumbnails are 320×180 JPEGs; clipboard needs HTTPS/user gesture (Firefox/Safari permission differences); visual baselines are darwin-only; performance caveats with measured numbers; keyboard layout assumption for `?`.
- `docs/acceptance.md`: the 15 acceptance items with evidence columns.
- `docs/screenshots/`: `<viewport>/<state>.png`, `overlays/`, `REVIEW-<phase>.md`.
- `docs/education-copy.md`: generated from `copy.ts` by a tiny script (`scripts/export-copy.ts`) so the text is reviewable without reading TS.

---

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| R3F/Next version pitfalls (React 19.3 cap `<19.4`, `ssr:false` only in client components, `transpilePackages`, `cacheComponents` Activity keeping routes mounted) | Medium | Exact pins; LabShell is the only dynamic boundary; effects that attach window listeners must clean up (Activity hides, not unmounts — verified doc); WebGL canary e2e. |
| WebGL context loss (tab switch, GPU reset) | Medium | Listen for `webglcontextlost`/`restored` on `gl.domElement`; show a "Stage paused — click to restore" glass overlay; state lives in zustand so nothing is lost; e2e simulates via `WEBGL_lose_context`. |
| Performance on iGPUs with two renders per frame | Medium | `PerformanceMonitor` dpr/quality stepping; monitor FBO capped at 1280×720; shadows baked (`BakeShadows`) after settle; budgets measured and documented. |
| Procedural characters look cheap | High | Art review loop each phase with the screenshot protocol; exaggerated nose/brow/ears for the perspective lesson; satin toon materials, rim light; fallback: Meshy script for 1–2 static set pieces only (≤ $10 ledger-guarded), never characters. |
| Matched-framing edge cases (lens inside the character, Both infeasible, target switch mid-move) | High | Clamps 0.45–14 m with `clamped` state + caption copy; Both uses the 80 % fit rule with explicit "not feasible" messaging; solver is idempotent and runs on the settled pose; unit tests for every clamp. |
| Timeline drift between views / after tab sleep | Medium | One clock advanced once per frame (dt clamp 1/30), both renderers read the same ref; wrap tested; `visibilitychange` pauses the clock accumulation. |
| Scope creep vs non-goals (DoF, lighting editor, camera paths) | Medium | Non-goals listed in README; registry shows them as concepts; export schema reserves `movement`/`cameraPath` for v2 instead of implementing them. |
| Licensing of references (Plane of Focus all-rights-reserved; Anatomy MIT) | Low | Idea-level only; no copied CSS/markup/fonts (Geist stays); a `docs/credits.md` names inspirations and licences; design tokens are original. |
| Clipboard restrictions (HTTP dev hosts, Firefox/Safari permission model) | Medium | Secure-context check; fallback select-to-copy; e2e only on Chromium with granted permissions (`clipboard-read/write` not supported in Firefox/Safari — verified MDN/Playwright). |
| Headless WebGL in Playwright | Medium | Canary spec first; fallback launch args (`--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`); visual tolerances; baselines per platform. |
| localStorage quota / corrupt progress | Low | 12-shot cap, JPEG 320×180; `migrate` + try/catch around rehydrate → reset with a toast "Saved progress could not be read; starting fresh". |
| `?` vs `⇧/` key collision and non-US layouts | Certain | `⇧U` for hide-UI; `event.key === '?'` for help (layout-independent); documented. |
| Thumbnail capture timing (buffer cleared before crop) | Low | Capture inside the post-render `useFrame` of the same tick; e2e asserts non-blank JPEG (mean luminance > 0.02). |

### File tree
- package.json — scripts (typecheck/lint/test/test:e2e/verify/meshy), engines.node 26.x, exact pins
- next.config.ts — add transpilePackages ['three'] (keep cacheComponents, partialPrefetching, Turbopack CSS rule)
- mise.toml — node 26.13.0, pnpm 10.33.0
- .env.example — FAL_KEY= (fix from FAL_API_KEY=)
- .gitignore — add !.env.example after .env*
- vitest.config.ts — node env, include src/**/*.test.ts(x), alias @
- playwright.config.ts — baseURL :3100, permissions clipboard, projects chromium + chromium-reduced, webServer next start
- src/app/layout.tsx — dark root, Geist fonts, metadata
- src/app/page.tsx — home: hero + lab grid (available vs concept cards)
- src/app/not-found.tsx — global 404
- src/app/labs/[labId]/page.tsx — generateStaticParams, notFound for unknown/concept labs, renders LabShell
- src/app/labs/[labId]/not-found.tsx — 'not built yet' page
- src/app/labs/[labId]/LabShell.tsx — 'use client'; next/dynamic ssr:false lab loader, key map, toasts, help, progress rehydrate
- src/labs/types.ts — LabEntry, LabStatus, LabModule types
- src/labs/registry.ts — LABS data (1 available + 5 concepts in roadmap order), getLab/availableLabs
- src/labs/loaders.ts — literal import map for lab modules
- src/labs/lens-and-framing/index.tsx — LabModule default export
- src/labs/lens-and-framing/LensLab.tsx — layout composition (stage, monitor overlay, chips, caption, controls, filmstrip, tray)
- src/state/labStore.ts — canonical camera/overlays/ui/lesson state (zustand 5 + subscribeWithSelector)
- src/state/progressStore.ts — persisted exercises/savedShots/prefs (persist, skipHydration, migrate)
- src/state/events.ts — typed event bus emitted by every action
- src/state/selectors.ts — memoised Derived selectors
- src/state/testHook.ts — window.__animationLab + data-* mirrors (NEXT_PUBLIC_E2E or ?e2e=1)
- src/camera/optics.ts — hFov/vFov, frame size, projected size
- src/camera/framing.ts — Match solver, clamps, Both fit rule
- src/camera/pose.ts — aim/quaternion/Euler YXZ
- src/camera/measure.ts — projection-based measurements (p, k, faceStretch, ratios)
- src/camera/classify.ts — shot size / lens class / angle / perspective bins
- src/scenes/doorway-set/world.ts — WORLD constants (positions, heights, bounds, gate)
- src/characters/clips/doorway-wave-v1.ts — 6 s deterministic clip
- src/timeline/store.ts — playing/time/loop/clip state
- src/timeline/clock.ts — deterministic advance + wrap
- src/education/types.ts — ExerciseDefinition, steps, UiTargetId, LessonMode
- src/education/progress.ts — ExerciseProgress, reducers, HOLD_MS, snapPreset
- src/education/exercises.ts — the three exercise definitions as data
- src/education/LessonEngine.ts — subscriptions, hold timer, predicates, highlight
- src/education/copy.ts — all lesson/lens/caption/help/pill copy with tokens
- src/education/components/LessonCard.tsx — card UI
- src/education/components/Caption.tsx — aria-live caption with templates
- src/education/components/HelpModal.tsx — help sections + KEYS + footnote
- src/education/components/PerspectiveGuide.tsx — in-monitor pills
- src/export/shot-export.ts — buildShotExport(state): ShotExportV1
- src/export/prompt-phrase.ts — classifier → phrase + parts
- src/export/engines/blender.ts — (x,-z,y), Rx(90)·R, Euler 'ZYX'
- src/export/engines/unreal.ts — 100·(-z,x,y), FRotator extraction
- src/export/shot-settings.schema.json — JSON Schema for animation-lab.shot/1
- src/export/validate.ts — runtime validator shared by Vitest and Playwright
- src/export/components/ExportDrawer.tsx — read-only JSON preview, copy/download
- src/design/tokens.css — colour/spacing tokens (graphite/navy, amber, cyan, glass)
- src/design/primitives/* — GlassPanel, Chip, Segmented, Slider, IconButton, Toast, Kbd, Tooltip
- src/lib/keys.ts — key map + dispatcher (modifier/editable guards)
- src/lib/clipboard.ts — writeText with fallback
- src/lib/thumbnails.ts — same-tick canvas crop → JPEG data URL
- src/lib/format.ts — mm/m/%/° formatting rules
- src/lib/idle.ts — idle tour timing (1.4 s / 3.6 s)
- src/renderers/stage/* — StageView, CameraRig, Frustum, Rulers, TargetIndicator, DragDolly (owned by renderer plan; consumed here)
- src/renderers/monitor/* — MonitorView, FramingGuides, Readouts, capture hook
- e2e/00-webgl-canary.spec.ts … e2e/15-a11y.spec.ts — Playwright flows listed in 7.2
- e2e/helpers/lab.ts — openLab(), settle(), readState(), holdPreset()
- docs/architecture.md — module split, data flow, render ordering, extension guide
- docs/shot-settings.md — schema, conversions, worked examples, prompt grammar
- docs/limitations.md — approximations, heuristics, perf numbers
- docs/acceptance.md — 15 acceptance items with evidence
- docs/screenshots/<viewport>/<state>.png + overlays/ + REVIEW-<phase>.md — review artefacts
- docs/education-copy.md — generated copy dump for proofreading
- docs/credits.md — inspirations and licences
- scripts/meshy-generate.ts — optional, cost-guarded fal.ai Meshy v7.1 generator (dry-run default)
- scripts/export-copy.ts — generates docs/education-copy.md from copy.ts

### Phases
- **Phase 1 — Foundation (adjust scaffold, stores, registry, routes, test infra)** — Turn the existing create-next-app scaffold into the lab skeleton with the canonical stores, registry/routing, key map, toasts, and working unit/e2e harnesses.
  - deliverables: package.json pins + scripts, engines.node 26.x, mise.toml, .env.example FAL_KEY=, .gitignore !.env.example, next.config transpilePackages; src/state/{labStore,progressStore,events,selectors,testHook}.ts, src/timeline/{store,clock}.ts; src/labs/{types,registry,loaders}.ts, app routes (/, /labs/[labId], not-found pages), LabShell with dynamic ssr:false Canvas placeholder; src/design/tokens.css + primitives, src/lib/keys.ts, Toast/Help shells; vitest.config.ts, playwright.config.ts, e2e/00-webgl-canary + 01-home, docs/ and scripts/ skeletons
  - verification: pnpm typecheck, lint, test, build green; e2e canary: canvas renders, no console errors, window.__animationLab present under ?e2e=1; /labs/camera-movement and /labs/nope return the 404 UI; concept cards are aria-disabled non-links; timeline/clock and store unit tests pass (camera actions never touch time)
- **Phase 2 — Simulation engine + export math** — Pure, fully tested camera geometry, matched framing, measurements, classification, prompt phrase and JSON export with Blender/Unreal conversions.
  - deliverables: src/camera/{optics,framing,pose,measure,classify}.ts; src/export/{shot-export,prompt-phrase,validate}.ts, engines/{blender,unreal}.ts, shot-settings.schema.json; docs/shot-settings.md draft with the four worked examples
  - verification: optics table 18/24/35/50/85/135 within 0.01°; three PerspectiveCamera cross-check (filmGauge 36, aspect 16/9 → filmHeight 20.25); fixed-mode invariance (NDC ratio 2.000 at 2 m/4 m for all f); Match Z ∝ f within 0.5 %; clamps and Both rule; engine conversions match hand-computed examples (default, yaw-only, pitch-only, Ex2@85); export validates against the JSON Schema with Ajv; prompt strings match expectations
- **Phase 3 — Animated scene & characters** — Doorway set, two procedural puppets and the 6 s deterministic loop with stylised lighting, reviewed for appeal.
  - deliverables: src/scenes/doorway-set/*, src/characters/{bramble,pip,rig}/*, clips/doorway-wave-v1.ts; Deterministic clock integration (dt clamp, wrap), transport + scrubber controls
  - verification: Loop seamless: pose at t=0 equals t=6.0 within 1e-3; time determinism unit tests; Art review via 6 stage screenshots against the review protocol rows (silhouette, colour, readable depth); No Math.random without seed (lint rule or grep in CI)
- **Phase 4 — Renderers & interaction (the 30-second demo)** — Explorable stage with rig/frustum/rulers/drag dolly, crisp 16:9 monitor with guides and readouts, view swap, filmstrip, controls panel, animated Match travel.
  - deliverables: src/renderers/stage/*, src/renderers/monitor/*, LensLab layout, controls, filmstrip, idle tour; Capture hook for thumbnails, debugFrustum overlay, PerformanceMonitor stepping
  - verification: e2e 02 focal, 03 mode moves camera, 04 drag dolly, 05 pause-compare, 06 sync, 10 keys, 14 frustum agreement pass; Perf budget measured (≥ 55 fps M-series 1440×900; ≥ 30 fps iGPU dpr 1) and recorded; Phase-4 screenshot review with zero open FIX rows
- **Phase 5 — Lessons, education copy, save-shot, export UX** — Guided exercises tracking real state, lesson card, all copy live, perspective guide, saved-shots tray with persistence, export drawer and prompt line.
  - deliverables: src/education/* (engine, exercises, copy, components), progressStore persistence, tray + Save shot popover; ExportDrawer, Copy JSON / Copy prompt with toasts, clipboard fallback
  - verification: LessonEngine unit tests (hold timer, same-target rule, travel, saved objectives) pass; e2e 07 exercises (incl. reload persistence), 08 save/restore, 09 export clipboard + schema validation pass; Copy proofread against optics facts; docs/education-copy.md generated
- **Phase 6 — Polish, accessibility, verification, docs** — Reduced motion, axe pass, contrast, toasts/help polish, screenshots at three sizes, visual baselines, complete documentation and acceptance evidence.
  - deliverables: e2e 11 reduced-motion, 12 screenshots (27 images), 13 visual monitor baselines, 15 a11y; README, docs/architecture.md, docs/shot-settings.md (final), docs/limitations.md, docs/acceptance.md, docs/credits.md, docs/screenshots/REVIEW-6.md; Optional scripts/meshy-generate.ts (dry-run default, ledger) only if art review demands a hero set piece
  - verification: pnpm verify green end to end; All 15 acceptance items evidenced; REVIEW-6 zero FIX; limitations list complete; Home preview image produced from the screenshot run; no deploy performed (user triggers)

### Risks
- R3F/Next version pitfalls: react 19.3 must stay <19.4 for fiber 9.8.2; ssr:false only inside client components; cacheComponents keeps hidden routes mounted via Activity so stray window listeners leak. [Medium] → Exact pins; a single dynamic boundary (LabShell); all listeners in effects with cleanup; WebGL canary e2e runs first.
- WebGL context loss (tab sleep, GPU reset) blanks both views. [Medium] → webglcontextlost/restored handlers with a 'Stage paused — click to restore' overlay; state is in zustand so nothing is lost; e2e simulates with WEBGL_lose_context.
- Two renders per frame are too slow on integrated GPUs. [Medium] → PerformanceMonitor dpr/quality stepping, monitor FBO capped at 1280×720 (960×540 on decline), baked shadows after settle, documented budgets.
- Procedural characters look cheap and undermine the first 30 seconds. [High] → Art review loop with screenshots every phase; exaggerated nose/brow/ears designed for the perspective lesson; satin toon materials and rim light; Meshy fallback (ledger-guarded ≤ $10) for 1–2 static set pieces only.
- Matched framing edge cases: lens inside the character at 18 mm/tight framing, 'Both' infeasible at long lenses, target switch mid-travel. [High] → Clamps 0.45–14 m with explicit clamped state and caption copy; Both uses an 80 % fit rule with 'not feasible' messaging; idempotent solver on the settled pose; unit tests per clamp.
- Timeline drift between stage and monitor or after tab sleep. [Medium] → One clock advanced once per frame with dt clamped to 1/30, both renderers read the same ref; wrap tests; visibilitychange pauses accumulation.
- Scope creep into non-goals (DoF, lighting editor, camera paths). [Medium] → Non-goals in README; registry shows them as concepts; export schema reserves movement/cameraPath for v2 rather than implementing them.
- Licensing: Plane of Focus is all-rights-reserved. [Low] → Idea-level borrowing only; no copied CSS/markup/fonts (Geist retained); docs/credits.md lists inspirations and licences.
- Clipboard API blocked (HTTP dev host, Firefox/Safari permission model) breaks Copy JSON. [Medium] → Secure-context check with select-to-copy fallback; e2e on Chromium with granted clipboard permissions only.
- Headless Chromium lacks a usable WebGL context in CI. [Medium] → Canary spec; fallback launch args (--use-angle=swiftshader, --enable-unsafe-swiftshader, --ignore-gpu-blocklist); visual tolerances and platform-specific baselines.
- localStorage quota or corrupted progress data. [Low] → 12-shot cap with 320×180 JPEGs; persist version + migrate; try/catch around rehydrate with a reset toast.
- Key map collision: '?' and Shift+/ are the same chord on US layouts. [Certain] → Help on '?' (event.key), hide-UI on Shift+U; documented in help and limitations.
- Thumbnail capture returns a blank image because the drawing buffer was cleared. [Low] → Crop inside the post-render useFrame callback of the same rAF tick; e2e asserts non-blank JPEG.

### Open questions
- The brief described a bare directory, but create-next-app 16.4.3 already ran and committed. Confirm the user is fine keeping that CNA commit (the plan keeps it and adds no commits).
- Key collision: the brief assigns both '?' → help and 'Shift+/' → hide UI, which are the same chord on US keyboards. Plan uses Shift+U for hide-UI; confirm or pick another key.
- Which 'six phases' naming does the original spec use? The plan maps to Foundation / Engine / Scene / Renderers / Lessons+Export / Polish+Verification; rename if the spec's labels differ.
- Character placeholder names 'Bramble' (primary) and 'Pip' (secondary) are used throughout the copy via tokens; the character designer may rename them.
- Shot-size thresholds (p = 0.30/0.65/1.15/2.0/3.5/7 of full-body height) and the 'Both' 80 % fit rule are proposals; confirm they match the renderer/engine planners' measurement definition (segment endpoints projected with the real matrix).
- Thumbnails are cropped from the presented canvas in the same frame; this assumes the monitor is drawn into the main canvas (View/scissor or textured quad). If the renderer plan renders the monitor to a separate canvas, captureMonitor() must target that canvas instead.
- Tone mapping/colour-space on offscreen render targets: three applies output transforms only for the default framebuffer (to be confirmed in the Phase 4 renderer spike); this is why thumbnails avoid FBO reads.
- Should the optional @react-three/postprocessing (bloom for practical lamps) be included at all? It adds a full-screen pass per view and interacts with the monitor's crispness; default plan: no, revisit in Phase 6 if the art review asks.
- Visual baselines are darwin-only; decide whether CI should run visual tests at all (plan: skipped unless VISUAL=1).
- Vercel: FAL_KEY is not needed at runtime for the MVP (Meshy runs locally via a script). Confirm whether the user still wants it added to the Vercel project for future use.
