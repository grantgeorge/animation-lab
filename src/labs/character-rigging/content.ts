import type { Correction } from './rigMath';

export const ANATOMY = [
  { id: 'skeleton', n: '01', label: 'Skeleton', text: 'Joints in a hierarchy. Rotate a parent and everything below it follows.' },
  { id: 'skin', n: '02', label: 'Skin', text: 'The mesh is bound to the joints by weights, vertex by vertex.' },
  { id: 'controls', n: '03', label: 'Controls', text: 'What the animator touches: FK rotations, IK handles, pole vectors.' },
] as const;

export const CORRECTIONS: readonly { id: Correction; label: string; text: string }[] = [
  { id: 'none', label: 'Bind pose, no correction', text: 'Clip rotations land on arms still in the A-pose they were bound in. At rest the arms stick out from the coat, and every gesture starts from that wrong angle.' },
  { id: 'offset', label: 'Offset only', text: 'A rest offset brings the upper arms down first, so they hang at the sides. But the elbow still bends about the A-pose axis, so the forearm swings off its plane.' },
  { id: 'shipped', label: 'Offset + hinge frame', text: 'Rotations below the shoulder are re-expressed in the corrected arm’s frame, so the elbow bends as a clean hinge again. This is what every lab ships.' },
];

export const FK_IK = [
  { title: 'Use FK for', items: ['Arcs and swings: arm swings in a walk, a throw, a wave', 'Overlapping action: each joint keys on its own timing', 'Anything in the air with no contact to keep'], tone: 'fk' },
  { title: 'Use IK for', items: ['Contacts: feet on the floor, a hand on a table or a rail', 'Squats, crouches, climbs and pushes', 'Holding a prop steady while the body moves'], tone: 'ik' },
  { title: 'Switch between them', items: ['Rigs carry both and blend with an IK/FK switch', 'Matching snaps one to the other so the pose doesn’t jump', 'This lab matches automatically when you switch a limb'], tone: 'switch' },
] as const;

export const VOCABULARY: readonly [string, string][] = [
  ['Rig', 'The skeleton, skin binding and controls that let an animator pose a model.'],
  ['Joint (bone)', 'A pivot in the hierarchy. Each one stores a rotation relative to its parent.'],
  ['Bind pose', 'The pose the mesh was attached to the skeleton in. Here, an A-pose with the arms out.'],
  ['Rest pose', 'The neutral pose animation is written from. Here, arms down, reached with a rest offset.'],
  ['FK (forward kinematics)', 'Rotate joints from the root outward; the hand ends up wherever the chain puts it.'],
  ['IK (inverse kinematics)', 'Place the end of a chain; a solver works out the joint rotations.'],
  ['Pole vector', 'The control that picks which way an IK elbow or knee points.'],
  ['Skin weights', 'How much each joint moves each vertex. Up to four joints per vertex here, summing to 1.'],
  ['Linear blend skinning', 'The standard method: each vertex moves by a weighted average of its joints’ transforms.'],
  ['Candy wrapper', 'The pinch a twisted joint makes under linear blend skinning, as the averaged vertices collapse.'],
];
