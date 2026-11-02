import type { MeshBasicMaterial, WebGLRenderTarget } from "three";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { LAYER_TECH } from "@/scene/layers";
import { tuple, type Shot } from "../engine/common";
import { e1Readout, orthoFor, perspShot, type Projection, type ViewPreset } from "../engine/projection";
import { E2, lensReadout, matchedShot, sweepFocal } from "../engine/lens";
import { FLAT_DEPTH, LAYERS, REF, cardPlacement, layerParallax, moveShot, refShot, type MoveKind, type MoveStyle } from "../engine/multiplane";
import { angularVelocity, drawingInfo, e4Focus, e4Shot, shutterOffsets, stepTime } from "../engine/timing";
import { demoFrame, faceExaggeration, pipHeightFrac } from "../engine/impossible";
import { LOOP_S, pingPong } from "../engine/common";
import type { ACState } from "../store";
import { AC_LAYER, actors, live } from "./live";
import { setLayerDeep, type Kit, type Rect } from "./kit";

export interface Plan {
  /** Work that must happen before any slot renders (captures). */
  pre?: () => void;
  render: () => void;
  observerLayers: number[];
  /** True when a pass re-posed the characters, so the frame must restore them before the stage. */
  reposes?: boolean;
}

const COLORS = { a: "#5fe3ff", b: "#ffb547", c: "#ff8fb1", d: "#8ef0c3", w: "#e9eef4" };
const reset = (t: number) => runUpdaters({ t, dt: 0, frameId: -1, playing: false, reducedMotion: false });

// ─── 1 · Perspective vs orthographic ──────────────────────────────────────────────────────────────

function e1(kit: Kit, s: ACState, t: number): Plan {
  const { e1: st } = s;
  const layers = st.guides ? [0, AC_LAYER.GUIDES] : [0];
  const cam = (name: string, view: ViewPreset, proj: Projection) =>
    proj === "perspective" ? kit.applyShot(kit.persp(name), perspShot(view), layers) : kit.applyOrtho(kit.ortho(name), perspShot(view), orthoFor(view), layers);
  const wipe = st.compare === "wipe" ? (s.mode === "watch" ? 0.5 + 0.38 * Math.sin((2 * Math.PI * t) / LOOP_S) : st.wipe) : null;
  live.e1 = { main: e1Readout(st.view, st.proj, t), persp: e1Readout(st.view, "perspective", t), ortho: e1Readout(st.view, "orthographic", t) };
  const p = cam("e1-p", st.view, "perspective");
  const o = cam("e1-o", st.view, "orthographic");
  live.viz.cams = [
    { camera: p, color: COLORS.a, length: 9 },
    { camera: o, color: COLORS.b, length: 9 },
  ];
  live.viz.path = [];
  live.viz.pathPhysical = [];
  live.viz.focusPlane = null;
  return {
    observerLayers: [0, LAYER_TECH, ...(st.guides ? [AC_LAYER.GUIDES] : [])],
    render() {
      const main = kit.rect("main");
      if (main) {
        if (wipe === null) {
          kit.render(st.proj === "perspective" ? p : o, main);
          live.camType.main = st.proj === "perspective" ? p.type : o.type;
        } else {
          kit.render(p, main, 0, wipe);
          kit.render(o, main, wipe, 1);
          live.camType.main = `${p.type}|${o.type}`;
        }
        live.camType.wipe = wipe === null ? "" : wipe.toFixed(3);
      }
      const row: [string, ViewPreset, Projection][] = [
        ["cmp-0", "street", "perspective"],
        ["cmp-1", "street", "orthographic"],
        ["cmp-2", "iso", "orthographic"],
      ];
      for (const [id, view, proj] of row) {
        const r = kit.rect(id);
        if (!r) continue;
        const c = cam(`e1-${id}`, view, proj);
        kit.render(c, r);
        live.camType[id] = c.type;
      }
    },
  };
}

// ─── 2 · 24 / 50 / 100 mm, matched framing ────────────────────────────────────────────────────────

