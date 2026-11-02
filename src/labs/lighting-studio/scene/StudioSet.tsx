"use client";

import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from "three";
import { studio } from "../config";
import { applyCycShader } from "./grade";

/** Profile of the sweep in (z, y): floor → quarter-circle cove → back wall. */
function cycProfile(): [number, number][] {
  const { frontZ, coveZ, coveRadius: r, topY } = studio.cyc;
  const pts: [number, number][] = [];
  const floorSteps = 24;
  for (let i = 0; i <= floorSteps; i++) pts.push([frontZ + ((coveZ - frontZ) * i) / floorSteps, 0]);
  const arc = 24;
  for (let i = 1; i <= arc; i++) {
    const a = (i / arc) * (Math.PI / 2);
    pts.push([coveZ - Math.sin(a) * r, r - Math.cos(a) * r]);
  }
  const wall = 12;
  for (let i = 1; i <= wall; i++) pts.push([coveZ - r, r + ((topY - r) * i) / wall]);
  return pts;
}

function cycGeometry(): BufferGeometry {
  const prof = cycProfile();
  const xs = 32;
  const hw = studio.cyc.halfWidth;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < prof.length; j++) {
    for (let i = 0; i <= xs; i++) pos.push(-hw + (2 * hw * i) / xs, prof[j][1], prof[j][0]);
  }
  const row = xs + 1;
  for (let j = 0; j < prof.length - 1; j++) {
    for (let i = 0; i < xs; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const cycMaterial = new MeshStandardMaterial({ color: studio.cyc.color, roughness: 0.94, metalness: 0 });
applyCycShader(cycMaterial);

/** The seamless studio sweep. Receives shadows; casts none. */
export function StudioSet() {
  const geo = useMemo(() => cycGeometry(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh name="cyclorama" geometry={geo} material={cycMaterial} receiveShadow />;
}
