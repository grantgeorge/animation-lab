'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import {
  Box3, BufferAttribute, BufferGeometry, DoubleSide, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, Quaternion, Raycaster, SphereGeometry, Vector2, Vector3,
  RingGeometry, CircleGeometry, type Bone, type Material, type Object3D, type SkinnedMesh,
} from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { FrameOrchestrator } from '@/renderer/runtime/FrameOrchestrator';
import { BRAM_BONES, BRAM_URL, PIP_BONES, PIP_URL } from '@/scene/characters/Characters';
import type { BoneMapping } from '@/scene/characters/RiggedCharacter';
import { doorwayWave } from '@/scene/animation/performances/doorwayWave';
import { sampleClipSmoothed } from '@/scene/animation/smooth';
import type { PoseDelta } from '@/scene/animation/dsl';
import { doorwayScene, riggingConfig as config } from '@/labs/lens-and-framing/config';
import { bendAngle, deltaToLocal, heat, influence, localToDelta, makeRest, perpendicular, poleAngle, poleDirection, rigidify, solveHinge, swing, type Correction, type Delta, type RestFrame } from './rigMath';
import { JOINTS, fkDeltas, joint, type Axis, type FkPose, type JointId } from './joints';
import type { Measure } from './exercises';

export type CharacterId = 'bram' | 'pip';
export type DisplayId = 'mesh' | 'xray' | 'weights' | 'skeleton';
export type ViewId = keyof typeof config.views;
export type Vec3 = [number, number, number];

export interface RigStageProps {
  character: CharacterId;
  display: DisplayId;
  view: ViewId;
  mode: 'pose' | 'wave';
  correction: Correction;
  weights: 'smooth' | 'rigid';
  fk: FkPose;
  hipDrop: number;
  arm: 'fk' | 'ik';
  legs: 'fk' | 'ik';
  target: Vec3 | null;
  pole: number;
  selected: JointId;
  showMark: boolean;
  playing: boolean;
  /** Paused position in the wave loop, 0..1. */
  waveU: number;
  onMeasure: (m: Measure) => void;
  onSelect: (id: JointId) => void;
  onTarget: (v: Vec3) => void;
  /** Filled by the stage every frame: the latest IK result as FK deltas, for matching. */
  shared: Shared;
}
export type Sliders = Partial<Record<Axis, number>>;
export interface Shared {
  ik: Map<string, Required<Delta>>; camera: PerspectiveCamera | null; stats: { vertices: number; joints: number; influences: number } | null; waveU: number;
  /** World positions a drag needs: the joint's pivot and the end of the bone it swings. */
  ends: ((id: JointId) => { pivot: Vector3; end: Vector3 } | null) | null;
  /** FK drag: slider values that swing the joint's bone toward a world point. */
  aim: ((id: JointId, at: Vector3, current: Sliders) => Sliders | null) | null;
}
export const makeShared = (): Shared => ({ ik: new Map(), camera: null, stats: null, waveU: 0, ends: null, aim: null });

export const HEIGHT: Record<CharacterId, number> = { bram: doorwayScene.characters.primary.landmarks.capTop, pip: doorwayScene.characters.secondary.landmarks.capTop };
const BONES: Record<CharacterId, Record<string, BoneMapping>> = { bram: BRAM_BONES, pip: PIP_BONES };
const URLS: Record<CharacterId, string> = { bram: BRAM_URL, pip: PIP_URL };
const CLIP = { bram: doorwayWave.clips.find((c) => c.character === 'bram')!, pip: doorwayWave.clips.find((c) => c.character === 'pip')! };
const OUTWARD_L = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);

/* ---------- rig construction ---------- */

interface Driven { bone: Bone; rest: RestFrame }
interface Rig {
  model: Group;
  meshes: { mesh: SkinnedMesh; smooth: BufferGeometry; rigid: BufferGeometry; color: BufferAttribute; base: Material; xray: Material; paint: Material }[];
  bones: Map<string, Bone>;
  bind: Map<Bone, { q: Quaternion; p: Vector3 }>;
  driven: Map<string, Driven>;
  boneIndex: Map<string, number>;
  segments: { parent: Bone; child: Bone }[];
  rest: { shoulder: Vector3; upperDir: Vector3; elbowBend: number; feet: { pos: Vector3; toe: Vector3; q: Quaternion }[]; hips: Vector3; armLength: number; legLength: number; mark: Vector3 };
  height: number;
}

