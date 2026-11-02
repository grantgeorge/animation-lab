import { PerspectiveCamera } from "three";
import type { SceneDescriptor } from "@/engine/types";
import { aimForNdc, railPosition } from "@/engine/rig";
import { intrinsics, quaternionFromYawPitch } from "@/engine/projection";
import { LAYER_WORLD } from "@/scene/layers";

/**
 * The lab's one camera per shot: the stage rail, pulled back a little from the default mark, on a
 * 32 mm lens aimed at the scene's two-shot anchor. Wide enough to hold both characters and the
 * practical lamps, which is what the glow effects need to show.
 */
export const FRAMING = { railS: -2.4, focalMm: 31, ndc: [0, -0.04] as const };

export function makeShotCamera() {
  const c = new PerspectiveCamera(40, 16 / 9, 0.05, 80);
  c.filmGauge = 36;
  c.layers.set(LAYER_WORLD);
  return c;
}

export function aimShotCamera(c: PerspectiveCamera, d: SceneDescriptor) {
  const pos = railPosition(d, FRAMING.railS);
  const aim = aimForNdc(pos, d.anchors.both, FRAMING.ndc, intrinsics(FRAMING.focalMm, d.gate));
  c.position.copy(pos);
  c.quaternion.copy(quaternionFromYawPitch(aim.yawDeg, aim.pitchDeg));
  c.aspect = 16 / 9;
  c.setFocalLength(FRAMING.focalMm);
  c.updateMatrixWorld();
}