function e2(kit: Kit, s: ACState, t: number): Plan {
  const sweep = s.e2.sweep || s.mode === "watch";
  const focal = sweep ? sweepFocal(t, LOOP_S) : s.e2.focal;
  const main = matchedShot(focal, t);
  const trio = E2.focals.map((f) => matchedShot(f, t));
  live.e2 = { main: lensReadout(main, t), trio: trio.map((x) => lensReadout(x, t)) };
  const mc = kit.applyShot(kit.persp("e2-main"), main);
  const tc = trio.map((x, i) => kit.applyShot(kit.persp(`e2-${i}`), x));
  live.viz.cams = [
    { camera: tc[0], color: COLORS.a, length: 2.2 },
    { camera: tc[1], color: COLORS.b, length: 3.4 },
    { camera: tc[2], color: COLORS.c, length: 5.6 },
    { camera: mc, color: COLORS.w, length: live.e2.main.distanceM + 0.3 },
  ];
  live.viz.path = trio.map((x) => tuple(x.position));
  live.viz.pathPhysical = [];
  live.viz.focusPlane = null;
  return {
    observerLayers: [0, LAYER_TECH],
    render() {
      const r = kit.rect("main");
      if (r) {
        kit.render(mc, r);
        live.camType.main = mc.type;
      }
      tc.forEach((c, i) => {
        const rr = kit.rect(`cmp-${i}`);
        if (rr) kit.render(c, rr);
      });
    },
  };
}

// ─── 3 · 2D vs 2.5D vs 3D ─────────────────────────────────────────────────────────────────────────

const CAPTURE_T = 3.5;
let captured = false;
export const invalidateCaptures = () => {
  captured = false;
};

function captureCam(kit: Kit, name: string, near = 0.1, far = 80, overscan: number = REF.overscan) {
  const c = kit.persp(name);
  kit.applyShot(c, refShot(), [0], overscan);
  c.near = near;
  c.far = far;
  c.updateProjectionMatrix();
  return c;
}

function layerSize(kit: Kit) {
  return kit.low ? { w: 1280, h: 720 } : { w: 2400, h: 1350 };
}

/** Paint the set slices once (Bram casts his shadow into the ground layer; Pip is left out). */
function captureStatic(kit: Kit, t: number) {
  const gl = kit.gl;
  const { w, h } = layerSize(kit);
  reset(CAPTURE_T);
  gl.shadowMap.needsUpdate = true;
  setLayerDeep(actors.bram, AC_LAYER.CAST);
  if (actors.pip) actors.pip.visible = false;
  const bg = kit.scene.background;
  const raw = kit.rt("raw", w, h);
  const slices: [string, number, number, boolean, number][] = [
    ...LAYERS.filter((l) => l.slice).map((l) => [l.id, l.slice![0], l.slice![1], !!l.opaque, l.overscan ?? REF.overscan] as [string, number, number, boolean, number]),
    ["flat", 0.3, 60, true, REF.overscan],
  ];
  for (const [id, near, far, opaque, overscan] of slices) {
    const cam = captureCam(kit, "cap", near, far, overscan);
    kit.scene.background = opaque ? bg : null;
    gl.setRenderTarget(raw);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(kit.scene, cam);
    kit.paintInto(raw, kit.rt(`layer-${id}`, w, h, { mip: true }));
  }
  kit.scene.background = bg;
  kit.restoreActors();
  gl.setClearColor(kit.clearColor, 1);
  reset(t);
  gl.shadowMap.needsUpdate = true;
  captured = true;
}

function bindCards(kit: Kit) {
  const tex = (id: string) => (kit.peekRt(id) as WebGLRenderTarget | null)?.texture ?? null;
  for (const l of LAYERS) {
    const m = actors.cards25.get(l.id);
    if (!m) continue;
    const mat = m.material as MeshBasicMaterial;
    const t = l.who ? tex(`cel-${l.who}`) : tex(`layer-${l.id}`);
    m.visible = !!t;
    if (mat.map !== t) {
      mat.map = t;
      mat.needsUpdate = true;
    }
  }
  const flat: [string, string][] = [
    ["flat", "layer-flat"],
    ["pip", "cel-pip"],
    ["bram", "cel-bram"],
  ];
  for (const [id, rt] of flat) {
    const m = actors.cards2d.get(id);
    if (!m) continue;
    const mat = m.material as MeshBasicMaterial;
    const t = tex(rt);
    m.visible = !!t;
    if (mat.map !== t) {
      mat.map = t;
      mat.needsUpdate = true;
    }
  }
}

