"use client";

import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferGeometry, Color, DoubleSide, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, NormalBlending, PlaneGeometry, Quaternion, Vector3, type Texture } from "three";
import { LAYER_TECH } from "@/scene/layers";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { painterly } from "../config";
import { cardTextures } from "../render/textures";
import { ptStore } from "../store";
import { scene3d } from "./scene3d";

type V3 = readonly [number, number, number];

export interface CardSpec {
  id: string;
  label: string;
  kind: "shaft" | "smoke" | "glint" | "scratch";
  size: [number, number];
  position: V3;
  /** Optional explicit normal (flat cards on the set); otherwise the card faces the shot camera. */
  normal?: V3;
  /** Extra rotation about the card's own normal, radians. */
  roll?: number;
  color: string;
  opacity: number;
  additive: boolean;
  /** Smoke: rise and fade over its life, phase in seconds. */
  phase?: number;
}

/** The 2D overlays, in compositing order (back to front). */
export const CARDS: CardSpec[] = [
  { id: "scratch-wall", label: "Scratches · back wall", kind: "scratch", size: [1.7, 0.85], position: [-1.55, 1.15, -5.47], normal: [0, 0, 1], color: "#ffffff", opacity: 0.8, additive: false },
  { id: "scratch-floor", label: "Scratches · floorboards", kind: "scratch", size: [2.2, 1.1], position: [-0.5, 0.03, -1.05], normal: [0, 1, 0], roll: 0.2, color: "#ffffff", opacity: 0.75, additive: false },
  { id: "shaft", label: "Light shaft · moonlight", kind: "shaft", size: [1.25, 3.0], position: [0.25, 1.35, -4.6], roll: -0.42, color: "#9fbfff", opacity: 0.55, additive: true },
  { id: "smoke-a", label: "Smoke wisp · solder", kind: "smoke", size: [0.42, 0.7], position: [0.3, 1.38, -2.2], color: "#d8d2c8", opacity: 0.55, additive: true, phase: 0 },
  { id: "smoke-b", label: "Smoke wisp · solder", kind: "smoke", size: [0.36, 0.62], position: [0.36, 1.42, -2.25], color: "#cfd4dc", opacity: 0.45, additive: true, phase: 3 },
  { id: "glint-lamp", label: "Painted highlight · desk lamp", kind: "glint", size: [0.38, 0.38], position: [0.25, 1.3, -2.3], color: "#ffd9a0", opacity: 0.7, additive: true },
  { id: "glint-bulb", label: "Painted highlight · bulb", kind: "glint", size: [0.62, 0.62], position: [0.65, 2.02, -1.3], color: "#ffcf8f", opacity: 0.7, additive: true },
  { id: "glint-window", label: "Painted highlight · moonlit pane", kind: "glint", size: [0.55, 0.55], position: [0.62, 2.38, -5.5], color: "#b8d0ff", opacity: 0.55, additive: true },
];

const tmpV = new Vector3();
const tmpQ = new Quaternion();
const Z = new Vector3(0, 0, 1);

function buildCards() {
    const tex = cardTextures();
    const group = new Group();
    group.name = "painterly-overlays";
    const outlines = new Group();
    outlines.name = "painterly-overlay-outlines";
    const shotPos = new Vector3(...painterly.shot.position);
    const items = CARDS.map((spec, i) => {
      const map: Texture = spec.kind === "shaft" ? tex.shaft : spec.kind === "glint" ? tex.glint : spec.kind === "scratch" ? tex.scratch : tex.smoke[i % 2];
      const geo = new PlaneGeometry(spec.size[0], spec.size[1]);
      const mat = new MeshBasicMaterial({
        map,
        color: new Color(spec.color),
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        blending: spec.additive ? AdditiveBlending : NormalBlending,
        side: DoubleSide,
        fog: false,
        toneMapped: true,
      });
      const mesh = new Mesh(geo, mat);
      mesh.userData.ptSkip = true;
      mesh.renderOrder = 10 + i;
      mesh.position.set(...spec.position);
      const n = spec.normal ? new Vector3(...spec.normal) : shotPos.clone().sub(mesh.position).setY(0).normalize();
      mesh.quaternion.setFromUnitVectors(Z, n);
      if (spec.roll) mesh.quaternion.multiply(tmpQ.setFromAxisAngle(Z, spec.roll));
      if (spec.normal) mesh.position.addScaledVector(n, 0.006);
      group.add(mesh);
      const edges = new LineSegments(new EdgesGeometry(geo) as BufferGeometry, new LineBasicMaterial({ color: "#f3c98b", transparent: true, opacity: 0.9, depthTest: false }));
      edges.layers.set(LAYER_TECH);
      edges.renderOrder = 50;
      edges.userData.ptSkip = true;
      outlines.add(edges);
      return { spec, mesh, edges, base: mesh.position.clone(), explode: 0 };
    });
    return { group, outlines, items, tex };
}

type Built = ReturnType<typeof buildCards>;

/** Per frame: smoke rises and fades; in Inspect (overlays) every card slides toward the observer. */
function updateCards(built: Built, t: number, dt: number) {
    const s = ptStore.getState();
    const exploded = s.section === "look" && s.mode === "inspect" && s.focus === "overlays";
    const toward = scene3d.observer ? tmpV.copy(scene3d.observer.position) : null;
    built.outlines.visible = exploded;
    built.items.forEach((it, i) => {
      const target = exploded ? 1 : 0;
      it.explode += (target - it.explode) * Math.min(1, (dt || 0.016) * 6);
      if (Math.abs(target - it.explode) < 1e-3) it.explode = target;
      it.mesh.position.copy(it.base);
      if (it.spec.kind === "smoke") {
        const life = 3;
        const u = (((t + (it.spec.phase ?? 0)) % life) + life) % life / life;
        it.mesh.position.y += u * 0.55;
        it.mesh.position.x += Math.sin(u * 5 + i) * 0.04;
        it.mesh.scale.setScalar(0.7 + u * 0.6);
        (it.mesh.material as MeshBasicMaterial).opacity = it.spec.opacity * Math.sin(u * Math.PI);
      }
      if (it.explode > 0 && toward) {
        const dir = toward.clone().sub(it.base).normalize();
        it.mesh.position.addScaledVector(dir, it.explode * (0.35 + i * 0.32));
      }
      it.edges.position.copy(it.mesh.position);
      it.edges.quaternion.copy(it.mesh.quaternion);
      it.edges.scale.copy(it.mesh.scale);
    });
}

/**
 * Painted cards composited over the 3D: they exist only in the painted pass. In Inspect (overlays)
 * they slide toward the observer into an exploded view, each with an outline, to show they are flat.
 */
export function Overlays() {
  const built = useMemo(() => buildCards(), []);

  useEffect(() => {
    scene3d.overlays = built.group;
    scene3d.cards = built.items.map((i) => i.mesh);
    return () => {
      scene3d.overlays = null;
      scene3d.cards = [];
      for (const it of built.items) {
        it.mesh.geometry.dispose();
        (it.mesh.material as MeshBasicMaterial).dispose();
        it.edges.geometry.dispose();
        (it.edges.material as LineBasicMaterial).dispose();
      }
      built.tex.shaft.dispose();
      built.tex.glint.dispose();
      built.tex.scratch.dispose();
      built.tex.smoke.forEach((t) => t.dispose());
    };
  }, [built]);

  useFrameUpdater(({ t, dt }) => updateCards(built, t, dt), ORDER.PRESENTATION);

  return (
    <>
      <primitive object={built.group} />
      <primitive object={built.outlines} />
    </>
  );
}
