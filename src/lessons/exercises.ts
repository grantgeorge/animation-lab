import type { ExerciseId, LessonState, ObjectiveId } from "./lessonStore";

export interface Step {
  text: string;
  hint?: string;
  done: (s: LessonState) => boolean;
}

export interface ExerciseDef {
  id: ExerciseId;
  number: 1 | 2 | 3;
  title: string;
  objective: string;
  steps: Step[];
  complete: (s: LessonState) => boolean;
  completion: string;
}

const has = (arr: number[], f: number) => arr.includes(f);

export const OBJECTIVES: Record<ObjectiveId, { title: string; brief: string; suggestion: string; why: string }> = {
  reaction: {
    title: "Emphasize Bram's reaction",
    brief: "Make his face the story.",
    suggestion: "Try 85 mm · Match · Bram",
    why: "A longer lens from farther away keeps his face calm and natural; the doorway fills the background and Pip slips toward the edge.",
  },
  relationship: {
    title: "Show both characters in their world",
    brief: "Establish where they are and how far apart.",
    suggestion: "Try 24 mm · Fixed · Both",
    why: "A wide lens keeps the doorway, the floor and both characters in one frame; the depth between them becomes part of the story.",
  },
};

export const EXERCISES: ExerciseDef[] = [
  {
    id: "ex1",
    number: 1,
    title: "How wide is your shot?",
    objective: "Change the lens while the camera stays put. Only the field of view changes.",
    steps: [
      { text: "Hold 24 mm for a second", hint: "key 2", done: (s) => has(s.progress.ex1.held, 24) },
      { text: "Hold 50 mm", hint: "key 4", done: (s) => has(s.progress.ex1.held, 50) },
      { text: "Hold 85 mm", hint: "key 5", done: (s) => has(s.progress.ex1.held, 85) },
    ],
    complete: (s) => [24, 50, 85].every((f) => has(s.progress.ex1.held, f)),
    completion: "Three lenses, one viewpoint. The picture never changed, only the crop did.",
  },
  {
    id: "ex2",
    number: 2,
    title: "Why does perspective change?",
    objective: "Keep Bram the same size while the lens changes. Now the camera has to move.",
    steps: [
      { text: "Hold 24 mm: the camera rolls in close", hint: "key 2", done: (s) => has(s.progress.ex2.held, 24) },
      { text: "Hold 85 mm: it backs away", hint: "key 5", done: (s) => has(s.progress.ex2.held, 85) },
      { text: "Compare his nose and ears, and the doorway behind him", hint: "P shows the guide", done: (s) => has(s.progress.ex2.held, 24) && has(s.progress.ex2.held, 85) },
    ],
    complete: (s) => s.progress.ex2.target !== null && has(s.progress.ex2.held, 24) && has(s.progress.ex2.held, 85) && s.progress.ex2.travelM >= 0.5,
    completion: "Same size, different face. Perspective came from the distance, not the glass.",
  },
  {
    id: "ex3",
    number: 3,
    title: "Tell the story",
    objective: "Pick a shot for each objective. There's no single right answer: save what you believe.",
    steps: [
      { text: OBJECTIVES.reaction.title, hint: "save a shot", done: (s) => !!s.progress.ex3.saved.reaction && s.shots.some((x) => x.id === s.progress.ex3.saved.reaction) },
      { text: OBJECTIVES.relationship.title, hint: "save a shot", done: (s) => !!s.progress.ex3.saved.relationship && s.shots.some((x) => x.id === s.progress.ex3.saved.relationship) },
    ],
    complete: (s) => {
      const a = s.shots.find((x) => x.id === s.progress.ex3.saved.reaction);
      const b = s.shots.find((x) => x.id === s.progress.ex3.saved.relationship);
      if (!a || !b) return false;
      const sig = (x: typeof a) => `${Math.round(x.settings.rig.focalMm)}|${x.settings.mode}|${x.settings.targetId}|${x.settings.rig.railS.toFixed(1)}`;
      return sig(a) !== sig(b);
    },
    completion: "Two objectives, two different shots. That's directing.",
  },
];

export const exerciseById = (id: ExerciseId) => EXERCISES.find((e) => e.id === id)!;