function buildRig(scene: Group, character: CharacterId): Rig {
  const height = HEIGHT[character];
  const model = cloneSkinned(scene) as Group;
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const s = height / Math.max(1e-6, box.max.y - box.min.y);
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  model.updateMatrixWorld(true);

  const meshes: Rig['meshes'] = [];
  let boneIndex = new Map<string, number>();
  model.traverse((o: Object3D) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    // Never touch the cached GLTF: geometry and materials are per-instance copies.
    const smooth = mesh.geometry.clone();
    const rigid = smooth.clone();
    rigid.setAttribute('skinWeight', new BufferAttribute(rigidify(smooth.attributes.skinWeight.array), 4));
    const color = new BufferAttribute(new Float32Array(smooth.attributes.position.count * 3), 3);
    smooth.setAttribute('color', color); rigid.setAttribute('color', color);
    const src = mesh.material as MeshStandardMaterial;
    const base = src.clone();
    base.roughness = Math.max(src.roughness ?? 0.7, 0.62); base.metalness = 0; base.envMapIntensity = 0.6;
    const xray = base.clone();
    xray.transparent = true; xray.opacity = 0.3; xray.depthWrite = false;
    const paint = new MeshLambertMaterial({ vertexColors: true });
    mesh.geometry = smooth; mesh.material = base;
    meshes.push({ mesh, smooth, rigid, color, base, xray, paint });
    boneIndex = new Map(mesh.skeleton.bones.map((b, i) => [b.name, i]));
  });

  const bones = new Map<string, Bone>();
  model.traverse((o) => { if ((o as Bone).isBone) bones.set(o.name, o as Bone); });
  const bind = new Map<Bone, { q: Quaternion; p: Vector3 }>();
  for (const b of bones.values()) bind.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
  const driven = new Map<string, Driven>();
  for (const [part, m] of Object.entries(BONES[character])) {
    const bone = bones.get(m.bone);
    if (!bone?.parent) continue;
    driven.set(part, { bone, rest: makeRest(bone.parent.getWorldQuaternion(new Quaternion()), bone.quaternion, m) });
  }
  const segments: Rig['segments'] = [];
  for (const b of bones.values()) if ((b.parent as Bone)?.isBone && b.name !== 'headfront') segments.push({ parent: b.parent as Bone, child: b });

  const rig: Rig = { model, meshes, bones, bind, driven, boneIndex, segments, height, rest: null! };
  // The shipped rest pose (zero deltas) is the reference for every measurement.
  applyPose(rig, new Map(), 'shipped');
  const w = (n: string) => bones.get(n)!.getWorldPosition(new Vector3());
  const shoulder = w('LeftArm'), elbow = w('LeftForeArm'), wrist = w('LeftHand');
  const armLength = shoulder.distanceTo(elbow) + elbow.distanceTo(wrist);
  const legLength = w('LeftUpLeg').distanceTo(w('LeftLeg')) + w('LeftLeg').distanceTo(w('LeftFoot'));
  const [mx, my, mz] = config.mark;
  rig.rest = {
    shoulder,
    upperDir: elbow.clone().sub(shoulder).normalize(),
    elbowBend: bendAngle(shoulder, elbow, wrist),
    feet: (['Left', 'Right'] as const).map((side) => ({ pos: w(`${side}Foot`), toe: w(`${side}ToeBase`), q: bones.get(`${side}Foot`)!.getWorldQuaternion(new Quaternion()) })),
    hips: w('Hips'),
    armLength,
    legLength,
    mark: shoulder.clone().add(new Vector3(mx, my, mz).multiplyScalar(armLength)),
  };
  return rig;
}

function applyPose(rig: Rig, deltas: ReadonlyMap<string, Delta>, correction: Correction) {
  for (const [b, r] of rig.bind) { b.quaternion.copy(r.q); b.position.copy(r.p); }
  for (const [part, d] of rig.driven) deltaToLocal(d.rest, deltas.get(part), correction, d.bone.quaternion);
  rig.model.updateMatrixWorld(true);
}

const tq = new Quaternion(), tq2 = new Quaternion(), tv = new Vector3(), tv2 = new Vector3();
const wp = (b: Bone, out = new Vector3()) => b.getWorldPosition(out);

/** Set a bone's world rotation, keeping its parent. */
function setWorldQ(b: Bone, q: Quaternion) {
  b.parent!.getWorldQuaternion(tq2);
  b.quaternion.copy(tq2.invert().multiply(q));
  b.updateMatrixWorld(true);
}

/**
 * IK on the rig's own joints: bend the hinge (elbow, knee) until the chain is as long as the distance
 * to the target, swing the root joint (shoulder, hip) to aim it, then twist it about the aim line so the
 * hinge points along the pole. The end joint keeps a world orientation. Every rotation written here is
 * one an FK slider can reproduce, which is what makes FK/IK matching exact.
 */
function hingeIK(rig: Rig, upperPart: string, lowerPart: string, endName: string, target: Vector3, pole: Vector3, endQ: Quaternion, bendSign: 1 | -1, base: Delta | undefined) {
  const upper = rig.driven.get(upperPart)!, lower = rig.driven.get(lowerPart)!, end = rig.bones.get(endName)!;
  const root = wp(upper.bone, new Vector3());
  const distanceAt = (deg: number) => {
    deltaToLocal(lower.rest, { ...base, rx: bendSign * deg }, 'shipped', lower.bone.quaternion);
    lower.bone.updateMatrixWorld(true);
    return root.distanceTo(wp(end, tv));
  };
  const sol = solveHinge(distanceAt, root.distanceTo(target));
  distanceAt(sol.deg);
  setWorldQ(upper.bone, swing(upper.bone.getWorldQuaternion(tq), wp(end, tv).sub(root), target.clone().sub(root)));
  const u = target.clone().sub(root).normalize();
  const e = perpendicular(wp(lower.bone, new Vector3()).sub(root), u), want = perpendicular(pole, u);
  const turn = Math.atan2(u.dot(new Vector3().crossVectors(e, want)), e.dot(want));
  setWorldQ(upper.bone, new Quaternion().setFromAxisAngle(u, turn).multiply(upper.bone.getWorldQuaternion(tq)));
  setWorldQ(end, endQ);
  return sol;
}

