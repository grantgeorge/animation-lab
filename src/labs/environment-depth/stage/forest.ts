import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Points,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import { HERO_TREES, PIP, REF_SPOTS, bushes, distantTrees, ferns, fillTrees, groundY, rng, rocks, type Prop, type Tree } from "../engine/world";
import { baseShot } from "../engine/camera";
import { L } from "../runtime/live";
import { U, decalMaterial, fireflyMaterial, forestMaterial, shaftMaterial, skyMaterial } from "../runtime/shaders";
import {
  bushGeometry,
  cabinGeometry,
  canopyBlob,
  coniferGeometry,
  deerGeometry,
  fenceGeometry,
  fernGeometry,
  groundGeometry,
  merge,
  ridgeGeometry,
  rockGeometry,
  skyGeometry,
  trunkGeometry,
} from "./geometry";

/** The whole forest as plain three objects (built once, imperative, disposed on unmount). */
export interface ForestHandles {
  root: Group;
  fg: Group;
  refs: { cabin: Group; fence: Group; deer: Group };
  shafts: Group;
  pipDecals: Group;
  dispose: () => void;
}

const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const sc = new Vector3();
const Y = new Vector3(0, 1, 0);

function setLayer(o: Object3D, layer: number) {
  o.traverse((c) => c.layers.set(layer));
  return o;
}

