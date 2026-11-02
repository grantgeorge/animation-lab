"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, Vector3, type Material } from "three";
import { runUpdaters } from "@/renderer/runtime/frameBus";
import { AIM, HEADING, baseShot, hfovDeg, moveShot, moveU, project, tanHalf, viewMatrix, type Shot } from "../engine/camera";
import { HAZE_COLORS, hazeFactor, hazeParams } from "../engine/haze";
import { anchorShift, bandOf, cardDepths, layerRanges, relativeSpeed, squashDepth, type LayerRange } from "../engine/layers";
import { maskBounds, revealedArea, type DepthView } from "../engine/reveal";
import { STORIES, impliedHeight, frameFraction } from "../engine/scale";
import { PATH, PIP, TREE_HEIGHT_M, groundY, pathCenterX } from "../engine/world";
import { edClock, edStore, type EDState } from "../store";
import { L, actors, live, runAfterFrame, slots } from "./live";
import { METRIC, Pipeline } from "./pipeline";
import { U, patchHaze, setXray } from "./shaders";

/** Smallest squash kept so the renderer can still sort surfaces when "parallax" is at 0 %. */
export const MIN_SQUASH = 0.015;

const PIP_CENTRE = new Vector3(PIP.root[0], 0.55, PIP.root[2]);

interface Persist {
  captureKey: string;
  refKey: string;
  endKey: string;
  nowKey: string;
  maskKey: string;
  ref: DepthView | null;
  refBuf: Float32Array;
  nowBuf: Float32Array;
  revealMask: Uint8Array;
  ranges: LayerRange[];
  depths: number[];
}

const makePersist = (): Persist => ({
  captureKey: "",
  refKey: "",
  endKey: "",
  nowKey: "",
  maskKey: "",
  ref: null,
  refBuf: new Float32Array(METRIC.w * METRIC.h),
  nowBuf: new Float32Array(METRIC.w * METRIC.h),
  revealMask: new Uint8Array(METRIC.w * METRIC.h),
  ranges: [],
  depths: [],
});

const shotKey = (s: Shot) => `${s.position.x.toFixed(4)},${s.position.y.toFixed(4)},${s.position.z.toFixed(4)},${s.quaternion.x.toFixed(5)},${s.quaternion.y.toFixed(5)},${s.focalMm}`;

function visualKey(s: EDState, low: boolean) {
  const c = s.cues;
  return JSON.stringify([c.focalMm, c.haze, c.hazeColor, c.layers, c.scale, c.refs, c.story, c.occlusion, s.layerCount, s.cleanPlates, low]);
}
function geometryKey(s: EDState) {
  const c = s.cues;
  return JSON.stringify([c.focalMm, Math.max(c.parallax, MIN_SQUASH), c.layers, c.scale, c.refs, c.story]);
}

/** Clone and haze-patch the character's materials once (the GLTF cache keeps its own untouched). */
function patchPip() {
  actors.pip?.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || m.userData.edHaze) return;
    m.userData.edHaze = true;
    const mat = m.material as Material | Material[];
    if (Array.isArray(mat)) m.material = mat.map((x) => {
      const c = x.clone();
      patchHaze(c);
      return c;
    });
    else {
      const c = mat.clone();
      patchHaze(c);
      m.material = c;
    }
  });
}

/**
 * The lab's one positive-priority frame callback. Per frame: tick the clock, pose Pip, place the
 * camera on its move, update the shared cue uniforms, refresh captures and the frame-0 reference
 * depth when the scene changes, measure the revealed area, then render the picture (and the plan
 * view in Inspect) into their DOM slots.
 */
