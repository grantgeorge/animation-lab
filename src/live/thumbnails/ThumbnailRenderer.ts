import {
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { solveMatchedFraming } from "@/engine/matchFraming";
import { poseFromRig } from "@/engine/rig";
import type { CameraRig, CameraMode, MatchRef, TargetId } from "@/engine/types";
import { LAYER_WORLD } from "@/scene/layers";
import { viewports } from "@/renderer/runtime/viewports";
import { presentation } from "@/renderer/runtime/presentation";

const W = 256;
const H = 144;

/**
 * Lens-preset previews: the same scene, the same animation time, rendered through each preset.
 * Each preset renders into its own small multisampled target; every frame the cached targets are
 * blitted (tone-mapped) into the filmstrip's transparent tile windows.
 */
export class ThumbnailRenderer {
  private targets = d.focal.presets.map(() => new WebGLRenderTarget(W, H, { type: HalfFloatType, samples: 4 }));
  private cam = new PerspectiveCamera(30, d.aspect, d.clip.near, d.clip.far);
  private dirty = new Set<number>(d.focal.presets.map((_, i) => i));
  private next = 0;
  private poses: CameraRig[] = [];
  private posesKey = "";
  private lastSig = "";
  private blitScene = new Scene();
  private blitCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blitMat = new MeshBasicMaterial({ depthTest: false, depthWrite: false });
  private blitMesh = new Mesh(new PlaneGeometry(2, 2), this.blitMat);

  constructor() {
    this.cam.filmGauge = d.gate.widthMm;
    this.cam.layers.set(LAYER_WORLD);
    this.blitScene.add(this.blitMesh);
  }

  markAllDirty() {
    d.focal.presets.forEach((_, i) => this.dirty.add(i));
  }

  get isDirty() {
    return this.dirty.size > 0;
  }

  /** Where each preset camera stands: the current position (Fixed) or its matched position (Match). */
  private updatePoses(rig: CameraRig, mode: CameraMode, target: TargetId, ref: MatchRef | null, version: number) {
    const key = `${version}|${mode}|${target}`;
    if (key === this.posesKey && mode === "fixed" && this.poses.length) {
      // Fixed mode follows the eased camera so the strip moves with a dolly drag
      this.poses = d.focal.presets.map((f) => ({ railS: presentation.railS, yawDeg: presentation.yawDeg, pitchDeg: presentation.pitchDeg, focalMm: f }));
      return;
    }
    if (key === this.posesKey) return;
    this.posesKey = key;
    this.poses = d.focal.presets.map((f) =>
      mode === "match" && ref ? solveMatchedFraming(d, rig, target, ref, f).rig : { railS: presentation.railS, yawDeg: presentation.yawDeg, pitchDeg: presentation.pitchDeg, focalMm: f },
    );
    this.markAllDirty();
  }

  render(gl: WebGLRenderer, scene: Scene, state: { rig: CameraRig; mode: CameraMode; target: TargetId; ref: MatchRef | null; version: number; playing: boolean; t: number }) {
    this.updatePoses(state.rig, state.mode, state.target, state.ref, state.version);
    const sig = `${scene.userData.thumbnailContentRevision ?? 0}|${state.t.toFixed(4)}|${presentation.railS.toFixed(4)}|${presentation.yawDeg.toFixed(3)}|${presentation.pitchDeg.toFixed(3)}`;
    if (sig !== this.lastSig || state.playing) this.markAllDirty();
    this.lastSig = sig;
    // budget: one preset per frame while playing, two when paused until clean
    const budget = state.playing ? 1 : 2;
    let done = 0;
    for (let k = 0; k < d.focal.presets.length && done < budget; k++) {
      const i = (this.next + k) % d.focal.presets.length;
      if (!this.dirty.has(i) || !viewports.get(`thumb:${i}`)) continue;
      const pose = poseFromRig(d, this.poses[i]);
      this.cam.position.copy(pose.position);
      this.cam.quaternion.copy(pose.quaternion);
      this.cam.aspect = d.aspect;
      this.cam.setFocalLength(this.poses[i].focalMm);
      this.cam.updateMatrixWorld(true);
      gl.setRenderTarget(this.targets[i]);
      gl.setScissorTest(false);
      gl.render(scene, this.cam);
      this.dirty.delete(i);
      this.next = (i + 1) % d.focal.presets.length;
      done++;
    }
    gl.setRenderTarget(null);
  }

  /** Draw every cached preset into its tile window on the canvas. */
  blit(gl: WebGLRenderer) {
    gl.setRenderTarget(null);
    gl.setScissorTest(true);
    for (let i = 0; i < d.focal.presets.length; i++) {
      const r = viewports.get(`thumb:${i}`);
      if (!r || r.gl.w < 2) continue;
      gl.setViewport(r.gl.x, r.gl.y, r.gl.w, r.gl.h);
      gl.setScissor(r.gl.x, r.gl.y, r.gl.w, r.gl.h);
      this.blitMat.map = this.targets[i].texture;
      this.blitMat.needsUpdate = true;
      gl.render(this.blitScene, this.blitCam);
    }
  }

  dispose() {
    this.targets.forEach((t) => t.dispose());
    this.blitMat.dispose();
    this.blitMesh.geometry.dispose();
  }
}