function instanced(geo: BufferGeometry, mat: Material, items: readonly Prop[], scale: (p: Prop) => [number, number, number], tint?: (p: Prop) => Color) {
  const mesh = new InstancedMesh(geo, mat, items.length);
  items.forEach((p, i) => {
    q.setFromAxisAngle(Y, p.rot);
    sc.set(...scale(p));
    m4.compose(v.set(p.x, p.y, p.z), q, sc);
    mesh.setMatrixAt(i, m4);
    if (tint) mesh.setColorAt(i, tint(p));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  return mesh;
}

function canopyFor(trees: readonly Tree[]) {
  const items: (Prop & { sy: number })[] = [];
  for (const t of trees) {
    const R = rng(t.seed + 99);
    const n = t.hero ? 10 : 6;
    const gy = groundY(t.x, t.z);
    for (let i = 0; i < n; i++) {
      const h = t.h * (0.7 + 0.3 * (i / (n - 1)) + (R() - 0.5) * 0.04);
      const spread = (t.r * 2.0 + 4.5) * (1 - 0.5 * (i / n)) * (0.45 + R() * 0.55);
      const a = R() * Math.PI * 2;
      const s = (t.hero ? 7.5 : 6) * (0.75 + R() * 0.55) * (1 - 0.35 * (i / n));
      items.push({ x: t.x + Math.cos(a) * spread + t.lean * h, y: gy + h, z: t.z + Math.sin(a) * spread, s, sy: s * (0.7 + R() * 0.3), rot: R() * 6.28, tint: R() });
    }
  }
  return items;
}

/** Shafts of sun slanting down through canopy gaps toward the camera. */
function shafts() {
  const g = new Group();
  const mat = shaftMaterial();
  const sun = U.uSunDir.value.clone();
  const cam = baseShot(24).position;
  const spots: [number, number, number, number][] = [
    [-1.0, -14, 2.6, 1],
    [2.2, -22, 4.2, 0.8],
    [-6.5, -19, 3.2, 0.7],
    [0.4, -36, 5.5, 0.9],
    [7.5, -28, 3.5, 0.6],
    [-3.5, -55, 6.5, 0.8],
    [1.0, -8.5, 1.6, 0.9],
  ];
  for (const [x, z, w, k] of spots) {
    const len = 70;
    const geo = new PlaneGeometry(w, len);
    geo.translate(0, len / 2, 0);
    const mesh = new Mesh(geo, mat.clone());
    (mesh.material as typeof mat).uniforms = { ...U, uStrength: { value: 0.16 * k } };
    const foot = new Vector3(x, groundY(x, z), z);
    mesh.position.copy(foot);
    // Long axis along the sun ray; face the camera around it.
    const axis = sun.clone();
    const toCam = cam.clone().sub(foot);
    const side = new Vector3().crossVectors(axis, toCam).normalize();
    const normal = new Vector3().crossVectors(side, axis).normalize();
    mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(side, axis, normal));
    g.add(mesh);
  }
  return setLayer(g, L.FX) as Group;
}

function fireflies() {
  const R = rng(61);
  const n = 70;
  const pos = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2;
    const d = 1.5 + R() * 14;
    const x = PIP.root[0] + Math.cos(a) * d;
    const z = PIP.root[2] - 3 + Math.sin(a) * d * 1.4;
    pos.set([x, groundY(x, z) + 0.4 + R() * 2.6, z], i * 3);
    phase[i] = R();
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("phase", new BufferAttribute(phase, 1));
  const p = new Points(g, fireflyMaterial());
  p.frustumCulled = false;
  p.layers.set(L.FX);
  return p;
}

export function buildForest(): ForestHandles {
  const root = new Group();
  root.name = "forest";
  const mats = {
    bark: forestMaterial("bark"),
    leaf: forestMaterial("leaf"),
    ground: forestMaterial("ground"),
    rock: forestMaterial("rock"),
    fern: forestMaterial("fern"),
    prop: forestMaterial("prop"),
    far: forestMaterial("far"),
  };
  const fill = fillTrees();
  const trees = [...HERO_TREES, ...fill];

  // Ground: dense near the path, coarse for the valley and hills.
  root.add(new Mesh(groundGeometry(-150, 150, -175, 95, 200, 180), mats.ground));
  root.add(new Mesh(groundGeometry(-2600, 2600, -2000, -168, 130, 70, 0, 0.4), mats.ground));

  // Hero trunks merged into one mesh; the fill forest instanced.
  root.add(
    new Mesh(
      merge(
        HERO_TREES.map((t) => {
          const g = trunkGeometry(t, 40, 32);
          g.translate(t.x, groundY(t.x, t.z), t.z);
          return g;
        }),
      ),
      mats.bark,
    ),
  );
  const unit = trunkGeometry({ r: 1, h: 55, lean: 0, seed: 5 }, 14, 16);
  root.add(
    instanced(
      unit,
      mats.bark,
      fill.map((t) => ({ x: t.x, y: groundY(t.x, t.z), z: t.z, s: t.r, rot: (t.seed % 628) / 100, tint: 0 })),
      (p) => {
        const t = fill.find((f) => f.x === p.x && f.z === p.z)!;
        return [t.r, t.h / 55, t.r];
      },
    ),
  );
  const canopy = instanced(
    canopyBlob(3),
    mats.leaf,
    canopyFor(trees),
    (p) => [p.s, (p as Prop & { sy: number }).sy, p.s],
    (p) => new Color().setHSL(0.24 + p.tint * 0.06, 0.55, 0.42 + p.tint * 0.18).multiplyScalar(1.6),
  );
  canopy.layers.set(L.CANOPY);
  root.add(canopy);

  // Undergrowth.
  root.add(instanced(fernGeometry(), mats.fern, ferns(trees), (p) => [p.s, p.s * 0.9, p.s], (p) => new Color().setHSL(0.25 + p.tint * 0.05, 0.35, 0.42 + p.tint * 0.2).multiplyScalar(1.35)));
  root.add(instanced(rockGeometry(), mats.rock, rocks(), (p) => [p.s * 1.3, p.s, p.s * 1.1]));
  root.add(instanced(bushGeometry(), mats.fern, bushes(trees), (p) => [p.s, p.s * 0.8, p.s], (p) => new Color().setHSL(0.27, 0.35, 0.5 + p.tint * 0.2).multiplyScalar(1.6)));

  // A fallen log beside the path (midground occluder).
  const log = trunkGeometry({ r: 0.75, h: 18, lean: 0, seed: 44 }, 16, 10);
  log.rotateZ(Math.PI / 2);
  log.rotateY(0.35);
  log.translate(-3.6, groundY(-3.6, -31) + 0.6, -31);
  root.add(new Mesh(log, mats.bark));

  // Far: conifers on the hills, three mountain ranges, the sky.
  root.add(instanced(coniferGeometry(), mats.far, distantTrees(), (p) => [p.s * 0.45, p.s, p.s * 0.45]));
  for (const [z, h, seed] of [
    [-1500, 300, 3],
    [-2350, 560, 4],
    [-3400, 900, 5],
  ] as const)
    root.add(new Mesh(ridgeGeometry(z, h, seed), mats.far));
  const c0 = baseShot(24).position;
  const sky = new Mesh(skyGeometry(), skyMaterial());
  sky.position.set(c0.x, 0, c0.z);
  sky.frustumCulled = false;
  root.add(sky);

  // Air: shafts, fireflies, the pool of light Pip stands in, his soft contact shadow.
  const sh = shafts();
  root.add(sh);
  root.add(fireflies());
  const pool = new Mesh(new PlaneGeometry(7, 4.5).rotateX(-Math.PI / 2), decalMaterial("glow"));
  pool.position.set(PIP.root[0] - 0.4, groundY(PIP.root[0], PIP.root[2]) + 0.03, PIP.root[2] - 0.6);
  pool.layers.set(L.FX);
  const pipDecals = new Group();
  pipDecals.add(pool);
  const blob = new Mesh(new PlaneGeometry(0.9, 0.7).rotateX(-Math.PI / 2), decalMaterial("shadow"));
  blob.position.set(PIP.root[0], groundY(PIP.root[0], PIP.root[2]) + 0.02, PIP.root[2]);
  blob.layers.set(L.FX);
  pipDecals.add(blob);
  root.add(pipDecals);

  // Foreground framing set, placed relative to the camera every frame.
  const fg = new Group();
  fg.name = "foreground";
  const fgTrunk = trunkGeometry({ r: 1.25, h: 62, lean: 0.004, seed: 81 }, 40, 30);
  fgTrunk.translate(-4.3, 0, -4.1);
  fg.add(new Mesh(fgTrunk, mats.bark));
  const fgFerns: Prop[] = [
    [1.5, -1.9, 1.25, 0.2],
    [2.5, -2.7, 1.5, 1.4],
    [-1.15, -1.7, 1.15, 2.2],
    [-2.0, -2.5, 1.45, 0.7],
    [0.45, -2.3, 0.9, 3.1],
    [3.4, -3.6, 1.6, 4.0],
    [-3.1, -3.0, 1.3, 5.0],
    [-1.4, -4.6, 1.1, 1.1],
    [2.1, -4.8, 1.2, 2.6],
  ].map(([x, z, s, rot], i) => ({ x, y: 0, z, s, rot, tint: (i * 0.37) % 1 }));
  fg.add(instanced(fernGeometry(11, 8), mats.fern, fgFerns, (p) => [p.s, p.s * 0.95, p.s], (p) => new Color().setHSL(0.27, 0.32, 0.16 + p.tint * 0.06).multiplyScalar(1.0)));
  root.add(fg);

  // Scale references (origin at their feet so scaling keeps them on the ground).
  const ref = (geo: BufferGeometry, spot: { x: number; z: number; rot: number }) => {
    const g = new Group();
    g.position.set(spot.x, groundY(spot.x, spot.z), spot.z);
    g.rotation.y = spot.rot;
    g.add(new Mesh(geo, mats.prop));
    root.add(g);
    return g;
  };
  const refs = { cabin: ref(cabinGeometry(), REF_SPOTS.cabin), fence: ref(fenceGeometry(), REF_SPOTS.fence), deer: ref(deerGeometry(), REF_SPOTS.deer) };

  root.traverse((o) => {
    if (o.layers.mask === 1 && o !== canopy) o.layers.set(L.WORLD);
  });
  return {
    root,
    fg,
    refs,
    shafts: sh,
    pipDecals,
    dispose() {
      root.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    },
  };
}
