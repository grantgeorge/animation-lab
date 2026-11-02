import { AGE_LABEL, SHAPES, SYSTEMS, type Design, type DesignReading } from './design';

export const POSES = [
  { id: 'neutral', label: 'Neutral', note: 'arms at the sides' },
  { id: 'open', label: 'Open', note: 'limbs clear of the body' },
  { id: 'action', label: 'Action', note: 'a wave mid-stride' },
] as const;

/** Appeal is not "cute". Four things that make any design, hero or villain, easy to look at. */
export const APPEAL = [
  { title: 'Clarity', body: 'One idea per character, readable from across the room. If you have to explain it, the design isn’t doing its job.' },
  { title: 'Simplicity', body: 'Fewer, bigger shapes. Every extra detail is one more thing an animator must keep on model in every frame.' },
  { title: 'Contrast', body: 'Big, medium, small. A big head on a small body, or a tiny head on huge shoulders. Even sizes read as dull.' },
  { title: 'Straights against curves', body: 'A straight back against a curved belly, a sharp nose on a round face. The tension between them gives a shape life.' },
] as const;

export const SHAPE_NOTES: Record<(typeof SHAPES)[number]['id'], { eg: string; use: string }> = {
  circle: { eg: 'Baymax, Winnie the Pooh', use: 'Heroes’ companions, children, comic relief. No corners means nothing to fear.' },
  square: { eg: 'Carl Fredricksen in Up', use: 'Mentors, protectors, the stubborn. Flat sides and corners read as weight that won’t move.' },
  triangle: { eg: 'Maleficent, Jafar', use: 'Villains, but also fast heroes: a point means direction and danger. Up-pointing reads as balanced; down-pointing as unstable.' },
};

export const TESTS = [
  { title: 'Fill it in black', body: 'Colour and detail hide weak shapes. A solid silhouette shows whether the pose and the character read on their own.' },
  { title: 'Turn it around', body: 'A design must work from the front, the three-quarter view and in profile. Many lose their shape side-on.' },
  { title: 'Shrink it', body: 'Thumbnails, wide shots and fast cuts leave about 48 pixels. If it still reads at that size, it reads everywhere.' },
  { title: 'Line up the cast', body: 'Side by side, each member should differ in height, mass and shape so no two could be confused in a crowd.' },
] as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;
export function briefText(d: Design, r: DesignReading) {
  const sys = SYSTEMS.find(s => s.id === r.system)!.label.toLowerCase();
  const shape = r.shape === 'mixed' ? `mixed shape language (${SHAPES.map((s, i) => `${s.label.toLowerCase()} ${pct(d.shape[i])}`).join(', ')})` : `${r.shape} shape language (${SHAPES.find(s => s.id === r.shape)!.reads})`;
  const eyes = `${d.eyeSize >= 0.18 ? 'large' : d.eyeSize <= 0.12 ? 'small' : 'medium'} eyes ${d.eyeGap >= 1.2 ? 'set wide apart' : d.eyeGap <= 0.7 ? 'set close together' : 'one eye-width apart'}, ${d.eyeLine < 0.46 ? 'low on the face' : d.eyeLine > 0.54 ? 'high on the face' : 'on the half line'}`;
  const limbs = `${d.limbs < 0.46 ? 'short' : d.limbs > 0.58 ? 'long' : 'average'} ${d.thickness > 1.3 ? 'chunky' : d.thickness < 0.8 ? 'slender' : ''} limbs`.replace('  ', ' ');
  return `Character design: ${r.heads.toFixed(1)} heads tall (${sys} proportions), ${shape}; ${eyes}; ${limbs}${d.extremities > 1.3 ? ', oversized hands and feet' : ''}. Reads as ${AGE_LABEL[r.age].toLowerCase()}. Keep these proportions consistent in every shot and from every angle.`;
}
