import type { SceneDescriptor } from "@/engine/types";
import { sampleClip, type Clip, type PoseDelta } from "@/scene/animation/dsl";
import type { SubjectFn, SubjectId, SubjectState, Vec3 } from "./types";

/**
 * Where each character is at time t, from the scene's marks and the performance's root channels.
 * Root deltas live in the character's rest-yaw frame (the rig rotates its root group by restYaw),
 * so they are rotated into world space here. Pure: no renderer.
 */
export function makeSubjectFn(d: SceneDescriptor, clips: Record<SubjectId, Clip>): SubjectFn {
  const scratch: PoseDelta = new Map();
  return (id: SubjectId, t: number): SubjectState => {
    const c = d.characters[id];
    const r = sampleClip(clips[id], t, scratch).get("root") ?? {};
    const yaw = ((c.restYawDeg ?? 0) * Math.PI) / 180;
    const px = r.px ?? 0;
    const pz = r.pz ?? 0;
    const py = r.py ?? 0;
    // three's rotation.y = +yaw: x' = x cos + z sin, z' = −x sin + z cos
    const wx = px * Math.cos(yaw) + pz * Math.sin(yaw);
    const wz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
    const feet: Vec3 = [c.root[0] + wx, c.root[1] + py, c.root[2] + wz];
    const anchor: Vec3 = [c.anchor[0] + wx, c.anchor[1] + py, c.anchor[2] + wz];
    return { feet, anchor, heightM: c.landmarks.capTop };
  };
}

/** A subject function for characters that never move (tests and static previews). */
export function staticSubjects(d: SceneDescriptor): SubjectFn {
  return (id) => {
    const c = d.characters[id];
    return { feet: c.root, anchor: c.anchor, heightM: c.landmarks.capTop };
  };
}
