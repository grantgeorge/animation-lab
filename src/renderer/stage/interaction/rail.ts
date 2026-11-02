import { Vector3, type Ray } from "three";

/**
 * Parameter s of the point on line {o + s·d} closest to a ray (both directions unit length).
 * Returns null when the ray runs almost parallel to the line.
 */
export function closestParamOnLine(o: Vector3, d: Vector3, ray: Ray): number | null {
  const w = o.clone().sub(ray.origin);
  const b = d.dot(ray.direction);
  const den = 1 - b * b;
  if (den < 0.02) return null;
  return (b * ray.direction.dot(w) - d.dot(w)) / den;
}
