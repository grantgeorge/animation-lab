import { PerspectiveCamera, Vector3 } from "three";
import { studio, vfovDeg, type ShotSize } from "../config";

export const FILM_ASPECT = 16 / 9;

/** Fit the film gate without changing its composition when the surrounding panel resizes. */
export function fitFilmViewport(width: number, height: number) {
  const h = Math.min(height, width / FILM_ASPECT);
  const w = h * FILM_ASPECT;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/** Last actual film-camera viewport, in canvas pixels (used by the opt-in test hook). */
export const filmViewport = { x: 0, y: 0, width: 0, height: 0 };

/** The film camera: what the "shot" view shows. Eases between shot sizes. */
export const filmCamera = new PerspectiveCamera(vfovDeg(studio.shots.medium.focalMm), FILM_ASPECT, 0.1, 80);
filmCamera.name = "film-camera";

const cur = {
  pos: new Vector3(...studio.shots.medium.position),
  target: new Vector3(...studio.shots.medium.target),
  fov: vfovDeg(studio.shots.medium.focalMm),
};
const goalPos = new Vector3();
const goalTarget = new Vector3();

export function updateFilmCamera(shot: ShotSize, dt: number, instant: boolean): boolean {
  const s = studio.shots[shot];
  goalPos.set(...s.position);
  goalTarget.set(...s.target);
  const goalFov = vfovDeg(s.focalMm);
  const k = instant ? 1 : 1 - Math.exp(-dt / 0.16);
  cur.pos.lerp(goalPos, k);
  cur.target.lerp(goalTarget, k);
  cur.fov += (goalFov - cur.fov) * k;
  const moving = cur.pos.distanceToSquared(goalPos) > 1e-7 || Math.abs(goalFov - cur.fov) > 1e-3;
  if (!moving) {
    cur.pos.copy(goalPos);
    cur.target.copy(goalTarget);
    cur.fov = goalFov;
  }
  filmCamera.position.copy(cur.pos);
  filmCamera.lookAt(cur.target);
  filmCamera.fov = cur.fov;
  filmCamera.aspect = FILM_ASPECT;
  filmCamera.updateProjectionMatrix();
  filmCamera.updateMatrixWorld();
  return moving;
}
