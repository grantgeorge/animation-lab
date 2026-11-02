"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Camera } from "three";
import { LAYER_TECH } from "@/scene/layers";
import { live } from "../runtime/live";

/** The orchestrator calls this right before it renders the stage view. */
export const vizHooks: { update: null | (() => void) } = { update: null };

const MAX_CAMS = 4;
const MAX_PATH = 72;
const NDC: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Frustum corners drawn out to `length` metres of view depth (works for perspective and orthographic). */
function frustumPoints(cam: Camera, length: number, out: Float32Array) {
  const near: Vector3[] = [];
  const far: Vector3[] = [];
  for (const [x, y] of NDC) {
    const n = new Vector3(x, y, -1).applyMatrix4(cam.projectionMatrixInverse);
    const f = new Vector3(x, y, 1).applyMatrix4(cam.projectionMatrixInverse);
    // Measured from the near plane, so orthographic twins (pulled back for clipping) draw a box of `length`.
    const k = length / (-f.z - -n.z);
    near.push(n.clone().applyMatrix4(cam.matrixWorld));
    far.push(n.clone().lerp(f, Math.max(0, k)).applyMatrix4(cam.matrixWorld));
  }
  let i = 0;
  const put = (a: Vector3, b: Vector3) => {
    out[i++] = a.x; out[i++] = a.y; out[i++] = a.z;
    out[i++] = b.x; out[i++] = b.y; out[i++] = b.z;
  };
  for (let k = 0; k < 4; k++) {
    put(near[k], near[(k + 1) % 4]);
    put(far[k], far[(k + 1) % 4]);
    put(near[k], far[k]);
  }
}

/** Technical overlays only the stage observer sees: camera bodies, frustums, paths, the focus plane. */
export function Viz() {
  const rig = useMemo(() => {
    const root = new Group();
    const cams = Array.from({ length: MAX_CAMS }, () => {
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(new Float32Array(24 * 3), 3));
      const lines = new LineSegments(geo, new LineBasicMaterial({ transparent: true, opacity: 0.9, toneMapped: false }));
      const body = new Mesh(new BoxGeometry(0.16, 0.11, 0.24), new MeshBasicMaterial({ toneMapped: false }));
      root.add(lines, body);
      return { lines, body };
    });
    const mkPath = (color: string, opacity: number) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(new Float32Array(MAX_PATH * 3), 3));
      const l = new Line(g, new LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false }));
      root.add(l);
      return l;
    };
    const path = mkPath("#ff8fb1", 0.95);
    const pathPhysical = mkPath("#5fe3ff", 0.7);
    const focus = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: "#8ef0c3", transparent: true, opacity: 0.16, side: DoubleSide, depthWrite: false, toneMapped: false }));
    root.add(focus);
    root.traverse((o) => {
      o.layers.set(LAYER_TECH);
      o.castShadow = false;
      o.frustumCulled = false;
    });
    return { root, cams, path, pathPhysical, focus };
  }, []);

  useEffect(() => {
    const color = new Color();
    vizHooks.update = () => {
      const v = live.viz;
      rig.cams.forEach((c, i) => {
        const vc = v.cams[i];
        c.lines.visible = c.body.visible = !!vc;
        if (!vc) return;
        vc.camera.updateMatrixWorld();
        const attr = c.lines.geometry.getAttribute("position") as Float32BufferAttribute;
        frustumPoints(vc.camera, vc.length, attr.array as Float32Array);
        attr.needsUpdate = true;
        c.lines.geometry.computeBoundingSphere();
        color.set(vc.color);
        (c.lines.material as LineBasicMaterial).color.copy(color);
        (c.body.material as MeshBasicMaterial).color.copy(color);
        // Orthographic twins are pulled back for clipping; draw the body where the lens "is".
        c.body.position.copy(vc.camera.position);
        if (vc.camera.type === "OrthographicCamera") c.body.position.copy(new Vector3(0, 0, -(vc.camera as unknown as { near: number }).near + 0.05).applyMatrix4(vc.camera.matrixWorld));
        c.body.quaternion.copy(vc.camera.quaternion);
      });
      const setPath = (line: Line, pts: readonly (readonly [number, number, number])[]) => {
        line.visible = pts.length > 1;
        const a = line.geometry.getAttribute("position") as Float32BufferAttribute;
        const n = Math.min(MAX_PATH, pts.length);
        for (let i = 0; i < n; i++) a.setXYZ(i, pts[i][0], pts[i][1], pts[i][2]);
        a.needsUpdate = true;
        line.geometry.setDrawRange(0, n);
        line.geometry.computeBoundingSphere();
      };
      setPath(rig.path, v.path);
      setPath(rig.pathPhysical, v.pathPhysical);
      const fp = v.focusPlane;
      rig.focus.visible = !!fp;
      if (fp) {
        const cam = fp.camera as unknown as { fov: number; aspect: number };
        const h = 2 * fp.distance * Math.tan((cam.fov * Math.PI) / 360);
        rig.focus.scale.set(h * cam.aspect, h, 1);
        rig.focus.position.copy(new Vector3(0, 0, -fp.distance).applyMatrix4(fp.camera.matrixWorld));
        rig.focus.quaternion.copy(fp.camera.quaternion);
      }
    };
    return () => {
      vizHooks.update = null;
    };
  }, [rig]);

  return <primitive object={rig.root} />;
}