/* ---------- helpers drawn in the canvas ---------- */

function boneGeometry() {
  // A classic octahedral bone: base at the joint, widest a fifth of the way along, tip at the child.
  const r = 0.5, y = 0.18;
  const p = [0, 0, 0, r, y, 0, 0, y, r, -r, y, 0, 0, y, -r, 0, 1, 0];
  const idx = [0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function overlayMat(color: string, opacity: number) {
  return new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
}

class Helpers {
  group = new Group();
  bones: { mesh: Mesh; edges: LineSegments }[] = [];
  joints: Mesh[] = [];
  ghost: Mesh[] = [];
  target: Mesh; targetRing: Mesh; pole: Mesh; poleLine: LineSegments; reachLine: LineSegments; mark: Mesh; markHalo: Mesh; sinks: Mesh[] = [];
  private geo = boneGeometry();
  private edgesGeo = new EdgesGeometry(this.geo);
  private ball = new SphereGeometry(1, 16, 12);
  matBone = overlayMat('#d9e2e8', 0.5);
  matBoneSel = overlayMat('#e2c48f', 0.85);
  matEdge = new LineBasicMaterial({ color: '#f4f7f9', transparent: true, opacity: 0.9, depthTest: false });
  matEdgeSel = new LineBasicMaterial({ color: '#fff1d6', transparent: true, opacity: 1, depthTest: false });
  matJoint = overlayMat('#f4f7f9', 0.95);
  matGhost = overlayMat('#8fd4a8', 0.5);
  matGhostEdge = new LineBasicMaterial({ color: '#c4ffd6', transparent: true, opacity: 1, depthTest: false });
  constructor(segments: number) {
    for (let i = 0; i < segments; i++) {
      const mesh = new Mesh(this.geo, this.matBone);
      const edges = new LineSegments(this.edgesGeo, this.matEdge);
      mesh.add(edges);
      mesh.renderOrder = edges.renderOrder = 10;
      this.group.add(mesh);
      this.bones.push({ mesh, edges });
      const j = new Mesh(this.ball, this.matJoint);
      j.renderOrder = 11;
      this.group.add(j);
      this.joints.push(j);
    }
    for (let i = 0; i < 6; i++) { const g = new Mesh(this.geo, this.matGhost); const e = new LineSegments(this.edgesGeo, this.matGhostEdge); g.add(e); g.renderOrder = e.renderOrder = 13; this.group.add(g); this.ghost.push(g); }
    this.target = new Mesh(this.ball, overlayMat('#e2c48f', 0.95)); this.target.renderOrder = 12;
    this.targetRing = new Mesh(new RingGeometry(1.5, 1.9, 40), overlayMat('#e2c48f', 0.8)); this.targetRing.renderOrder = 12;
    this.pole = new Mesh(new SphereGeometry(1, 4, 2), overlayMat('#7fc4e8', 0.95)); this.pole.renderOrder = 12;
    const line = (color: string) => { const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(6), 3)); const l = new LineSegments(g, new LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false })); l.renderOrder = 12; l.frustumCulled = false; return l; };
    this.poleLine = line('#7fc4e8'); this.reachLine = line('#ef8a6a');
    this.mark = new Mesh(this.ball, new MeshBasicMaterial({ color: '#8fd4a8', transparent: true, opacity: 0.9, depthTest: false })); this.mark.renderOrder = 8;
    this.markHalo = new Mesh(new RingGeometry(1.3, 2.2, 40), new MeshBasicMaterial({ color: '#8fd4a8', transparent: true, opacity: 0.35, depthTest: false, side: DoubleSide })); this.markHalo.renderOrder = 8;
    for (let i = 0; i < 2; i++) { const s = new Mesh(new CircleGeometry(1, 32), new MeshBasicMaterial({ color: '#ef5a3c', transparent: true, opacity: 0.55, depthWrite: false })); s.rotation.x = -Math.PI / 2; s.renderOrder = 2; this.group.add(s); this.sinks.push(s); }
    this.group.add(this.target, this.targetRing, this.pole, this.poleLine, this.reachLine, this.mark, this.markHalo);
  }
  placeSegment(m: Mesh, a: Vector3, b: Vector3, width: number) {
    const dir = tv.copy(b).sub(a);
    const len = dir.length();
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(UP, dir.divideScalar(Math.max(len, 1e-6)));
    m.scale.set(width, len, width);
  }
  setLine(l: LineSegments, a: Vector3, b: Vector3) {
    const p = l.geometry.attributes.position as BufferAttribute;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
  }
  dispose() {
    this.group.traverse((o) => { const m = o as Mesh; if (m.geometry && m.geometry !== this.geo && m.geometry !== this.ball && m.geometry !== this.edgesGeo) m.geometry.dispose(); const mat = m.material as Material | undefined; mat?.dispose?.(); });
    this.geo.dispose(); this.edgesGeo.dispose(); this.ball.dispose();
  }
}

/* ---------- FK drag: point a bone where the pointer is ---------- */

