export type PaneId = 'drawn' | 'cutout' | '3d';

export const PANES: { id: PaneId; label: string; how: string; toggle: string }[] = [
  { id: 'drawn', label: 'Hand-drawn', how: 'Every pose is a new drawing', toggle: 'Onion skin' },
  { id: 'cutout', label: '2D cut-out', how: 'Paper parts turning on pivots', toggle: 'Show pivots' },
  { id: '3d', label: '3D rig', how: 'One model, posed by a skeleton', toggle: 'Show rig' },
];

/** What is cheap and what is expensive in each technique. */
export const COMPARE: { row: string; drawn: string; cutout: string; rig: string }[] = [
  { row: 'What you build', drawn: 'A new drawing for every pose: 12 a second on twos', cutout: 'A library of parts for each view, hinged on pivots', rig: 'One model, a skeleton and skin weights' },
  { row: 'A new camera angle', drawn: 'Redraw every frame at that angle', cutout: 'Only the views you drew. Anything between needs a new parts set', rig: 'Free: move the camera' },
  { row: 'A new move', drawn: 'Draw it: keys, breakdowns, in-betweens', cutout: 'Re-key the parts. Every drawing is reused', rig: 'Re-key the rig. Everything is reused' },
  { row: 'Squash, stretch, smears', drawn: 'Free: draw any shape', cutout: 'Hard: parts are rigid, so only scaling and drawing swaps', rig: 'Only with rig controls or deformers built for it' },
  { row: 'Staying on model', drawn: 'Depends on the artist, drawing by drawing', cutout: 'Exact: the same drawings every frame', rig: 'Exact: the model never drifts' },
  { row: 'Light and shadow', drawn: 'Painted on each drawing, or kept flat', cutout: 'Painted into each part', rig: 'Computed from real lights' },
  { row: 'Typical artefact', drawn: 'Line boil, small volume drift', cutout: 'Stiff, paper-puppet motion; pops at view swaps', rig: 'Floaty, over-smooth in-betweens when left on ones' },
  { row: 'Widely known for', drawn: 'Classic Disney features, Studio Ghibli', cutout: 'South Park’s paper look, much TV animation', rig: 'Pixar and most modern feature animation' },
];

export interface Experiment { id: string; title: string; insight: string }
export const EXPERIMENTS: Experiment[] = [
  { id: 'turn', title: 'Turn the camera to 30°', insight: 'The 3D camera just moves. The cut-out has no 30° drawings, so it snaps to its three-quarter set; a true 30° needs a whole new parts library. The drawn pane redraws the entire loop.' },
  { id: 'crouch', title: 'Pause on the crouch', insight: 'Rigid cut-out limbs can’t foreshorten, so to lower the hips in a front view the knees have to splay out. The drawing simply draws the thighs shorter, coming toward you.' },
  { id: 'smear', title: 'Step to the arm swing', insight: 'Between two drawings the arms travel more than 90°, so the animator draws a smear: one stretched shape that sells the speed. Rigid parts can’t stretch, and the 3D rig would need a smear deformer built for it.' },
  { id: 'twos', title: 'Put the 3D rig on twos', insight: 'Cadence is a choice in every technique. Stepped 3D on twos is how stylised 3D features borrow a drawn feel; a cut-out on ones is perfectly smooth and still looks stiff.' },
];
