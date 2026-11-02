import { getCamera, type CameraId, type CameraSpec } from "./cameras";
import { cocMm, cropFactor, FORMATS, shotGate, type Format, type Gate } from "./formats";
import { curveUniforms, headroomStops, LOOKS, type Look, type LookId } from "./looks";
import { blurInCoc, classifyDof, depthOfField, ffEquivalentFocal, ffEquivalentStop, hfovDeg, vfovDeg, type DofBand, type DofClass } from "./optics";
import { buildPrompt } from "./prompt";
import { markDepth, MARKS, subjectWidthFraction, type MarkId } from "./shot";
import { exposureS, panBlurFraction, panPeakSpeedDegS, shutterSpeedLabel, skewDeg, ILLUSTRATIVE_READOUT_S } from "./shutter";

export interface ShotInput {
  cameraId: CameraId;
  openGate: boolean;
  focalMm: number;
  tStop: number;
  focusM: number;
  shutterDeg: number;
  fps: number;
  slowMotion: boolean;
  move: "locked" | "pan";
  lookId: LookId;
}

export interface ShotDerived {
  camera: CameraSpec;
  format: Format;
  gate: Gate;
  crop: number;
  hfov: number;
  vfov: number;
  ffFocal: number;
  ffStop: number;
  coc: number;
  dof: DofBand;
  /** Blur at each mark, in circles of confusion (≤ 1 is sharp). */
  blur: Record<MarkId, number>;
  depth: Record<MarkId, number>;
  dofClass: DofClass;
  subjectFraction: number;
  exposureS: number;
  shutterSpeed: string;
  panBlur: number;
  globalShutter: boolean;
  skewDeg: number;
  look: Look;
  headroom: number;
  prompt: string;
}

const MARK_IDS = Object.keys(MARKS) as MarkId[];

export function deriveShot(s: ShotInput): ShotDerived {
  const camera = getCamera(s.cameraId);
  const format = FORMATS[camera.format];
  const gate = shotGate(format, s.openGate);
  const hfov = hfovDeg(s.focalMm, gate);
  const dof = depthOfField(s.focalMm, s.tStop, s.focusM, gate);
  const depth = {} as Record<MarkId, number>;
  const blur = {} as Record<MarkId, number>;
  for (const id of MARK_IDS) {
    depth[id] = markDepth(id);
    blur[id] = blurInCoc(s.focalMm, s.tStop, s.focusM, depth[id], gate);
  }
  const dofClass = classifyDof(Math.max(blur.wall, blur.pip));
  const look = LOOKS[s.lookId];
  const globalShutter = /global|rotary/i.test(camera.shutter);
  return {
    camera,
    format,
    gate,
    crop: cropFactor(format),
    hfov,
    vfov: vfovDeg(s.focalMm, gate),
    ffFocal: ffEquivalentFocal(s.focalMm, format),
    ffStop: ffEquivalentStop(s.tStop, format),
    coc: cocMm(gate),
    dof,
    blur,
    depth,
    dofClass,
    subjectFraction: subjectWidthFraction(gate, s.focalMm),
    exposureS: exposureS(s.shutterDeg, s.fps),
    shutterSpeed: shutterSpeedLabel(s.shutterDeg, s.fps),
    panBlur: panBlurFraction(panPeakSpeedDegS(), s.shutterDeg, s.fps, hfov),
    globalShutter,
    skewDeg: globalShutter ? 0 : skewDeg(panPeakSpeedDegS(), ILLUSTRATIVE_READOUT_S),
    look,
    headroom: headroomStops(curveUniforms(look)),
    prompt: buildPrompt({ format, film: !!camera.film, focalMm: s.focalMm, tStop: s.tStop, dof: dofClass, shutterDeg: s.shutterDeg, fps: s.fps, slowMotion: s.slowMotion, move: s.move, look }),
  };
}