/** The clip part each joint rotates (left side; right mirrors) and the point at the far end of its bone. */
const SWING: Record<JointId, { part: string; end: string }> = {
  spine: { part: 'torso', end: 'neck' },
  head: { part: 'head', end: 'head_end' },
  shoulder: { part: 'upperArmL', end: 'LeftForeArm' },
  elbow: { part: 'forearmL', end: 'LeftHand' },
  wrist: { part: 'handL', end: '' }, // no finger bones: a point along the hand
  hips: { part: 'thighL', end: 'LeftLeg' },
  knees: { part: 'shinL', end: 'LeftFoot' },
};
/** Twist and turn spin a bone about its own length: they never move its end, so dragging leaves them alone. */
const AIMED = (name: string) => name !== 'Twist' && name !== 'Turn';
const tEnd = new Vector3();

function boneEnd(rig: Rig, id: JointId, out: Vector3): Vector3 {
  const sw = SWING[id], bone = rig.driven.get(sw.part)!.bone;
  if (sw.end) return rig.bones.get(sw.end)!.getWorldPosition(out);
  return bone.localToWorld(out.set(0, bone.position.length() * 0.45, 0));
}

export function jointEnds(rig: Rig, id: JointId) {
  const d = rig.driven.get(SWING[id].part);
  if (!d) return null;
  return { pivot: d.bone.getWorldPosition(new Vector3()), end: boneEnd(rig, id, new Vector3()) };
}

/**
 * Slider values that swing a joint's bone toward a world point, within the joint's limits. A small
 * coordinate descent over the joint's own axes, so hinges stay hinges: the elbow only bends.
 */
export function aimJoint(rig: Rig, id: JointId, at: Vector3, current: Sliders): Sliders | null {
  const j = joint(id), d = rig.driven.get(SWING[id].part);
  if (!d) return null;
  const bone = d.bone, saved = bone.quaternion.clone();
  rig.model.updateMatrixWorld(true);
  const pivot = bone.getWorldPosition(new Vector3());
  const len = boneEnd(rig, id, tEnd).distanceTo(pivot);
  const dir = at.clone().sub(pivot);
  if (dir.lengthSq() < 1e-8 || len < 1e-6) return null;
  const goal = pivot.addScaledVector(dir.normalize(), len);
  const axes = j.axes.filter((a) => AIMED(a.name));
  const v: Sliders = { ...current };
  const delta: Delta = {};
  const cost = () => {
    for (const a of j.axes) delta[a.k] = (v[a.k] ?? 0) * a.sign;
    deltaToLocal(d.rest, delta, 'shipped', bone.quaternion);
    bone.updateMatrixWorld(true);
    return boneEnd(rig, id, tEnd).distanceToSquared(goal);
  };
  let best = cost();
  for (const step of [32, 16, 8, 4, 2, 1, 0.5]) {
    for (let pass = 0, improved = true; improved && pass < 6; pass++) {
      improved = false;
      for (const a of axes) {
        const was = v[a.k] ?? 0;
        for (const s of [step, -step]) {
          v[a.k] = Math.min(a.max, Math.max(a.min, was + s));
          const c = cost();
          if (c < best - 1e-10) { best = c; improved = true; break; }
          v[a.k] = was;
        }
      }
    }
  }
  bone.quaternion.copy(saved);
  bone.updateMatrixWorld(true);
  const out: Sliders = {};
  for (const a of axes) out[a.k] = Math.round(v[a.k] ?? 0);
  return out;
}

/* ---------- the world ---------- */

export type HandleMap = Map<string, HTMLElement>;

type FrameProps = RigStageProps & { handles: HandleMap };

