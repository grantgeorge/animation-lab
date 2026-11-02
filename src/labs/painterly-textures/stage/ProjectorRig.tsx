"use client";

import { useEffect, useMemo } from "react";
import { CameraHelper, Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Vector3 } from "three";
import { LAYER_TECH } from "@/scene/layers";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { painterly } from "../config";
import { offsetPose } from "../engine/projection";
import { resources } from "../render/resources";
import { ptStore } from "../store";
import { scene3d } from "./scene3d";

function poseCamera(cam: PerspectiveCamera, p: { position: readonly number[]; target: readonly number[]; fovDeg: number; aspect: number }, far: number) {
  cam.fov = p.fovDeg;
  cam.aspect = p.aspect;
  cam.near = 0.3;
  cam.far = far;
  cam.position.set(p.position[0], p.position[1], p.position[2]);
  cam.lookAt(new Vector3(p.target[0], p.target[1], p.target[2]));
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

function buildRig() {
    const { matte } = resources();
    const group = new Group();
    group.name = "painterly-projector";
    const projCam = new PerspectiveCamera();
    poseCamera(projCam, painterly.shot, 7.2);
    const helper = new CameraHelper(projCam);
    helper.setColors(new Color("#f3c98b"), new Color("#f3c98b"), new Color("#f3c98b"), new Color("#ffe7c2"), new Color("#7a6a52"));
    helper.update();
    // the painting itself, hung 1.2 m out along the projector's frustum
    const d = 1.2;
    const h = 2 * d * Math.tan((painterly.shot.fovDeg * Math.PI) / 360);
    const plate = new Mesh(new PlaneGeometry(h * painterly.shot.aspect, h), new MeshBasicMaterial({ map: matte, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    plate.position.copy(projCam.position).add(new Vector3(0, 0, -1).applyQuaternion(projCam.quaternion).multiplyScalar(d));
    plate.quaternion.copy(projCam.quaternion);
    const viewCam = new PerspectiveCamera();
    poseCamera(viewCam, painterly.shot, 4.5);
    const viewHelper = new CameraHelper(viewCam);
    viewHelper.setColors(new Color("#8febff"), new Color("#8febff"), new Color("#8febff"), new Color("#8febff"), new Color("#2c5a66"));
    for (const o of [helper, plate, viewHelper]) {
      o.layers.set(LAYER_TECH);
      o.userData.ptSkip = true;
      o.traverse((c) => c.layers.set(LAYER_TECH));
      group.add(o);
    }
    return { group, helper, plate, viewHelper, viewCam };
}

/** Show the rig in Inspect (projection/stack); follow the swung shot camera. */
function updateRig(built: ReturnType<typeof buildRig>) {
    const s = ptStore.getState();
    const show = s.section === "look" && s.mode === "inspect" && (s.focus === "projection" || s.focus === "composite");
    built.group.visible = show;
    built.plate.visible = s.focus === "projection";
    const off = Math.abs(s.projYaw) > 0.5;
    built.viewHelper.visible = show && off;
    if (off) {
      poseCamera(built.viewCam, offsetPose(painterly.shot, painterly.projectorPivot, s.projYaw, Math.abs(s.projYaw) * painterly.projRisePerDeg), 4.5);
      built.viewHelper.update();
    }
}

/**
 * Inspect only (tech layer): the projector's frustum with the matte painting hung inside it, and
 * the shot camera's own frustum once it is swung away from the projector.
 */
export function ProjectorRig() {
  const built = useMemo(() => buildRig(), []);

  useEffect(() => {
    scene3d.projectorRig = built.group;
    return () => {
      scene3d.projectorRig = null;
      built.helper.dispose();
      built.viewHelper.dispose();
      built.plate.geometry.dispose();
      (built.plate.material as MeshBasicMaterial).dispose();
    };
  }, [built]);

  useFrameUpdater(() => updateRig(built), ORDER.PRESENTATION);

  return <primitive object={built.group} />;
}
