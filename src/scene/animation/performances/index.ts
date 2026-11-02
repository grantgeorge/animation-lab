import type { Clip, Performance } from "../dsl";
import { doorwayWave } from "./doorwayWave";
import { alleyRun } from "./alleyRun";
import { workshopBoo } from "./workshopBoo";

/** Scene id → its performance. Every performance's duration equals its scene's timeline duration. */
export const PERFORMANCES: Record<string, Performance> = {
  doorway: doorwayWave,
  alley: alleyRun,
  workshop: workshopBoo,
};

export const performanceFor = (sceneId: string): Performance => PERFORMANCES[sceneId] ?? doorwayWave;

const EMPTY = (character: Clip["character"]): Clip => ({ character, tracks: [] });
export const clipFor = (sceneId: string, character: Clip["character"]): Clip =>
  performanceFor(sceneId).clips.find((c) => c.character === character) ?? EMPTY(character);
