"use client";

import { useMemo } from "react";
import { LatheGeometry, Vector2, type Material } from "three";
import { RoundedBox } from "@react-three/drei";

/** Smooth body of revolution from a [radius, y] profile (Catmull-Rom smoothed). */
export function Lathe({
  profile,
  material,
  position,
  scale,
  rotation,
  segments = 36,
}: {
  profile: [number, number][];
  material: Material;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  segments?: number;
}) {
  const geo = useMemo(() => {
    const pts = profile.map(([r, y]) => new Vector2(Math.max(0, r), y));
    // subdivide with a simple Catmull-Rom so silhouettes read as smooth sculpted forms
    const out: Vector2[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push(
          new Vector2(
            0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          ),
        );
      }
    }
    out.push(pts[pts.length - 1]);
    for (const p of out) p.x = Math.max(0, p.x);
    const g = new LatheGeometry(out, segments);
    g.computeVertexNormals();
    return g;
  }, [profile, segments]);
  return <mesh geometry={geo} material={material} position={position} scale={scale} rotation={rotation} castShadow receiveShadow />;
}

export function Capsule({
  r,
  len,
  material,
  position,
  rotation,
  scale,
}: {
  r: number;
  len: number;
  material: Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} material={material} castShadow receiveShadow>
      <capsuleGeometry args={[r, len, 6, 18]} />
    </mesh>
  );
}

export function Ball({
  r,
  material,
  position,
  scale,
  segments = 24,
}: {
  r: number;
  material: Material;
  position?: [number, number, number];
  scale?: [number, number, number];
  segments?: number;
}) {
  return (
    <mesh position={position} scale={scale} material={material} castShadow>
      <sphereGeometry args={[r, segments, Math.round(segments * 0.7)]} />
    </mesh>
  );
}

export function Block({
  size,
  radius = 0.015,
  material,
  position,
  rotation,
}: {
  size: [number, number, number];
  radius?: number;
  material: Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return <RoundedBox args={size} radius={radius} smoothness={3} position={position} rotation={rotation} material={material} castShadow receiveShadow />;
}
