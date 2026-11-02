/** Live measurements the stage publishes for readouts and exercise checks. Lengths in metres. */
export interface Measure {
  /** Wrist to the mark. */
  markDist: number;
  /** Distance to the IK target as a share of the arm's length (IK only; 0 otherwise). */
  reach: number;
  reached: boolean;
  /** Upper arm's angle from its rest direction. */
  shoulderDeg: number;
  /** Elbow bend beyond the rig's rest bend. */
  elbowDeg: number;
  /** Elbow direction: 0° down, +90° out to the side. */
  poleDeg: number;
  hipDrop: number;
  /** Worst foot below the floor (positive = sinking). */
  footSink: number;
  /** Worst foot sideways from where it stood. */
  footSlide: number;
  legLength: number;
  armLength: number;
  /** The arm mode this measurement was taken in (a switch is only trusted once re-measured). */
  arm: 'fk' | 'ik';
  /** World points the lab needs for FK↔IK matching. */
  wrist: [number, number, number];
  mark: [number, number, number];
}

export interface Ctx { m: Measure; arm: 'fk' | 'ik'; legs: 'fk' | 'ik'; reachedWith: { fk: boolean; ik: boolean } }
export interface Check { label: string; ok: boolean }
export interface Exercise {
  id: 'reach' | 'squat' | 'elbow';
  title: string;
  goal: string;
  insight: string;
  /** Which limb modes and props the exercise starts from. */
  setup: { arm: 'fk' | 'ik'; legs: 'fk' | 'ik'; mark: boolean; targetOnMark?: boolean; view: 'front' | 'threeQuarter' | 'side' };
  checks: (c: Ctx) => Check[];
}

export const TOL = { mark: 0.04, sink: 0.015, slide: 0.02, squat: 0.3, elbowOut: 60 } as const;
const cm = (m: number) => `${Math.round(m * 100)} cm`;

export const EXERCISES: readonly Exercise[] = [
  {
    id: 'reach',
    title: 'Reach the mark',
    goal: 'Put the left wrist on the glowing mark. Do it first in FK, rotating the shoulder and elbow, then switch the arm to IK and drag the hand there.',
    insight: 'FK is indirect: you aim the hand by rotating every joint above it, so a reach takes several adjustments. IK inverts the problem: you place the hand and the solver works out the shoulder and elbow. Animators use IK whenever a hand or foot has to hit something.',
    setup: { arm: 'fk', legs: 'fk', mark: true, view: 'threeQuarter' },
    checks: ({ m, reachedWith }) => [
      { label: `Wrist to mark: ${cm(m.markDist)}`, ok: m.markDist <= TOL.mark },
      { label: 'Reached with FK', ok: reachedWith.fk },
      { label: 'Reached with IK', ok: reachedWith.ik },
    ],
  },
  {
    id: 'squat',
    title: 'Squat without sliding feet',
    goal: 'Lower the hips into a squat. With FK legs the feet go down with the body and sink into the floor. Switch the legs to IK to keep them planted.',
    insight: 'In FK the feet are at the end of the chain, so they move with everything above them. IK legs pin each foot to the floor and solve the knees, which is why almost every character rig defaults to IK legs: walks, jumps and squats all need planted contacts.',
    setup: { arm: 'fk', legs: 'fk', mark: false, view: 'side' },
    checks: ({ m }) => [
      { label: `Hips down ${cm(m.legLength * TOL.squat)} (now ${cm(m.hipDrop)})`, ok: m.hipDrop >= m.legLength * TOL.squat - 0.005 },
      { label: m.footSink > TOL.sink ? `Feet ${cm(m.footSink)} into the floor` : 'Feet on the floor', ok: m.footSink <= TOL.sink },
      { label: m.footSlide > TOL.slide ? `Feet slid ${cm(m.footSlide)}` : 'Feet stayed put', ok: m.footSlide <= TOL.slide },
    ],
  },
  {
    id: 'elbow',
    title: 'Point the elbow',
    goal: 'The hand is on the mark in IK. Keep it there and swing the elbow out to the side with the pole vector, as if the hand were resting on a high shelf.',
    insight: 'Two joints can reach one point in a whole circle of ways. The pole vector picks the plane the elbow bends in. Without it the solver can flip the elbow when the hand crosses the shoulder, so animators key the pole as carefully as the hand.',
    setup: { arm: 'ik', legs: 'fk', mark: true, targetOnMark: true, view: 'front' },
    checks: ({ m, arm }) => [
      { label: 'Arm in IK', ok: arm === 'ik' },
      { label: `Hand on the mark (${cm(m.markDist)})`, ok: m.markDist <= TOL.mark },
      { label: `Elbow out ${TOL.elbowOut}° (now ${Math.round(m.poleDeg)}°)`, ok: m.poleDeg >= TOL.elbowOut },
    ],
  },
];

export const allOk = (checks: Check[]) => checks.length > 0 && checks.every((c) => c.ok);