export function Orchestrator({ reducedMotion, low }: { reducedMotion: boolean; low: boolean }) {
  const pipe = useMemo(() => new Pipeline(), []);
  const scene = useThree((s) => s.scene);
  const persist = useRef<Persist | null>(null);

  useEffect(() => {
    scene.add(pipe.cards);
    return () => {
      scene.remove(pipe.cards);
      pipe.dispose();
    };
  }, [scene, pipe]);

  useFrame((state, delta) => {
    const { gl } = state;
    const t = edClock.tick();
    const s = edStore.getState();
    const c = s.cues;
    const P = (persist.current ??= makePersist());
    live.t = t;
    live.frameId++;
    pipe.begin(gl, state.scene, low);

    // Camera: frame 0 (reference) and now.
    const u = moveU(t);
    live.u = u;
    const c0 = baseShot(c.focalMm);
    const now = moveShot(c.focalMm, s.move, u, s.moveSize);
    const k = c.parallax >= 0.999 ? 1 : Math.max(c.parallax, MIN_SQUASH);
    const D = c0.position.distanceTo(AIM);

    // Shared cue uniforms.
    U.uSquashD.value = D;
    U.uRefView.value.copy(viewMatrix(c0));
    U.uRefViewInv.value.copy(U.uRefView.value).invert();
    U.uHazeAmount.value = c.haze;
    U.uHazeColor.value.set(HAZE_COLORS[c.hazeColor].hex);
    U.uTime.value = t;
    setXray(!c.occlusion);
    live.squash = { k, D };

    // Scene graph: foreground set rides with the base camera; scale references; Pip.
    const story = STORIES[c.story].k;
    if (actors.fg) {
      actors.fg.visible = c.layers;
      actors.fg.position.set(c0.position.x, groundY(c0.position.x, c0.position.z), c0.position.z);
      actors.fg.rotation.set(0, Math.atan2(-HEADING.x, -HEADING.z), 0);
    }
    for (const id of ["cabin", "fence", "deer"] as const) {
      const g = actors.refs[id];
      if (!g) continue;
      g.visible = c.scale && c.refs[id];
      g.scale.setScalar(story);
    }
    const placePip = (squash: number) => {
      const g = actors.pip;
      if (actors.pipDecals) actors.pipDecals.visible = c.scale && c.refs.pip && story === 1;
      if (!g) return;
      g.visible = c.scale && c.refs.pip;
      const p = new Vector3(PIP.root[0], groundY(PIP.root[0], PIP.root[2]), PIP.root[2]);
      const z = project(c0, p).depth;
      const ratio = squashDepth(z, D, squash) / z;
      g.position.copy(c0.position).addScaledVector(p.sub(c0.position), ratio);
      g.scale.setScalar(story * ratio);
    };
    placePip(k);
    patchPip();
    runUpdaters({ t, dt: Math.min(Math.max(delta, 0), 1 / 30), frameId: live.frameId, playing: edClock.isPlaying, reducedMotion });
    state.scene.updateMatrixWorld();

    // Frame-0 plates for 2D / 2.5D (painted once per scene state, from true depth).
    const ranges = layerRanges(s.layerCount);
    const vKey = visualKey(s, low);
    if (s.construct !== "3d" && vKey !== P.captureKey) {
      U.uSquashK.value = 1;
      placePip(1);
      state.scene.updateMatrixWorld();
      pipe.capture(c0, ranges, s.cleanPlates);
      const trueDepth = pipe.depthView(c0, new Float32Array(METRIC.w * METRIC.h));
      P.depths = cardDepths(ranges, trueDepth.depth);
      P.ranges = ranges;
      P.captureKey = vKey;
      live.captures++;
      placePip(k);
      state.scene.updateMatrixWorld();
    }
    U.uSquashK.value = k;
    if (P.ranges.length !== ranges.length) {
      P.ranges = ranges;
      P.depths = cardDepths(ranges, null);
    }
    const depthsNow = P.depths.map((d) => squashDepth(d, D, k));
    pipe.layoutCards(c0, D, P.ranges, depthsNow, s.cleanPlates, s.construct);

    // Revealed area: reproject the current depth into the move's first frame.
    const gKey = geometryKey(s);
    if (gKey !== P.refKey || !P.ref) {
      P.ref = pipe.depthView(c0, P.refBuf);
      P.refKey = gKey;
      P.nowKey = "";
      live.refs++;
    }
    const eKey = `${gKey}|${s.move}|${s.moveSize}`;
    if (eKey !== P.endKey) {
      const end = revealedArea(pipe.depthView(moveShot(c.focalMm, s.move, 1, s.moveSize), new Float32Array(METRIC.w * METRIC.h)), P.ref);
      live.revealEnd = { total: end.total, edge: end.edge, disoccluded: end.disoccluded };
      P.endKey = eKey;
    }
    const nKey = `${gKey}|${shotKey(now)}`;
    const stride = low && edClock.isPlaying ? 2 : 1;
    if (nKey !== P.nowKey && live.frameId % stride === 0) {
      const r = revealedArea(pipe.depthView(now, P.nowBuf), P.ref, P.revealMask);
      live.reveal = { total: r.total, edge: r.edge, disoccluded: r.disoccluded, bounds: maskBounds(r.mask, METRIC.w, METRIC.h) };
      if (s.overlay === "reveal") pipe.uploadReveal(r.mask);
      P.nowKey = nKey;
    }
    if (s.construct !== "3d") {
      const mKey = `${nKey}|${vKey}|${s.construct}|${k}`;
      if (mKey !== P.maskKey && live.frameId % stride === 0) {
        const m = pipe.constructionMask(now);
        live.construction = { content: m.content, hole: m.hole, void: m.void, bounds: maskBounds(m.mask, METRIC.w, METRIC.h), samples: m.samples };
        P.maskKey = mKey;
      }
    } else live.construction = null;

    // Readouts.
    const th = tanHalf(c.focalMm);
    const fwd = new Vector3(0, 0, -1).applyQuaternion(now.quaternion);
    const pipDepth = project(now, PIP_CENTRE).depth;
    live.cam = {
      x: now.position.x,
      y: now.position.y,
      z: now.position.z,
      heightM: now.position.y - groundY(now.position.x, now.position.z),
      distToPipM: now.position.distanceTo(PIP_CENTRE),
      focalMm: c.focalMm,
      hfovDeg: hfovDeg(c.focalMm),
      pitchDeg: (Math.asin(fwd.y) * 180) / Math.PI,
      frameW: 2 * pipDepth * th.x,
    };
    live.c0 = { x: c0.position.x, z: c0.position.z, yawDeg: (Math.atan2(-HEADING.x, -HEADING.z) * 180) / Math.PI };
    const plan = (sh: Shot, len: number): [number, number][] => {
      const f = new Vector3(0, 0, -1).applyQuaternion(sh.quaternion).setY(0).normalize();
      const r = new Vector3(-f.z, 0, f.x);
      const a = sh.position.clone().addScaledVector(f, len).addScaledVector(r, len * th.x);
      const b = sh.position.clone().addScaledVector(f, len).addScaledVector(r, -len * th.x);
      return [
        [sh.position.x, sh.position.z],
        [a.x, a.z],
        [b.x, b.z],
      ];
    };
    live.plan = {
      frustum: plan(now, pipDepth * 2.2),
      c0Frustum: plan(c0, D * 2.2),
      path: Array.from({ length: 25 }, (_, i) => {
        const p = moveShot(c.focalMm, s.move, i / 24, s.moveSize).position;
        return [p.x, p.z] as [number, number];
      }),
    };
    const flat = s.construct === "2d";
    live.layers = (s.construct === "2d" ? [{ index: 0, a: 0, b: Infinity }] : P.ranges).map((r, i) => {
      const depth = flat ? D : (P.depths[i] ?? D);
      const dn = flat ? D : squashDepth(depth, D, k);
      const sh = anchorShift(c0, now, dn);
      const back = flat ? D : squashDepth(P.depths[P.depths.length - 1] ?? D, D, k);
      return { index: r.index, a: r.a, b: r.b, depth, depthNow: dn, shiftX: sh.x, speed: relativeSpeed(dn, back), band: bandOf(depth) };
    });
    live.scale = { k: story, treeTrueM: TREE_HEIGHT_M, treeReadsM: impliedHeight(TREE_HEIGHT_M, story), pipFrac: frameFraction(PIP.heightM * story, pipDepth, c.focalMm) };
    const hp = hazeParams(c.haze);
    const eye = now.position.y;
    live.haze = { pip: hazeFactor(eye, 0.5, pipDepth, hp), mg: hazeFactor(eye, 4, 30, hp), bg: hazeFactor(eye, 6, 120, hp), ridge: hazeFactor(eye, 600, 2350, hp) };
    const toFrame = (p: Vector3): [number, number] => {
      const q = project(now, p);
      return [(q.x + 1) / 2, (1 - q.y) / 2];
    };
    // Probe windows for the tests: the vista through the trunks (hills, ridges, sky) and the foreground ferns.
    live.probes = { far: [0.42, 0.2, 0.58, 0.48], near: [0.05, 0.86, 0.45, 0.98] };
    const edgePts = (side: number) =>
      [2, -4, -12, -24, -40, -56].map((z) => toFrame(new Vector3(pathCenterX(z) + side * PATH.halfWidthM, groundY(0, z) + 0.02, z)));
    const vpDir = new Vector3(0, 0, -1).applyQuaternion(now.quaternion.clone().invert());
    live.path = { left: edgePts(-1), right: edgePts(1), vp: vpDir.z < 0 ? [((vpDir.x / -vpDir.z / th.x) + 1) / 2, (1 - vpDir.y / -vpDir.z / th.y) / 2] : null };

    // Render.
    gl.autoClear = true;
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, state.size.width, state.size.height);
    gl.setClearColor(0x0d0f12, 1);
    gl.clear();
    const main = pipe.rect(slots.get("main"));
    if (main) {
      pipe.renderMain(main, now, s.construct === "3d" ? [L.WORLD, L.FX, L.CANOPY] : [L.CARDS], {
        dof: c.dof,
        fStop: c.fStop,
        focusM: pipDepth,
        overlay: s.overlay === "reveal" ? 1 : s.overlay === "bands" ? 2 : 0,
        flat: s.construct !== "3d",
        t,
      });
    }
    gl.setViewport(0, 0, state.size.width, state.size.height);
    live.ready = live.frameId > 3 && !!P.ref;
    runAfterFrame();
  }, 1);
  return null;
}