function e3(kit: Kit, s: ACState, t: number): Plan {
  const { style, move } = s.e3;
  const u = pingPong(t);
  const shotOf = (k: MoveKind) => moveShot(k, u);
  const flatLayer = (st: MoveStyle) => (st === "2d" ? AC_LAYER.FLAT2D : AC_LAYER.FLAT25);
  const camFor = (name: string, st: MoveStyle) => kit.applyShot(kit.persp(name), shotOf(move), st === "3d" ? [0] : [flatLayer(st)]);
  const main = camFor("e3-main", style);
  live.e3 = { u, layers: layerParallax(style, move, u), captured };
  live.viz.cams = [{ camera: main, color: COLORS.a, length: style === "3d" ? 6 : 15 }];
  live.viz.path = Array.from({ length: 33 }, (_, i) => tuple(moveShot(move, i / 32).position));
  live.viz.pathPhysical = [];
  live.viz.focusPlane = null;
  const needsCels = style !== "3d" || s.mode === "experiment";
  return {
    observerLayers: style === "3d" ? [0, LAYER_TECH] : [flatLayer(style), AC_LAYER.OUTLINE, LAYER_TECH],
    pre() {
      if (!captured) captureStatic(kit, t);
      if (needsCels) {
        const { w, h } = layerSize(kit);
        const cam = captureCam(kit, "cel", 0.1, 80);
        kit.captureCel(kit.rt("cel-bram", w * 0.75, h * 0.75, { mip: true }), cam, "bram");
        kit.captureCel(kit.rt("cel-pip", w * 0.75, h * 0.75, { mip: true }), cam, "pip");
      }
      bindCards(kit);
    },
    render() {
      const r = kit.rect("main");
      if (r) {
        kit.render(main, r);
        live.camType.main = main.type;
      }
      (["2d", "2.5d", "3d"] as const).forEach((st, i) => {
        const rr = kit.rect(`cmp-${i}`);
        if (rr) kit.render(camFor(`e3-${i}`, st), rr);
      });
    },
  };
}

export const flatCards = () => ({
  layers: LAYERS.map((l) => ({ ...l, ...cardPlacement(l.depth, l.overscan) })),
  flat: cardPlacement(FLAT_DEPTH),
});

// ─── 4 · Photoreal vs stylized ────────────────────────────────────────────────────────────────────

function e4(kit: Kit, s: ACState, t: number): Plan {
  const st = s.e4;
  const camT = st.cameraOnTwos ? stepTime(t, 2) : t;
  const charT = stepTime(t, st.step);
  const av = angularVelocity(e4Shot, camT);
  const info = drawingInfo(t, st.step);
  const samples = st.motionBlur ? (kit.low ? 3 : 10) : 1;
  live.e4 = { camT, charT, frame: info.frame, drawing: info.drawing, held: info.held, degPerS: av.degPerS, focusM: e4Focus(t), samples };
  const preview = kit.applyShot(kit.persp("e4-viz"), e4Shot(t));
  live.viz.cams = [{ camera: preview, color: COLORS.a, length: 7 }];
  live.viz.path = [];
  live.viz.pathPhysical = [];
  live.viz.focusPlane = st.dof ? { camera: preview, distance: e4Focus(t) } : null;
  const speedAmt = Math.min(1, Math.max(0, (av.degPerS - 25) / 60));
  const photo = (r: Rect, key: string, x0 = 0, x1 = 1, lite = false) =>
    kit.styled(r, key, {
      t,
      x0,
      x1,
      shotAt: (tk) => e4Shot(tk),
      charTime: (tk) => tk,
      offsets: shutterOffsets(lite ? Math.min(samples, 5) : samples, 180),
      dof: st.dof ? { fStop: st.fStop, focusM: e4Focus(t) } : null,
      look: {},
    });
  const anime = (r: Rect, key: string, x0 = 0, x1 = 1) =>
    kit.styled(r, key, {
      t,
      x0,
      x1,
      shotAt: () => e4Shot(camT),
      charTime: () => charT,
      offsets: [0],
      dof: null,
      look: {
        cel: st.cel ? 1 : 0,
        outline: st.cel ? 1 : 0,
        speed: st.speedLines ? speedAmt : 0,
        speedDir: av.dir,
        seed: Math.floor(t * 24 / 2),
      },
    });
  return {
    observerLayers: [0, LAYER_TECH],
    reposes: true,
    render() {
      const r = kit.rect("main");
      if (r) {
        if (st.style === "photoreal") photo(r, "main");
        else if (st.style === "anime") anime(r, "main");
        else {
          photo(r, "main", 0, 0.5);
          anime(r, "main-b", 0.5, 1);
        }
        live.camType.main = "PerspectiveCamera";
      }
      const a = kit.rect("cmp-0");
      if (a) photo(a, "cmp-0", 0, 1, true);
      const b = kit.rect("cmp-1");
      if (b) anime(b, "cmp-1");
      reset(t);
    },
  };
}

// ─── 5 · Impossible camera ────────────────────────────────────────────────────────────────────────

