import { expect, test, type Page } from "@playwright/test";
import type { RootState } from "@react-three/fiber";
import { openLab, settle } from "./helpers/lab";

test("Bram's hands clear his coat at rest and return after the wave", async ({ page }) => {
  const { errors } = await openLab(page, "freeze=0&nomotion=1");
  await page.waitForFunction(() => {
    const state = (window as unknown as { __r3f?: RootState }).__r3f;
    return !!state?.scene.getObjectByName("Bram")?.getObjectByName("LeftHand");
  });
  await settle(page);
  const pose = () => page.evaluate(() => {
    const scene = (window as unknown as { __r3f: RootState }).__r3f.scene;
    const bram = scene.getObjectByName("Bram")!;
    // Character-local coordinates remove the scene mark and its starting yaw.
    const p = (name: string) => {
      const bone = bram.getObjectByName(name)!;
      const v = bram.worldToLocal(bone.getWorldPosition(bone.position.clone()));
      return { x: v.x, y: v.y, z: v.z };
    };
    return { left: p("LeftHand"), right: p("RightHand"), shoulderL: p("LeftArm"), shoulderR: p("RightArm") };
  });
  const rest = await pose();
  // Old A-pose corrections put wrists inside the shoulders and both hands over the pelvis.
  expect(rest.left.x - rest.shoulderL.x).toBeGreaterThan(0.04);
  expect(rest.shoulderR.x - rest.right.x).toBeGreaterThan(0.04);
  expect(rest.left.x - rest.right.x).toBeGreaterThan(0.6);

  await page.evaluate(() => window.__animationLab!.getState().seek(3.8));
  await settle(page);
  expect((await pose()).left.y).toBeGreaterThan(rest.left.y + 0.45);

  await page.evaluate(() => window.__animationLab!.getState().seek(5.95));
  await settle(page);
  const end = await pose();
  expect(end.left.x).toBeCloseTo(rest.left.x, 2);
  expect(end.right.x).toBeCloseTo(rest.right.x, 2);
  expect(end.left.y).toBeCloseTo(rest.left.y, 2);
  expect(end.right.y).toBeCloseTo(rest.right.y, 2);
  expect(errors).toEqual([]);
});

/** Inspect the loaded, posed skeleton rather than repeating its authored Euler values. */
async function sampleGreeting(page: Page, times: number[]) {
  return page.evaluate(async (times) => {
    const lab = window.__animationLab!;
    const scene = (window as unknown as { __r3f: RootState }).__r3f.scene;
    const bram = scene.getObjectByName("Bram")!;
    const position = (name: string) => {
      const bone = bram.getObjectByName(name)!;
      return bone.getWorldPosition(bone.position.clone());
    };
    const samples = [];
    for (const t of times) {
      lab.getState().seek(t);
      await lab.settle();
      const shoulder = position("LeftArm");
      const elbow = position("LeftForeArm");
      const wrist = position("LeftHand");
      // An anatomical torso frame follows the turn toward Pip in either scene. Its axes do
      // not depend on the GLB's joint rotation conventions or the character's scene yaw.
      const up = position("Spine02").sub(position("Hips")).normalize();
      const lateral = shoulder.clone().sub(position("RightArm")).normalize();
      const forward = lateral.clone().cross(up).normalize();
      const upper = elbow.clone().sub(shoulder);
      const forearm = wrist.clone().sub(elbow);
      const upperLength = upper.length();
      const forearmLength = forearm.length();
      const bendDeg = Math.acos(Math.max(-1, Math.min(1, upper.clone().normalize().dot(forearm.clone().normalize())))) * 180 / Math.PI;
      const local = (name: string) => bram.worldToLocal(position(name)).toArray();
      samples.push({
        t,
        elbowDrop: -upper.dot(up) / upperLength,
        forearmRise: forearm.dot(up) / forearmLength,
        forearmForward: forearm.dot(forward) / forearmLength,
        wristForward: wrist.clone().sub(shoulder).dot(forward) / (upperLength + forearmLength),
        bendDeg,
        left: local("LeftHand"),
        right: local("RightHand"),
      });
    }
    return samples;
  }, times);
}

