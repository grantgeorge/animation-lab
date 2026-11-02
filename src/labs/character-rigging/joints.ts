import type { Delta } from './rigMath';

/** The joints a student can pick and rotate. Slider values are signed so positive is the natural direction. */
export type JointId = 'spine' | 'head' | 'shoulder' | 'elbow' | 'wrist' | 'hips' | 'knees';
export type Axis = 'rx' | 'ry' | 'rz';
export type Limb = 'arm' | 'legs' | null;

export interface AxisSpec { k: Axis; name: string; sign: 1 | -1; min: number; max: number; hint: string }
export interface JointSpec {
  id: JointId;
  label: string;
  /** Clip parts it drives. Right-side parts mirror ry and rz. */
  parts: string[];
  /** Skeleton bones whose skin weights it owns (for the weights view). */
  bones: string[];
  /** Where its handle sits. */
  anchor: string;
  limb: Limb;
  axes: AxisSpec[];
}

export const JOINTS: readonly JointSpec[] = [
  { id: 'spine', label: 'Spine', parts: ['torso'], bones: ['Spine01'], anchor: 'Spine01', limb: null, axes: [
    { k: 'rx', name: 'Bend', sign: 1, min: -30, max: 60, hint: 'forward' },
    { k: 'ry', name: 'Turn', sign: 1, min: -60, max: 60, hint: 'toward his left' },
    { k: 'rz', name: 'Lean', sign: -1, min: -30, max: 30, hint: 'to his left' },
  ] },
  { id: 'head', label: 'Head', parts: ['head'], bones: ['Head'], anchor: 'Head', limb: null, axes: [
    { k: 'rx', name: 'Nod', sign: 1, min: -35, max: 45, hint: 'down' },
    { k: 'ry', name: 'Turn', sign: 1, min: -75, max: 75, hint: 'toward his left' },
    { k: 'rz', name: 'Tilt', sign: -1, min: -35, max: 35, hint: 'to his left' },
  ] },
  { id: 'shoulder', label: 'Left shoulder', parts: ['upperArmL'], bones: ['LeftArm'], anchor: 'LeftArm', limb: 'arm', axes: [
    { k: 'rz', name: 'Raise', sign: 1, min: -10, max: 150, hint: 'out to the side' },
    { k: 'rx', name: 'Swing', sign: -1, min: -50, max: 150, hint: 'forward' },
    { k: 'ry', name: 'Twist', sign: 1, min: -90, max: 120, hint: 'outward' },
  ] },
  { id: 'elbow', label: 'Left elbow', parts: ['forearmL'], bones: ['LeftForeArm'], anchor: 'LeftForeArm', limb: 'arm', axes: [
    { k: 'rx', name: 'Bend', sign: -1, min: 0, max: 150, hint: 'a hinge: one axis does the work' },
    { k: 'ry', name: 'Twist', sign: 1, min: -90, max: 90, hint: 'palm up / down' },
  ] },
  { id: 'wrist', label: 'Left wrist', parts: ['handL'], bones: ['LeftHand'], anchor: 'LeftHand', limb: 'arm', axes: [
    { k: 'rx', name: 'Flex', sign: 1, min: -70, max: 70, hint: 'palm toward forearm' },
    { k: 'rz', name: 'Tilt', sign: 1, min: -40, max: 40, hint: 'thumb side' },
    { k: 'ry', name: 'Twist', sign: 1, min: -180, max: 180, hint: 'past ±90° the skin collapses' },
  ] },
  { id: 'hips', label: 'Hips · both legs', parts: ['thighL', 'thighR'], bones: ['LeftUpLeg', 'RightUpLeg'], anchor: 'Hips', limb: 'legs', axes: [
    { k: 'rx', name: 'Swing', sign: -1, min: -30, max: 110, hint: 'thighs forward' },
    { k: 'rz', name: 'Spread', sign: 1, min: -10, max: 40, hint: 'knees apart' },
  ] },
  { id: 'knees', label: 'Knees · both legs', parts: ['shinL', 'shinR'], bones: ['LeftLeg', 'RightLeg'], anchor: 'LeftLeg', limb: 'legs', axes: [
    { k: 'rx', name: 'Bend', sign: 1, min: 0, max: 150, hint: 'shins back' },
  ] },
];

export const joint = (id: JointId) => JOINTS.find((j) => j.id === id)!;

/** Slider values per joint, in the natural sign of each axis. */
export type FkPose = Record<JointId, Partial<Record<Axis, number>>>;
export const emptyPose = (): FkPose => ({ spine: {}, head: {}, shoulder: {}, elbow: {}, wrist: {}, hips: {}, knees: {} });

/** Slider values → clip deltas by part (what the rig math consumes). */
export function fkDeltas(pose: FkPose): Map<string, Delta> {
  const out = new Map<string, Delta>();
  for (const j of JOINTS) {
    for (const part of j.parts) {
      const mirror = part.endsWith('R');
      const d: Delta = {};
      for (const a of j.axes) {
        const v = pose[j.id][a.k] ?? 0;
        d[a.k] = v * a.sign * (mirror && a.k !== 'rx' ? -1 : 1);
      }
      out.set(part, d);
    }
  }
  return out;
}

/** Clip delta of one part → slider values (used when IK hands its result back to FK). */
export function slidersFromDelta(id: JointId, d: Delta): Partial<Record<Axis, number>> {
  const j = joint(id);
  const out: Partial<Record<Axis, number>> = {};
  for (const a of j.axes) {
    const v = (d[a.k] ?? 0) * a.sign;
    out[a.k] = Math.round(Math.min(a.max, Math.max(a.min, v)));
  }
  return out;
}
