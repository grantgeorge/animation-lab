import type { Experiment } from "../types";
import data from "./experiment.json";

/** The published workflow comparison (all takes, reviewed notes). Written by scripts/history-media/publish.mjs + editorial review. */
export const EXPERIMENT = data as unknown as Experiment;