/** Per-frame work lives in a class: it mutates the rig and helpers, which React state must never be. */
class StageView {
  camera: PerspectiveCamera;
  st = { t: 0, look: new Vector3(), pos: new Vector3(), elbow: new Vector3(0.45, 1.35, 0), init: false, paintKey: '', measureKey: '', display: '' };
  pose: PoseDelta = new Map();
  ghostPts = Array.from({ length: 8 }, () => new Vector3());
  constructor() { this.camera = new PerspectiveCamera(30, 16 / 9, 0.05, 60); this.camera.filmGauge = 36; this.camera.setFocalLength(config.focal); }
  publish(shared: Shared, rig: Rig) {
    shared.camera = this.camera;
    shared.aim = (id, at, current) => aimJoint(rig, id, at, current);
    shared.ends = (id) => jointEnds(rig, id);
    const m = rig.meshes[0];
    shared.stats = m ? { vertices: m.smooth.attributes.position.count, joints: rig.boneIndex.size, influences: m.smooth.attributes.skinWeight.itemSize } : null;
    this.st.paintKey = ''; this.st.measureKey = ''; this.st.display = '';
  }
  frame(p: FrameProps, rig: Rig, helpers: Helpers, state: RootState, delta: number) {
    const s = this.st, camera = this.camera, pose = this.pose, ghostPts = this.ghostPts, character = p.character, k = rig.height / HEIGHT.bram;
    const { gl, scene, size } = state;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Camera: ease between the fixed views (scaled to the character's height).
    const v = config.views[p.view];
    const wantPos = tv.set(v.pos[0] * k, v.pos[1] * k, v.pos[2] * k);
    const wantLook = tv2.set(v.target[0] * k, v.target[1] * k, v.target[2] * k);
    if (p.view === 'arm') { wantPos.add(s.elbow); wantLook.add(s.elbow); }
    const ease = !s.init || reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    s.pos.lerp(wantPos, ease); s.look.lerp(wantLook, ease); s.init = true;
    camera.position.copy(s.pos); camera.lookAt(s.look);
    camera.aspect = size.width / Math.max(1, size.height); camera.updateProjectionMatrix();

    // Display: materials, geometry and visibility.
    const dkey = `${p.display}:${p.weights}`;
    if (s.display !== dkey) {
      for (const m of rig.meshes) {
        m.mesh.geometry = p.weights === 'rigid' ? m.rigid : m.smooth;
        m.mesh.material = p.display === 'xray' ? m.xray : p.display === 'weights' ? m.paint : m.base;
        m.mesh.visible = p.display !== 'skeleton';
        m.mesh.castShadow = p.display === 'mesh' || p.display === 'weights';
      }
      s.display = dkey;
    }
    const sel = joint(p.selected);
    const pkey = `${p.selected}:${p.weights}:${rig.model.uuid}`;
    if (p.display === 'weights' && s.paintKey !== pkey) {
      const set = new Set(sel.bones.map((b) => rig.boneIndex.get(b)!).filter((i) => i !== undefined));
      const c: [number, number, number] = [0, 0, 0];
      for (const m of rig.meshes) {
        const geo = p.weights === 'rigid' ? m.rigid : m.smooth;
        const w = influence(geo.attributes.skinIndex.array, geo.attributes.skinWeight.array, set);
        const arr = m.color.array as Float32Array;
        for (let i = 0; i < w.length; i++) { heat(w[i], c); arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
        m.color.needsUpdate = true;
      }
      s.paintKey = pkey;
    }

    // Pose.
    const bone = (n: string) => rig.bones.get(n)!;
    let ghost = false;
    if (p.mode === 'wave') {
      const [t0, t1] = config.wave[character];
      if (p.playing) s.t += Math.min(delta, 0.1); else s.t = t0 + p.waveU * (t1 - t0);
      if (s.t > t1 || s.t < t0) s.t = t0;
      p.shared.waveU = (s.t - t0) / (t1 - t0);
      const scrub = p.handles.get('scrub') as HTMLInputElement | undefined;
      if (scrub && p.playing) scrub.value = String(p.shared.waveU);
      sampleClipSmoothed(CLIP[character], s.t, doorwayWave.durationS, pose);
      if (p.correction !== 'shipped') {
        applyPose(rig, pose, 'shipped');
        ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'].forEach((n, i) => wp(bone(n), ghostPts[i]));
        ghost = true;
      }
      applyPose(rig, pose, p.correction);
    } else {
      applyPose(rig, fkDeltas(p.fk), 'shipped');
      const drop = Math.max(0, p.hipDrop);
      if (drop > 0) {
        const hips = bone('Hips');
        const w = wp(hips, new Vector3()).add(tv.set(0, -drop, 0));
        hips.position.copy(hips.parent!.worldToLocal(w));
        rig.model.updateMatrixWorld(true);
      }
      if (p.legs === 'ik') {
        const fkPose = fkDeltas(p.fk);
        (['Left', 'Right'] as const).forEach((side, i) => {
          const lr = side[0];
          const pole = new Vector3(i === 0 ? 0.12 : -0.12, 0, 1);
          hingeIK(rig, `thigh${lr}`, `shin${lr}`, `${side}Foot`, rig.rest.feet[i].pos, pole, rig.rest.feet[i].q, 1, fkPose.get(`shin${lr}`));
        });
        for (const part of ['thighL', 'shinL'] as const) { const d = rig.driven.get(part)!; p.shared.ik.set(part, localToDelta(d.rest, d.bone.quaternion, 'shipped')); }
      }
    }
    const shoulder = wp(bone('LeftArm'), new Vector3());
    let reach = 0, reached = true;
    if (p.mode === 'pose' && p.arm === 'ik' && p.target) {
      const target = new Vector3(...p.target);
      const handQ = bone('LeftHand').getWorldQuaternion(new Quaternion());
      const sol = hingeIK(rig, 'upperArmL', 'forearmL', 'LeftHand', target, poleDirection(shoulder, target, p.pole, OUTWARD_L), handQ, -1, fkDeltas(p.fk).get('forearmL'));
      reach = sol.reach; reached = sol.reached;
      for (const part of ['upperArmL', 'forearmL', 'handL'] as const) { const d = rig.driven.get(part)!; p.shared.ik.set(part, localToDelta(d.rest, d.bone.quaternion, 'shipped')); }
    }
    rig.model.updateMatrixWorld(true);

    // Measure.
    const elbow = wp(bone('LeftForeArm'), new Vector3()), wrist = wp(bone('LeftHand'), new Vector3());
    s.elbow.copy(elbow);
    let sink = 0, slide = 0;
    (['Left', 'Right'] as const).forEach((side, i) => {
      const f = wp(bone(`${side}Foot`), new Vector3()), toe = wp(bone(`${side}ToeBase`), tv2);
      const r = rig.rest.feet[i];
      sink = Math.max(sink, r.pos.y - f.y, r.toe.y - toe.y);
      slide = Math.max(slide, Math.hypot(f.x - r.pos.x, f.z - r.pos.z));
      const disc = helpers.sinks[i];
      const deep = r.pos.y - f.y;
      disc.visible = p.mode === 'pose' && deep > 0.015;
      disc.position.set(f.x, 0.004, f.z + 0.03 * k);
      disc.scale.setScalar(0.11 * k);
    });
    const m: Measure = {
      markDist: wrist.distanceTo(rig.rest.mark),
      reach, reached,
      shoulderDeg: Math.acos(Math.min(1, Math.max(-1, elbow.clone().sub(shoulder).normalize().dot(rig.rest.upperDir)))) * 180 / Math.PI,
      elbowDeg: bendAngle(shoulder, elbow, wrist) - rig.rest.elbowBend,
      poleDeg: poleAngle(shoulder, elbow, wrist, OUTWARD_L),
      hipDrop: p.mode === 'pose' ? Math.max(0, p.hipDrop) : 0,
      footSink: Math.max(0, sink), footSlide: slide,
      legLength: rig.rest.legLength, armLength: rig.rest.armLength, arm: p.arm,
      wrist: [wrist.x, wrist.y, wrist.z], mark: [rig.rest.mark.x, rig.rest.mark.y, rig.rest.mark.z],
    };
    const mkey = [m.markDist * 1000, m.reach * 200, m.shoulderDeg * 2, m.elbowDeg * 2, m.poleDeg * 2, m.hipDrop * 1000, m.footSink * 1000, m.footSlide * 1000, m.legLength * 100].map(Math.round).join(',') + (m.reached ? 'r' : '') + m.arm + rig.model.uuid;
    if (mkey !== s.measureKey) { s.measureKey = mkey; p.onMeasure(m); }

    // Skeleton overlay.
    const showBones = p.display !== 'mesh';
    const width = 0.05 * k;
    rig.segments.forEach((seg, i) => {
      const { mesh, edges } = helpers.bones[i];
      const a = wp(seg.parent, new Vector3()), b = wp(seg.child, tv2.clone());
      const len = a.distanceTo(b);
      helpers.placeSegment(mesh, a, b, Math.min(width, len * 0.32));
      const on = sel.bones.includes(seg.parent.name);
      mesh.material = on ? helpers.matBoneSel : helpers.matBone;
      edges.material = on ? helpers.matEdgeSel : helpers.matEdge;
      (helpers.matBone as MeshBasicMaterial).opacity = p.display === 'skeleton' ? 0.75 : p.display === 'weights' ? 0.25 : 0.45;
      mesh.visible = showBones;
      const j = helpers.joints[i];
      j.position.copy(b); j.scale.setScalar(0.011 * k); j.visible = showBones;
    });
    const g = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]];
    helpers.ghost.forEach((gm, i) => { gm.visible = ghost; if (ghost) helpers.placeSegment(gm, ghostPts[g[i][0]], ghostPts[g[i][1]], 0.05 * k); });

    // IK target, pole, mark.
    const ik = p.mode === 'pose' && p.arm === 'ik' && p.target;
    helpers.target.visible = helpers.targetRing.visible = helpers.pole.visible = helpers.poleLine.visible = !!ik;
    helpers.reachLine.visible = !!ik && !reached;
    if (ik) {
      const t = new Vector3(...p.target!);
      helpers.target.position.copy(t); helpers.target.scale.setScalar(0.016 * k);
      helpers.targetRing.position.copy(t); helpers.targetRing.scale.setScalar(0.022 * k); helpers.targetRing.quaternion.copy(camera.quaternion);
      const poleTip = elbow.clone().addScaledVector(poleDirection(shoulder, t, p.pole, OUTWARD_L), 0.32 * rig.rest.armLength);
      helpers.pole.position.copy(poleTip); helpers.pole.scale.setScalar(0.022 * k);
      helpers.setLine(helpers.poleLine, elbow, poleTip);
      if (!reached) helpers.setLine(helpers.reachLine, wrist, t);
    }
    const markOn = p.mode === 'pose' && p.showMark;
    helpers.mark.visible = helpers.markHalo.visible = markOn;
    if (markOn) {
      helpers.mark.position.copy(rig.rest.mark); helpers.mark.scale.setScalar(0.022 * k);
      helpers.markHalo.position.copy(rig.rest.mark); helpers.markHalo.scale.setScalar(0.022 * k); helpers.markHalo.quaternion.copy(camera.quaternion);
      (helpers.mark.material as MeshBasicMaterial).color.set(m.markDist <= 0.04 ? '#c8f5d6' : '#8fd4a8');
    }

    // DOM handles follow their 3D points.
    const place = (key: string, pt: Vector3 | null) => {
      const el = p.handles.get(key);
      if (!el) return;
      if (!pt) { el.style.visibility = 'hidden'; return; }
      const n = tv.copy(pt).project(camera);
      const hidden = n.z > 1 || Math.abs(n.x) > 1.05 || Math.abs(n.y) > 1.05;
      el.style.visibility = hidden ? 'hidden' : 'visible';
      el.style.transform = `translate(${((n.x + 1) / 2) * size.width}px, ${((1 - n.y) / 2) * size.height}px)`;
    };
    for (const j of JOINTS) place(`joint:${j.id}`, p.mode === 'pose' ? wp(bone(j.anchor), new Vector3()) : null);
    place('target', ik ? new Vector3(...p.target!) : null);
    place('mark', markOn ? rig.rest.mark : null);
    (['Left', 'Right'] as const).forEach((side, i) => place(`sink:${i}`, helpers.sinks[i].visible ? wp(bone(`${side}Foot`), new Vector3()).setY(0) : null));

    // Render.
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setScissorTest(false);
    gl.setClearColor('#0d1114', 1);
    gl.clear();
    gl.shadowMap.needsUpdate = true;
    gl.render(scene, camera);
  }
}

