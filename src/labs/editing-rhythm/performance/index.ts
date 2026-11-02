import type { Clip as AnimClip, Track } from "@/scene/animation/dsl";
import { REELS } from "../engine/source";
import { bramMain, pipMain } from "./main";
import { bramKule, bramMont, bramSlip, offstage, pipKule } from "./plates";
import { inReel } from "./tools";

/**
 * The whole source performance on one master timeline: each reel's tracks lifted into master time
 * and summed (every reel track is 0 outside its reel). Pure data; RiggedCharacter samples it.
 */
function merge(parts: Track[][]): Track[] {
  return parts.flat().filter((t) => t.keys.length > 0);
}

export const BRAM_CLIP: AnimClip = {
  character: "bram",
  tracks: merge([inReel("main", bramMain), inReel("kule", bramKule), inReel("slip", bramSlip), inReel("mont", bramMont)]),
};

export const PIP_CLIP: AnimClip = {
  character: "pip",
  tracks: merge([inReel("main", pipMain), inReel("kule", pipKule), inReel("slip", offstage("pip", REELS.slip.length)), inReel("mont", offstage("pip", REELS.mont.length))]),
};
