// Read-only forward-kinematic audit of the shipped Bram skeleton and sampled Doorway clip.
// Usage: node scripts/review/diagnose-wave.mjs [L|R] (defaults to the waving left arm).
import { readFileSync } from "node:fs";
import { Object3D, Vector3, Quaternion, Euler } from "three";
import { createServer } from "vite";

const bytes = readFileSync("public/models/bram.glb");
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const DEG = Math.PI / 180;
const side = process.argv[2] ?? "L";
if (side !== "L" && side !== "R") throw new Error("Choose L or R.");
const boneSide = side === "L" ? "Left" : "Right";
const armOffset = side === "L" ? -18 : 20;
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });

try {
  const { sampleClipSmoothed } = await server.ssrLoadModule("/src/scene/animation/smooth.ts");
  const { doorwayWave } = await server.ssrLoadModule("/src/scene/animation/performances/doorwayWave.ts");
  const clip = doorwayWave.clips.find((c) => c.character === "bram");
  const nodes = gltf.nodes.map((n) => {
    const o = new Object3D();
    o.name = n.name ?? "";
    if (n.matrix) {
      o.matrix.fromArray(n.matrix);
      o.matrix.decompose(o.position, o.quaternion, o.scale);
    } else {
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
    }
    return o;
  });
  gltf.nodes.forEach((n, i) => n.children?.forEach((c) => nodes[i].add(nodes[c])));
  const root = new Object3D();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  const maps = [
    ["pelvis", "Hips", 0, 0, "YXZ"],
    ["torso", "Spine01", 0, 0, "YXZ"],
    ["head", "Head", 0, 0, "YXZ"],
    [`shoulder${side}`, `${boneSide}Shoulder`, 0, 0, "XZY"],
    [`upperArm${side}`, `${boneSide}Arm`, armOffset, 0, "XZY"],
    [`forearm${side}`, `${boneSide}ForeArm`, 0, armOffset, "XZY"],
    [`hand${side}`, `${boneSide}Hand`, 0, armOffset, "XYZ"],
  ];
  const driven = maps.map(([part, name, offsetDeg, frameDeg, order]) => {
    const bone = root.getObjectByName(name);
    const p0 = bone.parent.getWorldQuaternion(new Quaternion());
    return { part, bone, p0, p0inv: p0.clone().invert(), l0: bone.quaternion.clone(), order,
      offset: new Quaternion().setFromEuler(new Euler(0, 0, offsetDeg * DEG)),
      frame: new Quaternion().setFromEuler(new Euler(0, 0, frameDeg * DEG)),
    };
  });
  const point = (name) => root.getObjectByName(name).getWorldPosition(new Vector3());
  const rows = [];
  const times = [...Array.from({ length: 28 }, (_, i) => +(2.8 + i * 0.1).toFixed(2)), 3.66].sort((a, b) => a - b);
  for (const t of times) {
    const pose = sampleClipSmoothed(clip, t, 6);
    for (const d of driven) {
      const p = pose.get(d.part) ?? {};
      const q = new Quaternion().setFromEuler(new Euler((p.rx ?? 0) * DEG, (p.ry ?? 0) * DEG, (p.rz ?? 0) * DEG, d.order));
      q.premultiply(d.frame.clone().invert()).multiply(d.frame).multiply(d.offset);
      d.bone.quaternion.copy(d.p0inv).multiply(q).multiply(d.p0).multiply(d.l0);
    }
    root.updateMatrixWorld(true);
    const shoulder = point(`${boneSide}Arm`), elbow = point(`${boneSide}ForeArm`), wrist = point(`${boneSide}Hand`), head = point("Head");
    const torsoInv = root.getObjectByName("Spine").getWorldQuaternion(new Quaternion()).invert();
    const upper = elbow.clone().sub(shoulder).applyQuaternion(torsoInv).normalize();
    const lower = wrist.clone().sub(elbow).applyQuaternion(torsoInv).normalize();
    const hand = wrist.clone().sub(shoulder).applyQuaternion(torsoInv);
    const r = (v) => +v.toFixed(2);
    rows.push({
      t,
      side,
      shoulderRx: r(pose.get(`upperArm${side}`)?.rx ?? 0),
      elbowRx: r(pose.get(`forearm${side}`)?.rx ?? 0),
      twistRy: r(pose.get(`upperArm${side}`)?.ry ?? 0),
      wristRx: r(pose.get(`hand${side}`)?.rx ?? 0),
      wristRz: r(pose.get(`hand${side}`)?.rz ?? 0),
      elbowBend: r(Math.acos(Math.min(1, Math.max(-1, upper.dot(lower)))) / DEG),
      upperForwardAngle: r(Math.atan2(upper.z, -upper.y) / DEG),
      lowerForwardAngle: r(Math.atan2(lower.z, -lower.y) / DEG),
      handFromShoulder: hand.toArray().map(r),
      handHeadDistance: r(wrist.distanceTo(head)),
    });
  }
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await server.close();
}
