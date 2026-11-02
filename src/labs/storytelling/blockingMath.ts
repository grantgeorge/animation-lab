import { PerspectiveCamera, Vector3 } from 'three';
import { blockingConfig as config, doorwayScene } from '@/labs/lens-and-framing/config';
import type { Mark } from './engine';

export type Facing = 'front' | 'partner' | 'cheat';
export const FACINGS: { id: Facing; label: string }[] = [
  { id: 'front', label: 'To camera' },
  { id: 'partner', label: 'Each other' },
  { id: 'cheat', label: 'Cheat open' },
];

const DEG = 180 / Math.PI;
const wrap = (deg: number) => ((deg + 540) % 360) - 180;

/** Where the filming camera sits on the floor (x, z) for a given orbit angle. */
export function cameraFloor(angle: number) {
  const a = angle / DEG;
  return { x: Math.sin(a) * config.radius, z: config.target[2] + Math.cos(a) * config.radius };
}

export function configureBlockingCamera(camera: PerspectiveCamera, angle: number, focal: number) {
  const { x, z } = cameraFloor(angle);
  camera.position.set(x, config.cameraHeight, z);
  camera.lookAt(...config.target); camera.aspect = 16 / 9; camera.filmGauge = 36; camera.setFocalLength(focal); camera.updateMatrixWorld();
}

/** Horizontal field of view in degrees on a 36 mm gate. */
export const horizontalFov = (focal: number) => 2 * Math.atan(18 / focal) * DEG;

/** Yaw (degrees, 0 = facing +z toward the default camera) that points `from` at `to`. */
export const yawToward = (from: Mark, to: { x: number; z: number }) => Math.atan2(to.x - from.x, to.z - from.z) * DEG;

/** Each actor's body yaw for a facing choice. Cheating blends the partner turn toward the lens. */
export function facingYaws(bram: Mark, pip: Mark, facing: Facing, angle: number) {
  const cam = cameraFloor(angle);
  const one = (self: Mark, other: Mark) => {
    const toCam = yawToward(self, cam);
    if (facing === 'front') return toCam;
    const toPartner = yawToward(self, other);
    if (facing === 'partner') return toPartner;
    return toPartner + wrap(toCam - toPartner) * config.cheat;
  };
  return { bram: one(bram, pip), pip: one(pip, bram) };
}

/** How much of the face the lens sees: 1 = full front, 0 = profile, negative = turned away. */
export const openness = (self: Mark, yaw: number, angle: number) => Math.cos(wrap(yawToward(self, cameraFloor(angle)) - yaw) / DEG);

/** True when the actor's body is turned within 70 degrees of their partner: the two still read as talking. */
export const engaged = (self: Mark, yaw: number, other: Mark) => Math.abs(wrap(yawToward(self, other) - yaw)) <= 70;

export function faceLabel(open: number) {
  return open >= .7 ? 'Open' : open >= .35 ? 'Three-quarter' : open > -.25 ? 'Profile' : 'Turned away';
}

export function zoneOf(distance: number) {
  const p = config.proxemics;
  return distance < p.intimate ? 'Intimate' : distance < p.personal ? 'Personal' : distance < p.social ? 'Social' : 'Public';
}

export function blockingReadout(bram: Mark, pip: Mark, angle: number, focal: number, facing: Facing = 'front') {
  const camera = new PerspectiveCamera(40, 16 / 9, .05, 80); configureBlockingCamera(camera, angle, focal);
  const box = (mark: Mark, height: number) => {
    const points = [];
    for (const x of [-config.actorRadius, config.actorRadius]) for (const y of [0, height]) for (const z of [-config.actorRadius, config.actorRadius]) points.push(new Vector3(mark.x + x, y, mark.z + z).project(camera));
    return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), bottom: Math.min(...points.map(p => p.y)), top: Math.max(...points.map(p => p.y)) };
  };
  const a = box(bram, doorwayScene.characters.primary.landmarks.capTop), b = box(pip, doorwayScene.characters.secondary.landmarks.capTop);
  const distance = Math.hypot(bram.x - pip.x, bram.z - pip.z);
  const inFrame = (r: typeof a) => r.left >= -1 && r.right <= 1 && r.bottom >= -1 && r.top <= 1;
  const cropped = !inFrame(a) || !inFrame(b);
  const overlap = a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
  const yaw = facingYaws(bram, pip, facing, angle);
  const open = { bram: openness(bram, yaw.bram, angle), pip: openness(pip, yaw.pip, angle) };
  return {
    distance, cropped, overlap, collision: distance < config.clearance,
    croppedActors: [!inFrame(a) && 'Bram', !inFrame(b) && 'Pip'].filter(Boolean) as string[],
    yaw, open,
    engaged: { bram: engaged(bram, yaw.bram, pip), pip: engaged(pip, yaw.pip, bram) },
    zone: zoneOf(distance),
    /** Screen x of each actor's centre, -1 (left) to 1 (right). */
    screen: { bram: (a.left + a.right) / 2, pip: (b.left + b.right) / 2 },
  };
}
export type Reading = ReturnType<typeof blockingReadout>;

export function clampMark(mark: Mark): Mark { return { x: Math.max(config.bounds.x[0], Math.min(config.bounds.x[1], mark.x)), z: Math.max(config.bounds.z[0], Math.min(config.bounds.z[1], mark.z)) }; }
