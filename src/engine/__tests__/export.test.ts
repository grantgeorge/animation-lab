import { Matrix4, Quaternion } from "three";
import { describe, expect, it } from "vitest";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { quaternionFromYawPitch } from "../projection";
import { toBlenderLocation, toBlenderRotation, toUnrealLocation, toUnrealRotator } from "../export/engines";
import { buildShotExport } from "../export/build";
import { measure } from "../measure";
import { promptPhrase } from "../export/prompt";
import { DEG } from "../math";

describe("engine conversions", () => {
  it("default pose → Blender (−0.35, 0, 1.47) rot (90, 0, 0); Unreal (0, −35, 147) rot 0", () => {
    const q = new Quaternion();
    expect(toBlenderLocation([-0.35, 1.47, 0]).map((x) => x + 0)).toEqual([-0.35, -0, 1.47].map((x) => x + 0));
    const br = toBlenderRotation(q);
    expect(br[0]).toBeCloseTo(90, 9);
    expect(br[1]).toBeCloseTo(0, 9);
    expect(br[2]).toBeCloseTo(0, 9);
    expect(toUnrealLocation([-0.35, 1.47, 0]).map((x) => x + 0)).toEqual([0, -35, 147]);
    expect(toUnrealRotator(q)).toEqual({ pitch: 0, yaw: 0, roll: 0 });
  });

  it("yaw-only (camera looking −X): Blender rot (90, 0, 90), Unreal yaw −90", () => {
    const q = quaternionFromYawPitch(-90, 0);
    const br = toBlenderRotation(q);
    expect(br[0]).toBeCloseTo(90, 6);
    expect(br[1]).toBeCloseTo(0, 6);
    expect(br[2]).toBeCloseTo(90, 6);
    expect(toUnrealRotator(q).yaw).toBeCloseTo(-90, 6);
  });

  it("pitch-only −10.39°: Blender rot (79.61, 0, 0), Unreal pitch −10.39", () => {
    const q = quaternionFromYawPitch(0, -10.39);
    expect(toBlenderRotation(q)[0]).toBeCloseTo(79.61, 6);
    expect(toUnrealRotator(q).pitch).toBeCloseTo(-10.39, 6);
  });

  it("Blender Euler reconstructs Rz·Ry·Rx == Rx(90)·R for arbitrary yaw/pitch (guards the 'ZYX' order)", () => {
    for (const [y, p] of [
      [23, -11],
      [-140, 35],
      [7, 2],
    ]) {
      const q = quaternionFromYawPitch(y, p);
      const [ax, ay, az] = toBlenderRotation(q).map((a) => a * DEG);
      const rebuilt = new Matrix4().makeRotationZ(az).multiply(new Matrix4().makeRotationY(ay)).multiply(new Matrix4().makeRotationX(ax));
      const want = new Matrix4().makeRotationX(Math.PI / 2).multiply(new Matrix4().makeRotationFromQuaternion(q));
      rebuilt.elements.forEach((e, k) => expect(e).toBeCloseTo(want.elements[k], 9));
    }
  });
});

describe("shot export and prompt phrase", () => {
  it("default shot reads as a medium shot with natural perspective", () => {
    const m = measure(d, d.defaultRig, "primary");
    expect(promptPhrase(m).phrase).toBe(
      "Medium shot of Bram, 50 mm normal lens, eye level, camera 3.0 m from Bram, natural perspective, locked-off static shot.",
    );
  });

  it("export carries every field the spec requires", () => {
    const m = measure(d, d.defaultRig, "primary", { timeS: 2.45 });
    const x = buildShotExport(d, d.defaultRig, "fixed", "primary", m, { timeS: 2.45, now: new Date(0) });
    expect(x.schemaVersion).toBe("animation-lab.shot/1");
    expect(x.camera.position).toEqual([-0.35, 1.47, 0]);
    expect(x.lens.focalLengthMm).toBe(50);
    expect(x.sensor).toEqual({ fit: "horizontal", gateWidthMm: 36, gateHeightMm: 20.25 });
    expect(x.frame.aspectLabel).toBe("16:9");
    expect(x.subject.id).toBe("primary");
    expect(x.animation.frame).toBe(59);
    expect(x.coordinateSystem.units).toBe("meters");
    expect(x.engines.unreal.locationCm).toEqual([0, -35, 147]);
    expect(JSON.parse(JSON.stringify(x))).toEqual(x);
  });
});
