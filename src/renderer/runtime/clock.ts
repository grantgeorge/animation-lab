import { MasterClock } from "@/engine/timeline/clock";
import { sceneDescriptor } from "@/labs/lens-and-framing/config";

/** The one clock for the lab. Ticked once per frame by the FrameOrchestrator. */
export const labClock = new MasterClock({ durationS: sceneDescriptor.timeline.durationS, playing: true });