function disposeRig(rig: Rig, helpers: Helpers) {
  helpers.dispose();
  for (const m of rig.meshes) { m.smooth.dispose(); m.rigid.dispose(); m.base.dispose(); m.xray.dispose(); m.paint.dispose(); }
}

function World(props: FrameProps) {
  const { character, shared } = props;
  const gltf = useGLTF(URLS[character]);
  const rig = useMemo(() => buildRig(gltf.scene as Group, character), [gltf, character]);
  const helpers = useMemo(() => new Helpers(rig.segments.length), [rig]);
  const [view] = useState(() => new StageView());
  useEffect(() => view.publish(shared, rig), [view, shared, rig]);
  useEffect(() => () => disposeRig(rig, helpers), [rig, helpers]);
  return <>
    <FrameOrchestrator renderFrame={(state, delta) => view.frame(props, rig, helpers, state, delta)} />
    <color attach="background" args={['#0d1114']} />
    <fog attach="fog" args={['#0d1114', 5.5, 10]} />
    <hemisphereLight args={['#dfe8f4', '#2a2118', 1.1]} />
    <directionalLight position={[2.6, 5, 3.6]} intensity={2.4} color="#fff1df" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0008} shadow-normalBias={0.03}
      shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={2.4} shadow-camera-bottom={-0.5} shadow-camera-near={0.5} shadow-camera-far={14} />
    <directionalLight position={[-3, 3, -4]} intensity={1.3} color="#bfe0ff" />
    <Floor />
    <primitive object={rig.model} />
    <primitive object={helpers.group} />
  </>;
}

