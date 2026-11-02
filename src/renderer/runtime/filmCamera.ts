import { PerspectiveCamera } from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import type { CameraPose } from "@/engine/projection";
import { LAYER_WORLD } from "@/scene/layers";

/**
 * The virtual cinema camera. One object shared by the shot pass, the frustum, the camera body,
 * measurements and thumbnails. filmGauge 36 at 16:9 gives a 20.25 mm active height.
 */
export const filmCamera = new PerspectiveCamera(22.9, d.aspect, d.clip.near, d.clip.far);
filmCamera.filmGauge = d.gate.widthMm;
filmCamera.layers.set(LAYER_WORLD);
filmCamera.setFocalLength(d.defaultRig.focalMm);

export function syncFilmCamera(pose: CameraPose, focalMm: number) {
  filmCamera.position.copy(pose.position);
  filmCamera.quaternion.copy(pose.quaternion);
  filmCamera.aspect = d.aspect;
  filmCamera.filmGauge = d.gate.widthMm;
  filmCamera.setFocalLength(focalMm);
  filmCamera.updateMatrixWorld(true);
}
