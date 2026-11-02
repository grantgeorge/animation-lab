import { createStore, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CameraMode, CameraRig, MatchRef, TargetId } from "@/engine/types";
import { memoryStorage } from "@/lib/storage";
import type { SceneId } from "@/labs/lens-and-framing/config";

export type ExerciseId = "ex1" | "ex2" | "ex3";
export type ObjectiveId = "reaction" | "relationship";

export interface SavedShot {
  id: string;
  createdAt: string;
  objective: ObjectiveId | null;
  summary: string;
  phrase: string;
  /** Older stored shots omit sceneId and belong to the original doorway scene. */
  settings: { sceneId?: SceneId; rig: CameraRig; mode: CameraMode; targetId: TargetId; matchRef: MatchRef | null; timeS: number };
}

export interface LessonState {
  active: ExerciseId | null;
  objective: ObjectiveId | null;
  progress: {
    ex1: { held: number[] };
    ex2: { target: TargetId | null; held: number[]; travelM: number };
    ex3: { saved: Partial<Record<ObjectiveId, string>> };
  };
  completed: Partial<Record<ExerciseId, string>>;
  shots: SavedShot[];
  cardOpen: boolean;
}

export const initialProgress = (): LessonState["progress"] => ({
  ex1: { held: [] },
  ex2: { target: null, held: [], travelM: 0 },
  ex3: { saved: {} },
});

export const lessonStore = createStore<LessonState>()(
  persist(
    (): LessonState => ({
      active: null,
      objective: null,
      progress: initialProgress(),
      completed: {},
      shots: [],
      cardOpen: false,
    }),
    {
      name: "animation-lab.progress.v1",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage() : window.localStorage)),
      partialize: (s) => ({ progress: s.progress, completed: s.completed, shots: s.shots }),
      migrate: (persisted, version) => (version === 1 ? (persisted as LessonState) : { progress: initialProgress(), completed: {}, shots: [] }) as LessonState,
    },
  ),
);

export const useLesson = <T,>(sel: (s: LessonState) => T) => useStore(lessonStore, sel);