function Floor() {
  const [grid] = useState(() => {
    const g = new Group();
    const disc = new Mesh(new CircleGeometry(6, 64), new MeshStandardMaterial({ color: '#1a2024', roughness: 0.95 }));
    disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true;
    const pts: number[] = [];
    for (let i = -20; i <= 20; i++) {
      const x = i * 0.25, h = Math.sqrt(Math.max(0, 5 ** 2 - x * x));
      pts.push(x, 0.002, -h, x, 0.002, h, -h, 0.002, x, h, 0.002, x);
    }
    const lg = new BufferGeometry(); lg.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    const lines = new LineSegments(lg, new LineBasicMaterial({ color: '#2f3a40', transparent: true, opacity: 0.8 }));
    g.add(disc, lines);
    return g;
  });
  useEffect(() => () => grid.traverse((o) => { const m = o as Mesh; m.geometry?.dispose(); (m.material as Material | undefined)?.dispose?.(); }), [grid]);
  return <primitive object={grid} />;
}

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <div className="rg-fallback">The 3D stage could not load. Check WebGL and reload.</div> : this.props.children; } }

/* ---------- DOM layer: joint pickers, IK target, labels ---------- */

const ray = new Raycaster();
function dragPoint(camera: PerspectiveCamera, rect: DOMRect, x: number, y: number, through: Vector3): Vector3 | null {
  ray.setFromCamera(new Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
  const n = camera.getWorldDirection(new Vector3());
  const denom = n.dot(ray.ray.direction);
  if (Math.abs(denom) < 1e-6) return null;
  const t = through.clone().sub(ray.ray.origin).dot(n) / denom;
  return t > 0 ? ray.ray.origin.clone().addScaledVector(ray.ray.direction, t) : null;
}

interface DragProps { onFk: (id: JointId, v: Sliders) => void; onHipDrop: (m: number) => void; maxDrop: number }

export function RigStage(props: RigStageProps & DragProps & { markMagnet: Vec3 | null; sinkCm: number; handles: HandleMap }) {
  const { handles } = props;
  const layer = useRef<HTMLDivElement>(null);
  const grab = useRef<{ id: JointId; x: number; y: number; moved: boolean; drop: number; y0: number; end0: Vector3; at0: Vector3 | null } | null>(null);
  const reg = (key: string) => (el: HTMLElement | null) => { if (el) handles.set(key, el); else handles.delete(key); };
  const { target, onTarget, shared, markMagnet } = props;

  const move = (clientX: number, clientY: number) => {
    const cam = shared.camera, rect = layer.current?.getBoundingClientRect();
    if (!cam || !rect || !target) return;
    const pt = dragPoint(cam, rect, clientX, clientY, new Vector3(...target));
    if (pt) onTarget([pt.x, pt.y, pt.z]);
  };
  const release = (clientX: number, clientY: number) => {
    const cam = shared.camera, rect = layer.current?.getBoundingClientRect();
    if (!cam || !rect || !markMagnet) return;
    const n = new Vector3(...markMagnet).project(cam);
    const px = rect.left + ((n.x + 1) / 2) * rect.width, py = rect.top + ((1 - n.y) / 2) * rect.height;
    if (Math.hypot(px - clientX, py - clientY) < 30) onTarget([...markMagnet]);
  };
  const nudge = (e: React.KeyboardEvent) => {
    const cam = shared.camera;
    if (!cam || !target) return;
    const step = e.shiftKey ? 0.005 : 0.02;
    const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion), fwd = cam.getWorldDirection(new Vector3());
    const d = ({ ArrowLeft: right.multiplyScalar(-step), ArrowRight: right.multiplyScalar(step), ArrowUp: up.multiplyScalar(step), ArrowDown: up.multiplyScalar(-step), PageUp: fwd.multiplyScalar(step), PageDown: fwd.multiplyScalar(-step) } as Record<string, Vector3>)[e.key];
    if (!d) return;
    e.preventDefault();
    const v = new Vector3(...target).add(d);
    onTarget([v.x, v.y, v.z]);
  };

  /** What dragging a joint does: FK joints swing toward the pointer; with IK legs the hips drop; IK-driven joints only select. */
  const dragKind = (id: JointId): 'swing' | 'drop' | null => {
    if (props.mode !== 'pose') return null;
    const limb = joint(id).limb;
    if (limb === 'arm' && props.arm === 'ik') return null;
    if (limb === 'legs' && props.legs === 'ik') return id === 'hips' ? 'drop' : null;
    return 'swing';
  };
  const worldAt = (clientX: number, clientY: number, through: Vector3) => {
    const cam = shared.camera, rect = layer.current?.getBoundingClientRect();
    return cam && rect ? dragPoint(cam, rect, clientX, clientY, through) : null;
  };
  const jointDown = (id: JointId) => (e: React.PointerEvent<HTMLButtonElement>) => {
    props.onSelect(id);
    const kind = dragKind(id), ends = shared.ends?.(id);
    if (!kind || !ends) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p0 = worldAt(e.clientX, e.clientY, ends.pivot);
    // Relative drag: the bone's end moves by as much as the pointer does, so grabbing never jumps.
    grab.current = { id, x: e.clientX, y: e.clientY, moved: false, drop: props.hipDrop, y0: p0?.y ?? 0, end0: ends.end, at0: worldAt(e.clientX, e.clientY, ends.end) };
  };
  const jointMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = grab.current;
    if (!g || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 4) return;
    g.moved = true;
    const kind = dragKind(g.id), ends = shared.ends?.(g.id);
    if (!kind || !ends) return;
    if (kind === 'drop') {
      const p = worldAt(e.clientX, e.clientY, ends.pivot);
      if (p) props.onHipDrop(Math.round(Math.min(props.maxDrop, Math.max(0, g.drop + g.y0 - p.y)) * 200) / 200);
      return;
    }
    const at = worldAt(e.clientX, e.clientY, g.end0);
    const v = at && g.at0 && shared.aim?.(g.id, at.sub(g.at0).add(g.end0), props.fk[g.id]);
    if (v) props.onFk(g.id, v);
  };
  const jointUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    grab.current = null;
  };

  return <div className="rg-stage" data-testid="rig-stage" data-display={props.display} data-character={props.character} data-view={props.view} data-mode={props.mode} data-correction={props.correction} data-weights={props.weights} data-arm={props.arm} data-legs={props.legs}>
    <Boundary><Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.75]} gl={{ antialias: true }} onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }} fallback={<div className="rg-fallback">WebGL is required for the 3D stage.</div>}>
      <Suspense fallback={<Html center><span className="rg-loading">Loading the rig…</span></Html>}><World {...props} /></Suspense>
    </Canvas></Boundary>
    <div className="rg-layer" ref={layer}>
      {JOINTS.map((j) => <button key={j.id} ref={reg(`joint:${j.id}`)} type="button" className="rg-joint" data-limb={j.limb ?? 'body'} aria-pressed={props.selected === j.id} aria-label={`${j.label}: drag to rotate, or click to pick`} title={dragKind(j.id) ? `${j.label} · drag to rotate` : j.label} data-drag={dragKind(j.id) ?? 'none'} data-testid={`joint-${j.id}`}
        onClick={() => props.onSelect(j.id)} onPointerDown={jointDown(j.id)} onPointerMove={jointMove} onPointerUp={jointUp} onPointerCancel={jointUp}><i /></button>)}
      <span ref={reg('mark')} className="rg-mark" data-testid="mark" aria-hidden><i>mark</i></span>
      <span ref={reg('sink:0')} className="rg-sink" aria-hidden><i>−{props.sinkCm} cm</i></span>
      <button ref={reg('target')} type="button" className="rg-target" aria-label="IK hand target: drag, or use arrow keys (Shift for fine, Page Up/Down for depth)" data-testid="ik-target"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e.clientX, e.clientY); }}
        onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { e.currentTarget.releasePointerCapture(e.pointerId); release(e.clientX, e.clientY); } }}
        onKeyDown={nudge}><i /></button>
    </div>
  </div>;
}