function e5(kit: Kit, s: ACState, t: number): Plan {
  const st = s.e5;
  const f = demoFrame(st.demo, t, st.fisheye);
  const cheat = st.demo === "cheat";
  live.e5 = {
    frame: f,
    pipFrac: pipHeightFrac(f.shot, t, f.pipScale),
    pipFracPhysical: pipHeightFrac(f.physical, t, 1),
    faceWide: faceExaggeration(f.shot, t),
    faceTele: f.charShot ? faceExaggeration(f.charShot, t) : faceExaggeration(f.shot, t),
    nearM: 0.05,
  };
  const imp = kit.applyShot(kit.persp("e5-imp"), f.shot);
  const phy = kit.applyShot(kit.persp("e5-phy"), f.physical);
  const tele = f.charShot ? kit.applyShot(kit.persp("e5-tele"), f.charShot) : null;
  live.viz.cams = cheat && tele ? [{ camera: imp, color: COLORS.b, length: 1.3 }, { camera: tele, color: COLORS.c, length: 6.2 }] : [{ camera: imp, color: COLORS.c, length: 3 }, { camera: phy, color: COLORS.a, length: 3 }];
  const sample = (fn: (tt: number) => Shot) => Array.from({ length: 61 }, (_, i) => tuple(fn((i / 60) * LOOP_S).position));
  live.viz.path = cheat ? [] : sample((tt) => demoFrame(st.demo, tt).shot);
  live.viz.pathPhysical = cheat ? [] : sample((tt) => demoFrame(st.demo, tt).physical);
  live.viz.focusPlane = null;
  const scalePip = (k: number) => {
    const g = actors.pip;
    if (!g) return;
    const root = [0.72, 0, -4.7];
    g.scale.setScalar(k);
    g.position.set(root[0] * (1 - k), 0, root[2] * (1 - k));
    g.updateMatrixWorld(true);
  };
  const fast = st.demo === "whip" || st.demo === "wall";
  const offsets = fast ? shutterOffsets(kit.low ? 3 : 10, 180) : [0];

  const renderImpossible = (r: Rect, key: string) => {
    if (cheat && tele) {
      // Background through the wide lens (Bram only casts his shadow), then Bram alone through the tele lens.
      setLayerDeep(actors.bram, AC_LAYER.CAST);
      kit.render(imp, r);
      setLayerDeep(actors.bram, 0);
      kit.hide(actors.set, actors.pip);
      // A colour background forces a clear in three, so drop it for the overlay pass.
      const bg = kit.scene.background;
      kit.scene.background = null;
      kit.gl.autoClear = false;
      kit.toSlot(r);
      kit.gl.clearDepth();
      kit.gl.render(kit.scene, tele);
      kit.scene.background = bg;
      kit.restoreActors();
      return;
    }
    if (st.demo === "scale") scalePip(f.pipScale);
    if (st.demo === "push" || fast) {
      kit.styled(r, key, {
        t,
        shotAt: (tk) => demoFrame(st.demo, tk, st.fisheye).shot,
        charTime: (tk) => tk,
        offsets,
        dof: null,
        look: { fisheye: f.fisheye },
      });
    } else kit.render(imp, r);
    scalePip(1);
  };
  const renderPhysical = (r: Rect, key: string) => {
    if (fast) kit.styled(r, key, { t, shotAt: (tk) => demoFrame(st.demo, tk).physical, charTime: (tk) => tk, offsets, dof: null, look: {} });
    else kit.render(phy, r);
  };
  return {
    observerLayers: [0, LAYER_TECH],
    reposes: fast || st.demo === "push",
    render() {
      const r = kit.rect("main");
      if (r) {
        renderImpossible(r, "main");
        live.camType.main = "PerspectiveCamera";
      }
      const a = kit.rect("cmp-0");
      if (a) renderPhysical(a, "cmp-0");
      if (cheat && tele) {
        // Three monitors: one real lens each way, then the cheat that combines them.
        const b = kit.rect("cmp-1");
        if (b) kit.render(tele, b);
        const c = kit.rect("cmp-2");
        if (c) renderImpossible(c, "cmp-2");
      } else {
        const b = kit.rect("cmp-1");
        if (b) renderImpossible(b, "cmp-1");
      }
      reset(t);
      if (st.demo === "scale") scalePip(f.pipScale);
    },
  };
}

export function planFor(kit: Kit, s: ACState, t: number): Plan {
  switch (s.exp) {
    case 1:
      return e1(kit, s, t);
    case 2:
      return e2(kit, s, t);
    case 3:
      return e3(kit, s, t);
    case 4:
      return e4(kit, s, t);
    default:
      return e5(kit, s, t);
  }
}

/** Scale cheat leaves Pip scaled for the stage view; every other experiment puts him back. */
export function resetPipScale() {
  const g = actors.pip;
  if (!g || g.scale.x === 1) return;
  g.scale.setScalar(1);
  g.position.set(0, 0, 0);
  g.updateMatrixWorld(true);
}