for (const scenario of [
  { scene: "doorway", start: 3.15, end: 4.85, holdStart: 3.75, holdEnd: 4.25, recover: 5.95 },
  { scene: "alley", start: 3.2, end: 4.95, holdStart: 3.8, holdEnd: 4.35, recover: 7.99 },
]) {
  test(`${scenario.scene}: Bram's greeting stays open through lift, hold and lower`, async ({ page }, testInfo) => {
    // Exercise the UHD asset in hardware-backed review; the standard suite covers its LOD.
    const quality = testInfo.project.name === "chromium-gpu" ? "high" : "low";
    const { errors } = await openLab(page, `scene=${scenario.scene}&quality=${quality}&freeze=0&nomotion=1`);
    await page.waitForFunction(() => {
      const root = (window as unknown as { __r3f?: RootState }).__r3f?.scene.getObjectByName("Bram");
      return !!root?.getObjectByName("LeftHand");
    });
    const times = [0];
    for (let t = scenario.start; t < scenario.end; t += 0.1) times.push(Number(t.toFixed(2)));
    // Include the reported failure frame, the exact end, and the settled rest pose.
    times.push(3.66, scenario.end, scenario.recover);
    const samples = await sampleGreeting(page, [...new Set(times)].sort((a, b) => a - b));
    const active = samples.filter((s) => s.t >= scenario.start && s.t <= scenario.end);
    for (const s of active) {
      const frame = `${scenario.scene} at ${s.t.toFixed(2)}s`;
      // Keep the upper arm below horizontal; the old overhead pose pinched the coat.
      expect(s.elbowDrop, `${frame}: elbow below shoulder`).toBeGreaterThan(0.08);
      expect(s.bendDeg, `${frame}: no deep elbow fold`).toBeLessThan(110);
      expect(s.forearmForward, `${frame}: forearm does not fold backward`).toBeGreaterThan(0.05);
      expect(s.wristForward, `${frame}: hand remains in front of torso`).toBeGreaterThan(0.1);
      if (s.t >= scenario.holdStart && s.t <= scenario.holdEnd) {
        expect(s.forearmRise, `${frame}: forearm raised`).toBeGreaterThan(0.3);
      }
    }
    const rest = samples[0];
    const recovered = samples.at(-1)!;
    for (const hand of ["left", "right"] as const) {
      expect(Math.hypot(...recovered[hand].map((v, i) => v - rest[hand][i])), `${scenario.scene}: ${hand} hand recovers`).toBeLessThan(0.02);
    }
    expect(errors).toEqual([]);
  });
}

test("Workshop surprise raises the hands while keeping the elbows below the shoulders", async ({ page }) => {
  const { errors } = await openLab(page, "scene=workshop&freeze=3.25&nomotion=1");
  await page.waitForFunction(() => {
    const state = (window as unknown as { __r3f?: RootState }).__r3f;
    return !!state?.scene.getObjectByName("Bram")?.getObjectByName("LeftHand");
  });
  await settle(page);
  const arms = await page.evaluate(() => {
    const scene = (window as unknown as { __r3f: RootState }).__r3f.scene;
    const bram = scene.getObjectByName("Bram")!;
    const y = (name: string) => {
      const bone = bram.getObjectByName(name)!;
      return bram.worldToLocal(bone.getWorldPosition(bone.position.clone())).y;
    };
    return ["Left", "Right"].map((side) => ({
      shoulder: y(`${side}Arm`), elbow: y(`${side}ForeArm`), wrist: y(`${side}Hand`),
    }));
  });
  for (const arm of arms) {
    // The earlier extreme shoulder lift collapsed the coat's underarms. The reaction now
    // reads through open palms, bent elbows, the head turn and the hop.
    expect(arm.shoulder - arm.elbow).toBeGreaterThan(0.14);
    expect(arm.wrist - arm.elbow).toBeGreaterThan(0.15);
  }
  expect(errors).toEqual([]);
});
