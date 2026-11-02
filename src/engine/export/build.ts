import { Vector3 } from "three";
import type { CameraMode, CameraRig, SceneDescriptor, TargetId } from "../types";
import type { Measurements } from "../measure";
import { anchorFor, poseFromRig } from "../rig";
import { promptPhrase, type PromptParts } from "./prompt";
import { toBlenderLocation, toBlenderRotation, toUnrealLocation, toUnrealRotator } from "./engines";

export const SHOT_SCHEMA_VERSION = "animation-lab.shot/1" as const;

export interface ShotExportV1 {
  schemaVersion: typeof SHOT_SCHEMA_VERSION;
  meta: { app: "animation-lab"; labId: "lens-and-framing"; exportedAt: string };
  coordinateSystem: {
    engine: "three.js";
    handedness: "right";
    up: "+Y";
    units: "meters";
    cameraLooksAlong: "-Z";
    blenderMap: "(x, -z, y)";
    unrealMap: "100 * (-z, x, y)";
  };
  frame: { aspect: number; aspectLabel: "16:9"; width: 1920; height: 1080 };
  sensor: { fit: "horizontal"; gateWidthMm: number; gateHeightMm: number };
  lens: { focalLengthMm: number; hFovDeg: number; vFovDeg: number; lensClass: string };
  camera: {
    mode: CameraMode;
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
    quaternion: [number, number, number, number];
    yawDeg: number;
    pitchDeg: number;
    rollDeg: 0;
  };
  clip: { nearM: number; farM: number };
  framing: { rig: { railS: number; yawDeg: number; pitchDeg: number }; targetId: TargetId };
  subject: { id: TargetId; name: string; anchor: [number, number, number]; distanceM: number };
  derived: {
    distanceToPrimaryM: number;
    frameWidthAtSubjectM: number;
    frameHeightAtSubjectM: number;
    subjectFrameFraction: number;
    bodyFrameFraction: number;
    kRatio: number;
  };
  classification: { shotSize: string; lensClass: string; angle: string; perspective: string; movement: "static" };
  prompt: { phrase: string; parts: PromptParts };
  engines: {
    blender: {
      location: [number, number, number];
      rotationEulerDeg: [number, number, number];
      rotationMode: "XYZ";
      lensMm: number;
      sensorFit: "HORIZONTAL";
      sensorWidthMm: number;
      sensorHeightMm: number;
      clipStart: number;
      clipEnd: number;
    };
    unreal: {
      locationCm: [number, number, number];
      rotator: { pitch: number; yaw: number; roll: number };
      filmback: { sensorWidthMm: number; sensorHeightMm: number };
      currentFocalLengthMm: number;
      lensSettings: { minFocalLengthMm: number; maxFocalLengthMm: number };
    };
  };
  animation: { timeSeconds: number; loopDurationSeconds: number; clipId: string; frameRate: number; frame: number };
}

const r = (x: number, n = 6) => Number(x.toFixed(n)) + 0; // + 0 turns −0 into 0
const v3 = (v: Vector3): [number, number, number] => [r(v.x), r(v.y), r(v.z)];

export function buildShotExport(
  d: SceneDescriptor,
  rig: CameraRig,
  mode: CameraMode,
  target: TargetId,
  m: Measurements,
  opts: { timeS: number; clipId?: string; now?: Date },
): ShotExportV1 {
  const pose = poseFromRig(d, rig);
  const q = pose.quaternion;
  const forward = new Vector3(0, 0, -1).applyQuaternion(q);
  const up = new Vector3(0, 1, 0).applyQuaternion(q);
  const anchor = anchorFor(d, target);
  const prompt = promptPhrase(m);
  const position = v3(pose.position);
  const blenderRot = toBlenderRotation(q);
  const fps = d.timeline.fps;
  return {
    schemaVersion: SHOT_SCHEMA_VERSION,
    meta: { app: "animation-lab", labId: "lens-and-framing", exportedAt: (opts.now ?? new Date()).toISOString() },
    coordinateSystem: {
      engine: "three.js",
      handedness: "right",
      up: "+Y",
      units: "meters",
      cameraLooksAlong: "-Z",
      blenderMap: "(x, -z, y)",
      unrealMap: "100 * (-z, x, y)",
    },
    frame: { aspect: r(d.aspect), aspectLabel: "16:9", width: 1920, height: 1080 },
    sensor: { fit: "horizontal", gateWidthMm: d.gate.widthMm, gateHeightMm: d.gate.heightMm },
    lens: { focalLengthMm: r(rig.focalMm, 3), hFovDeg: r(m.hfovDeg, 3), vFovDeg: r(m.vfovDeg, 3), lensClass: m.lensClass },
    camera: {
      mode,
      position,
      target: [anchor[0], anchor[1], anchor[2]],
      up: v3(up),
      forward: v3(forward),
      quaternion: [r(q.x), r(q.y), r(q.z), r(q.w)],
      yawDeg: r(rig.yawDeg, 4),
      pitchDeg: r(rig.pitchDeg, 4),
      rollDeg: 0,
    },
    clip: { nearM: d.clip.near, farM: d.clip.far },
    framing: { rig: { railS: r(rig.railS), yawDeg: r(rig.yawDeg, 4), pitchDeg: r(rig.pitchDeg, 4) }, targetId: target },
    subject: { id: target, name: m.targetName, anchor: [anchor[0], anchor[1], anchor[2]], distanceM: r(m.distanceM, 4) },
    derived: {
      distanceToPrimaryM: r(m.distanceToPrimaryM, 4),
      frameWidthAtSubjectM: r(m.frameWidthAtSubjectM, 4),
      frameHeightAtSubjectM: r(m.frameHeightAtSubjectM, 4),
      subjectFrameFraction: r(m.subjectFraction, 4),
      bodyFrameFraction: r(m.bodyFraction, 4),
      kRatio: r(m.kRatio, 4),
    },
    classification: { shotSize: m.shotSize, lensClass: m.lensClass, angle: m.angle, perspective: m.perspective, movement: "static" },
    prompt,
    engines: {
      blender: {
        location: toBlenderLocation(position).map((x) => r(x)) as [number, number, number],
        rotationEulerDeg: blenderRot.map((x) => r(x, 4)) as [number, number, number],
        rotationMode: "XYZ",
        lensMm: r(rig.focalMm, 3),
        sensorFit: "HORIZONTAL",
        sensorWidthMm: d.gate.widthMm,
        sensorHeightMm: d.gate.heightMm,
        clipStart: d.clip.near,
        clipEnd: d.clip.far,
      },
      unreal: {
        locationCm: toUnrealLocation(position).map((x) => r(x, 3)) as [number, number, number],
        rotator: (() => {
          const u = toUnrealRotator(q);
          return { pitch: r(u.pitch, 4), yaw: r(u.yaw, 4), roll: r(u.roll, 4) };
        })(),
        filmback: { sensorWidthMm: d.gate.widthMm, sensorHeightMm: d.gate.heightMm },
        currentFocalLengthMm: r(rig.focalMm, 3),
        lensSettings: { minFocalLengthMm: d.focal.min, maxFocalLengthMm: d.focal.max },
      },
    },
    animation: {
      timeSeconds: r(opts.timeS, 4),
      loopDurationSeconds: d.timeline.durationS,
      clipId: opts.clipId ?? "doorway-wave-v1",
      frameRate: fps,
      frame: Math.round(opts.timeS * fps),
    },
  };
}
