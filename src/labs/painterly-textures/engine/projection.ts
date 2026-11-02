import { Matrix4, Vector3, Vector4 } from "three";

/**
 * Camera projection of a matte painting. The painting is projected from a "projector" camera onto
 * the set; seen from that same camera it is perfect. From anywhere else every surface shows the
 * painting through a different, oblique mapping: texels stretch. This measures that stretch.
 */

export type Vec3 = readonly [number, number, number];

export interface CamPose {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view, degrees. */
  fovDeg: number;
  aspect: number;
  near?: number;
  far?: number;
}

const UP = new Vector3(0, 1, 0);

/** World → camera (view) matrix for a look-at pose. */
export function viewMatrix(p: CamPose): Matrix4 {
  const eye = new Vector3(...p.position);
  const m = new Matrix4().lookAt(eye, new Vector3(...p.target), UP);
  m.setPosition(eye);
  return m.invert();
}

export function projectionMatrix(p: CamPose): Matrix4 {
  const near = p.near ?? 0.05;
  const far = p.far ?? 60;
  const top = near * Math.tan((p.fovDeg * Math.PI) / 360);
  const right = top * p.aspect;
  return new Matrix4().makePerspective(-right, right, top, -top, near, far);
}

/** projection · view: world → clip space. */
export function viewProjection(p: CamPose): Matrix4 {
  return projectionMatrix(p).multiply(viewMatrix(p));
}

/** Where a world point lands in a camera: uv ∈ [0, 1]² when on screen, w > 0 when in front. */
export function projectUv(vp: Matrix4, point: Vec3 | Vector3): { u: number; v: number; w: number } {
  const c = point instanceof Vector3 ? new Vector4(point.x, point.y, point.z, 1) : new Vector4(point[0], point[1], point[2], 1);
  c.applyMatrix4(vp);
  return { u: (c.x / c.w) * 0.5 + 0.5, v: (c.y / c.w) * 0.5 + 0.5, w: c.w };
}

const onScreen = (q: { u: number; v: number; w: number }) => q.w > 0 && q.u >= 0 && q.u <= 1 && q.v >= 0 && q.v <= 1;

/** Two unit tangents spanning the plane with normal n. */
function tangents(n: Vector3): [Vector3, Vector3] {
  const a = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const t1 = new Vector3().crossVectors(a, n).normalize();
  const t2 = new Vector3().crossVectors(n, t1).normalize();
  return [t1, t2];
}

/** Singular values (σ1 ≥ σ2) of a 2×2 matrix [[a, b], [c, d]]. */
export function singularValues2(a: number, b: number, c: number, d: number): [number, number] {
  const s1 = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  const disc = Math.sqrt(Math.max(0, s1 * s1 - 4 * det * det));
  return [Math.sqrt((s1 + disc) / 2), Math.sqrt(Math.max(0, (s1 - disc) / 2))];
}

export interface StretchSample {
  /** σ1/σ2 of the matte → screen mapping: 1 = undistorted, 3 = texels three times longer one way. */
  anisotropy: number;
  /** √(σ1σ2): how much bigger a matte texel appears on screen than it did from the projector. */
  magnification: number;
  visible: boolean;
}

/**
 * Stretch of the projected painting at one surface point, seen from `viewer`. Both cameras are
 * measured in their own normalized image units, scaled by aspect so pixels are square.
 * M = J_view · J_proj⁻¹, the Jacobian from matte pixels to screen pixels on the surface's plane.
 */
export function stretchAt(projector: CamPose, viewer: CamPose, point: Vec3, normal: Vec3, eps = 1e-3): StretchSample {
  const pvp = viewProjection(projector);
  const vvp = viewProjection(viewer);
  const n = new Vector3(...normal).normalize();
  const p0 = new Vector3(...point);
  const toProj = new Vector3(...projector.position).sub(p0);
  const toView = new Vector3(...viewer.position).sub(p0);
  const q0 = projectUv(pvp, point);
  const s0 = projectUv(vvp, point);
  const visible = onScreen(q0) && onScreen(s0) && toProj.dot(n) > 0 && toView.dot(n) > 0;
  const [t1, t2] = tangents(n);
  const d = (vp: Matrix4, aspect: number, t: Vector3) => {
    const a = projectUv(vp, p0.clone().addScaledVector(t, eps));
    const b = projectUv(vp, p0.clone().addScaledVector(t, -eps));
    return [((a.u - b.u) / (2 * eps)) * aspect, (a.v - b.v) / (2 * eps)];
  };
  const [p11, p21] = d(pvp, projector.aspect, t1);
  const [p12, p22] = d(pvp, projector.aspect, t2);
  const [v11, v21] = d(vvp, viewer.aspect, t1);
  const [v12, v22] = d(vvp, viewer.aspect, t2);
  const det = p11 * p22 - p12 * p21;
  if (Math.abs(det) < 1e-12) return { anisotropy: Infinity, magnification: Infinity, visible: false };
  // inverse of the projector Jacobian
  const i11 = p22 / det, i12 = -p12 / det, i21 = -p21 / det, i22 = p11 / det;
  const m11 = v11 * i11 + v12 * i21;
  const m12 = v11 * i12 + v12 * i22;
  const m21 = v21 * i11 + v22 * i21;
  const m22 = v21 * i12 + v22 * i22;
  const [s1, s2] = singularValues2(m11, m12, m21, m22);
  // a viewer with a different focal length rescales uniformly; normalise by the FOV ratio
  const k = Math.tan((projector.fovDeg * Math.PI) / 360) / Math.tan((viewer.fovDeg * Math.PI) / 360);
  return { anisotropy: s2 > 1e-9 ? s1 / s2 : Infinity, magnification: Math.sqrt(s1 * s2) / k, visible };
}

export interface SurfacePoint {
  p: Vec3;
  n: Vec3;
}

/** Mean anisotropic stretch over the sample points both cameras see (1 = perfect). */
export function meanStretch(projector: CamPose, viewer: CamPose, samples: readonly SurfacePoint[]): { stretch: number; visible: number } {
  let sum = 0;
  let count = 0;
  for (const s of samples) {
    const r = stretchAt(projector, viewer, s.p, s.n);
    if (!r.visible || !Number.isFinite(r.anisotropy)) continue;
    sum += Math.min(r.anisotropy, 12);
    count++;
  }
  return { stretch: count ? sum / count : 1, visible: count };
}

/**
 * The viewer moved off the projector: swing around `pivot` by `yawDeg` and raise by `rise` metres,
 * keeping the aim on the pivot. offset 0 is the projector itself.
 */
export function offsetPose(projector: CamPose, pivot: Vec3, yawDeg: number, rise = 0, dolly = 0): CamPose {
  const p = new Vector3(...projector.position);
  const c = new Vector3(...pivot);
  const r = p.clone().sub(c);
  r.applyAxisAngle(UP, (yawDeg * Math.PI) / 180);
  const dir = r.clone().normalize();
  const pos = c.clone().add(r).addScaledVector(dir, dolly);
  pos.y += rise;
  // keep the projector's aim offset relative to the pivot (target shifts with the swing)
  const tgt = new Vector3(...projector.target).sub(c).applyAxisAngle(UP, (yawDeg * Math.PI) / 180).add(c);
  return { ...projector, position: [pos.x, pos.y, pos.z], target: [tgt.x, tgt.y, tgt.z] };
}
