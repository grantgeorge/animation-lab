import { Matrix4, Vector4 } from "three";
import { FAR, NEAR } from "./world";

/**
 * The revealed-area metric. For every pixel of the current frame, take its depth, lift it back to
 * a world point, and reproject that point into the move's first frame. If it lands outside that
 * frame it is new at the edge; if something nearer covered that spot in frame 0 it is a
 * disocclusion: geometry that was hidden and now has to exist. Both count as "revealed".
 */
export interface DepthView {
  width: number;
  height: number;
  /** Linear depth along the view axis (m), row 0 = bottom (GL readback order). */
  depth: Float32Array;
  /** Camera → world. */
  camToWorld: Matrix4;
  /** World → camera. */
  worldToCam: Matrix4;
  tanX: number;
  tanY: number;
}

export const REVEAL = { relTol: 0.035, absTol: 0.06 } as const;

export const MASK = { SEEN: 0, EDGE: 1, DISOCCLUDED: 2 } as const;

export interface RevealResult {
  /** Fraction of the frame that was not visible in frame 0 (edge + disoccluded). */
  total: number;
  edge: number;
  disoccluded: number;
  mask: Uint8Array;
}

const LOG_RANGE = Math.log(FAR / NEAR);

/** Log-encode a depth into 0..1 (precision spread evenly from 20 cm to 6 km). */
export const encodeDepth01 = (z: number) => Math.min(1, Math.max(0, Math.log(Math.max(z, NEAR) / NEAR) / LOG_RANGE));
export const decodeDepth01 = (v: number) => NEAR * Math.exp(v * LOG_RANGE);

/** CPU twin of the shader packing: 0..1 → three bytes (as the GPU would round them). */
export function packDepthBytes(v: number): [number, number, number] {
  const x = Math.min(0.999999, Math.max(0, v));
  const e = [x, (x * 255) % 1, (x * 65025) % 1];
  e[0] -= e[1] / 255;
  e[1] -= e[2] / 255;
  return [Math.round(e[0] * 255), Math.round(e[1] * 255), Math.round(e[2] * 255)];
}

export const unpackDepthBytes = (r: number, g: number, b: number) => r / 255 + g / 65025 + b / 16581375;

/** Decode an RGBA8 readback (from the depth pass) into metres. Cleared pixels (255,255,255) → FAR. */
export function decodeDepthBuffer(rgba: Uint8Array, out?: Float32Array) {
  const n = rgba.length / 4;
  const d = out && out.length === n ? out : new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    d[i] = r === 255 && g === 255 && b === 255 ? FAR : decodeDepth01(unpackDepthBytes(r, g, b));
  }
  return d;
}

const v4 = new Vector4();
const w4 = new Vector4();

/** Reproject `now` into `ref` and classify every pixel. */
export function revealedArea(now: DepthView, ref: DepthView, out?: Uint8Array): RevealResult {
  const { width: W, height: H } = now;
  const mask = out && out.length === W * H ? out : new Uint8Array(W * H);
  const m = new Matrix4().multiplyMatrices(ref.worldToCam, now.camToWorld);
  const RW = ref.width;
  const RH = ref.height;
  let edge = 0;
  let dis = 0;
  for (let j = 0; j < H; j++) {
    const ny = ((j + 0.5) / H) * 2 - 1;
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const z = now.depth[k];
      const nx = ((i + 0.5) / W) * 2 - 1;
      v4.set(nx * now.tanX * z, ny * now.tanY * z, -z, 1);
      w4.copy(v4).applyMatrix4(m);
      const z0 = -w4.z;
      if (z0 <= NEAR * 0.5) {
        mask[k] = MASK.EDGE;
        edge++;
        continue;
      }
      const px = w4.x / z0 / ref.tanX;
      const py = w4.y / z0 / ref.tanY;
      if (px < -1 || px > 1 || py < -1 || py > 1) {
        mask[k] = MASK.EDGE;
        edge++;
        continue;
      }
      // Max of the 2×2 neighbourhood: silhouettes don't count as reveals from resampling alone.
      const fx = ((px + 1) / 2) * RW - 0.5;
      const fy = ((py + 1) / 2) * RH - 0.5;
      const x0 = Math.max(0, Math.min(RW - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(RH - 1, Math.floor(fy)));
      const x1 = Math.min(RW - 1, x0 + 1);
      const y1 = Math.min(RH - 1, y0 + 1);
      const d = Math.max(ref.depth[y0 * RW + x0], ref.depth[y0 * RW + x1], ref.depth[y1 * RW + x0], ref.depth[y1 * RW + x1]);
      if (z0 > d * (1 + REVEAL.relTol) + REVEAL.absTol) {
        mask[k] = MASK.DISOCCLUDED;
        dis++;
      } else mask[k] = MASK.SEEN;
    }
  }
  const n = W * H;
  return { total: (edge + dis) / n, edge: edge / n, disoccluded: dis / n, mask };
}

/** Bounding box (normalised 0..1, y down) and centroid of the disoccluded pixels, for tests and labels. */
export function maskBounds(mask: Uint8Array, W: number, H: number, value: number = MASK.DISOCCLUDED) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (mask[j * W + i] !== value) continue;
      const x = (i + 0.5) / W;
      const y = 1 - (j + 0.5) / H;
      n++;
      sx += x;
      sy += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  return n ? { n, cx: sx / n, cy: sy / n, minX, minY, maxX, maxY } : null;
}
