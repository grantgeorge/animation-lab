import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Points,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BackSide } from "three";
import type { CategoryId } from "../engine/prompt";
import type { CatState } from "../store";
import { FPS, FRAMES, frameOf, stepped } from "../engine/timing";
import { mulberry32 } from "../engine/rng";
import { FIRE_STRIDE, fireCounts, fireParticles, flameDrawing, flameDrawingAt, smokePuffs } from "../engine/fx/fire";
import { POND, RippleBake, dropAt, keyedDrops, keyedHeight, keyedRings, pebbleImpact, pebbleY, simDrops } from "../engine/fx/ripples";
import { BALL_R, CRATE, CrateBake, HIT_T, keyedCrates, stackLayout, type CrateFrame } from "../engine/fx/crates";
import { ClothBake, FLAG, STICK, keyedFlag, stickAngle } from "../engine/fx/cloth";
import { MAGIC_STRIDE, fireflies, keyedSparkles, sparks, wandTip } from "../engine/fx/magic";
import { BALL, WALL_X, debris, keyedBall, keyedHitTime, simBall, simHitTime, type BallPose } from "../engine/fx/impact";
import { disposeTree, outlineMaterial, toonRamp } from "./materials";

const INK = "#0f2a44";
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpS = new Vector3();
const tmpP = new Vector3();

export interface Demo {
  readonly id: CategoryId;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Pose at time t for these settings; heightPx is the view's pixel height (sprite sizing). */
  update(t: number, s: CatState, heightPx: number): void;
  /** Readouts for Inspect and the tests. */
  stats(): Record<string, number | string>;
  /** Draw an impact frame instead of the picture this frame. */
  flash?: boolean;
  dispose(): void;
}

/* ---------- shared bits ---------- */

const SPRITE_VERT = /* glsl */ `
attribute float aSize;
attribute float aHeat;
attribute float aAlpha;
uniform float uScale;
varying float vHeat;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uScale / -mv.z);
  vHeat = aHeat;
  vAlpha = aAlpha;
}`;

const SPRITE_FRAG = /* glsl */ `
uniform int uMode;
uniform vec3 uTint;
varying float vHeat;
varying float vAlpha;
vec3 fireRamp(float h) {
  vec3 c = mix(vec3(0.35, 0.03, 0.01), vec3(0.95, 0.25, 0.04), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.3, 0.65, h));
  return mix(c, vec3(1.0, 0.95, 0.7), smoothstep(0.65, 1.0, h));
}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  if (uMode == 0) { // realistic fire: soft additive glow
    float a = pow(1.0 - d, 1.8) * vAlpha;
    gl_FragColor = vec4(fireRamp(vHeat) * a * 1.3, a);
  } else if (uMode == 1) { // realistic smoke: soft grey
    float a = pow(1.0 - d, 1.4) * vAlpha;
    gl_FragColor = vec4(vec3(0.32, 0.31, 0.33), a);
  } else if (uMode == 2) { // toon fire: three flat bands and an ink rim
    if (d > 0.8) { gl_FragColor = vec4(0.06, 0.16, 0.27, vAlpha); return; }
    vec3 c = vHeat > 0.62 ? vec3(1.0, 0.9, 0.42) : vHeat > 0.3 ? vec3(1.0, 0.6, 0.12) : vec3(0.91, 0.27, 0.17);
    gl_FragColor = vec4(c, step(0.15, vAlpha));
  } else if (uMode == 3) { // toon smoke puff
    if (d > 0.86) { gl_FragColor = vec4(0.06, 0.16, 0.27, step(0.12, vAlpha)); return; }
    gl_FragColor = vec4(mix(vec3(0.62, 0.62, 0.68), vec3(0.85, 0.85, 0.9), step(0.0, p.y * -1.0 + 0.2)), step(0.12, vAlpha));
  } else { // glow (magic / fireflies)
    float core = smoothstep(0.35, 0.0, d);
    float halo = pow(1.0 - d, 2.6);
    float a = (core + halo * 0.6) * vAlpha;
    gl_FragColor = vec4(mix(uTint, vec3(1.0), core * 0.8) * a, a);
  }
}`;

function spriteMaterial(mode: number, additive: boolean, tint = "#ffe39a") {
  return new ShaderMaterial({
    vertexShader: SPRITE_VERT,
    fragmentShader: SPRITE_FRAG,
    uniforms: { uScale: { value: 400 }, uMode: { value: mode }, uTint: { value: new Color(tint) } },
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  });
}

class SpriteCloud {
  readonly points: Points;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly heat: Float32Array;
  readonly alpha: Float32Array;
  constructor(max: number, mat: ShaderMaterial) {
    const g = new BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.heat = new Float32Array(max);
    this.alpha = new Float32Array(max);
    g.setAttribute("position", new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute("aSize", new BufferAttribute(this.size, 1).setUsage(DynamicDrawUsage));
    g.setAttribute("aHeat", new BufferAttribute(this.heat, 1).setUsage(DynamicDrawUsage));
    g.setAttribute("aAlpha", new BufferAttribute(this.alpha, 1).setUsage(DynamicDrawUsage));
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
  }
  commit(n: number) {
    const g = this.points.geometry;
    for (const k of ["position", "aSize", "aHeat", "aAlpha"]) (g.getAttribute(k) as BufferAttribute).needsUpdate = true;
    g.setDrawRange(0, n);
  }
  set mat(m: ShaderMaterial) {
    this.points.material = m;
  }
}

function setScale(m: ShaderMaterial, cam: PerspectiveCamera, heightPx: number) {
  m.uniforms.uScale.value = heightPx / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

function baseScene(bg: string, cam: [number, number, number], target: [number, number, number], fov = 34) {
  const scene = new Scene();
  scene.background = new Color(bg);
  const camera = new PerspectiveCamera(fov, 16 / 9, 0.05, 60);
  camera.position.set(...cam);
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  return { scene, camera };
}

function ground(color: string, size = 12, y = 0) {
  const m = new Mesh(new PlaneGeometry(size, size), new MeshStandardMaterial({ color, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

function shapeFrom(pts: number[]) {
  const s = new Shape();
  for (let i = 0; i < pts.length; i += 2) (i === 0 ? s.moveTo : s.lineTo).call(s, pts[i], pts[i + 1]);
  return s;
}

function starShape(r: number, inner = 0.3) {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return shapeFrom(pts);
}

function canvas(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** An outdoor environment for reflections: a sky gradient over a darker ground, prefiltered. */
function skyEnvironment(gl: WebGLRenderer): Texture {
  const sc = new Scene();
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader:
      "varying vec3 vP; void main(){ float h = vP.y; vec3 sky = mix(vec3(0.82,0.9,0.98), vec3(0.32,0.55,0.86), smoothstep(0.0, 0.7, h)); vec3 gnd = vec3(0.22,0.3,0.16); vec3 c = h > 0.0 ? sky : mix(vec3(0.6,0.68,0.62), gnd, smoothstep(0.0,-0.25,h)); gl_FragColor = vec4(c, 1.0); }",
  });
  sc.add(new Mesh(new SphereGeometry(10, 32, 16), mat));
  const pm = new PMREMGenerator(gl);
  const tex = pm.fromScene(sc, 0.02).texture;
  pm.dispose();
  mat.dispose();
  return tex;
}

/* ---------- 1. Fire & smoke ---------- */

class FireDemo implements Demo {
  readonly id = "fire" as const;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  private flames: SpriteCloud;
  private smoke: SpriteCloud;
  private mats = { glow: spriteMaterial(0, true), smoke: spriteMaterial(1, false), toonFire: spriteMaterial(2, false), toonSmoke: spriteMaterial(3, false) };
  private buf: Float32Array;
  private budget: number;
  private keyed = new Group();
  private layerMeshes: Mesh[] = [];
  private lickMeshes: Mesh[] = [];
  private puffs: Mesh[] = [];
  private light: PointLight;
  private lastDrawing = "";
  private n = 0;
  private ramp = toonRamp([110, 190, 255]);
  constructor(low: boolean) {
    const b = baseScene("#141a2e", [0, 0.78, 2.7], [0, 0.48, 0]);
    this.scene = b.scene;
    this.camera = b.camera;
    this.scene.add(new HemisphereLight("#46507a", "#1b120c", 0.6), ground("#2a2019"));
    const key = new DirectionalLight("#9fb2ff", 0.35);
    key.position.set(-2, 3, 2);
    this.light = new PointLight("#ff8a3a", 6, 6, 1.6);
    this.light.position.set(0, 0.45, 0.2);
    this.scene.add(key, this.light);
    const rnd = mulberry32(5);
    const stoneMat = new MeshStandardMaterial({ color: "#6f6a66", roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new Mesh(new DodecahedronGeometry(0.075 + rnd() * 0.03, 0), stoneMat);
      s.position.set(Math.cos(a) * 0.32, 0.045, Math.sin(a) * 0.24);
      s.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      s.scale.y = 0.7;
      this.scene.add(s);
    }
    const logMat = new MeshStandardMaterial({ color: "#4a2f1e", roughness: 0.85 });
    for (const [ry, x] of [[0.5, 0], [-0.6, 0.02], [1.6, -0.03]] as const) {
      const log = new Mesh(new CylinderGeometry(0.045, 0.05, 0.55, 10), logMat);
      log.rotation.set(0, ry, Math.PI / 2);
      log.position.set(x, 0.06, 0);
      this.scene.add(log);
    }
    this.budget = low ? 420 : 1100;
    const { flame, smoke } = fireCounts(this.budget);
    this.flames = new SpriteCloud(flame, this.mats.glow);
    this.smoke = new SpriteCloud(smoke, this.mats.smoke);
    this.smoke.points.renderOrder = 1;
    this.flames.points.renderOrder = 2;
    this.buf = new Float32Array(this.budget * FIRE_STRIDE);
    this.scene.add(this.smoke.points, this.flames.points, this.keyed);
    const colors = { outer: "#ec4a2c", mid: "#ff9d22", core: "#ffe873" };
    for (const c of ["outer", "mid", "core"] as const) {
      const m = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: colors[c], transparent: true, depthWrite: false, side: DoubleSide }));
      m.renderOrder = 3 + this.layerMeshes.length;
      this.layerMeshes.push(m);
    }
    const ink = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: INK, side: DoubleSide, transparent: true, depthWrite: false }));
    ink.renderOrder = 2;
    ink.name = "ink";
    this.keyed.add(ink, ...this.layerMeshes);
    for (let i = 0; i < 2; i++) {
      const m = new Mesh(new BufferGeometry(), this.layerMeshes[1].material);
      m.renderOrder = 6;
      this.lickMeshes.push(m);
      this.keyed.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const p = new Mesh(new CircleGeometry(1, 24), new MeshBasicMaterial({ color: "#8f8d9c", transparent: true }));
      const hi = new Mesh(new CircleGeometry(0.62, 20), new MeshBasicMaterial({ color: "#b9b7c6", transparent: true }));
      hi.position.set(-0.22, 0.2, 0.001);
      const o = new Mesh(new CircleGeometry(1.1, 24), new MeshBasicMaterial({ color: INK, transparent: true }));
      o.position.z = -0.002;
      p.add(o, hi);
      this.puffs.push(p);
      this.keyed.add(p);
    }
  }
  update(t: number, s: CatState, heightPx: number) {
    const wind = s.value;
    const realLook = s.look === "real";
    for (const m of Object.values(this.mats)) setScale(m, this.camera, heightPx);
    if (s.motion === "sim") {
      this.keyed.visible = false;
      this.flames.points.visible = this.smoke.points.visible = true;
      this.flames.mat = realLook ? this.mats.glow : this.mats.toonFire;
      this.smoke.mat = realLook ? this.mats.smoke : this.mats.toonSmoke;
      // stylized look on a sim still steps on twos, like the drawn version
      const tt = realLook ? t : stepped(t, 2);
      const n = fireParticles(tt, this.budget, wind, this.buf);
      const { flame } = fireCounts(this.budget);
      let fi = 0;
      let si = 0;
      for (let i = 0; i < n; i++) {
        const o = i * FIRE_STRIDE;
        const smoke = this.buf[o + 6] > 0.5;
        const cl = smoke ? this.smoke : this.flames;
        const k = smoke ? si++ : fi++;
        cl.pos[k * 3] = this.buf[o];
        cl.pos[k * 3 + 1] = this.buf[o + 1];
        cl.pos[k * 3 + 2] = this.buf[o + 2];
        cl.size[k] = this.buf[o + 3] * (realLook ? 1 : 0.85);
        cl.heat[k] = this.buf[o + 4];
        cl.alpha[k] = this.buf[o + 5];
      }
      this.flames.commit(fi);
      this.smoke.commit(si);
      this.n = Math.min(n, flame + si);
    } else {
      this.flames.points.visible = this.smoke.points.visible = false;
      this.keyed.visible = true;
      const d = flameDrawingAt(t);
      const key = `${d}|${wind}|${s.look}`;
      if (key !== this.lastDrawing) {
        const dw = flameDrawing(d, wind);
        dw.layers.forEach((l, i) => {
          const m = this.layerMeshes[i];
          m.geometry.dispose();
          m.geometry = new ShapeGeometry(shapeFrom(l.pts));
          (m.material as MeshBasicMaterial).blending = realLook ? AdditiveBlending : NormalBlending;
          (m.material as MeshBasicMaterial).opacity = realLook ? 0.7 : 1;
        });
        const ink = this.keyed.getObjectByName("ink") as Mesh;
        ink.geometry.dispose();
        const outer = dw.layers[0].pts.map((v, i) => (i % 2 === 0 ? v * 1.1 : v * 1.04 - 0.012));
        ink.geometry = new ShapeGeometry(shapeFrom(outer));
        ink.visible = !realLook;
        this.lickMeshes.forEach((m, i) => {
          m.geometry.dispose();
          m.geometry = dw.licks[i] ? new ShapeGeometry(shapeFrom(dw.licks[i])) : new BufferGeometry();
        });
        this.lastDrawing = key;
      }
      this.keyed.position.set(0, 0.04, 0.05);
      smokePuffs(t, wind).forEach((p, i) => {
        const m = this.puffs[i];
        m.position.set(p.x, p.y - 0.04, -0.05);
        m.scale.setScalar(p.r);
        m.visible = p.alpha > 0;
        (m.material as MeshBasicMaterial).opacity = realLook ? 0.35 : 1;
        (m.children[0] as Mesh).visible = !realLook;
        (m.children[1] as Mesh).visible = !realLook;
      });
      this.n = 3 + dw_count(this.lickMeshes);
    }
    this.light.intensity = 5 + 1.5 * Math.sin(t * 23) * Math.sin(t * 7.3);
  }
  stats() {
    return { particles: this.n, budget: this.budget, solver: "closed-form particles" };
  }
  dispose() {
    disposeTree(this.scene);
    for (const m of Object.values(this.mats)) m.dispose();
    this.ramp.dispose();
  }
}
const dw_count = (ms: Mesh[]) => ms.filter((m) => (m.geometry.getAttribute("position")?.count ?? 0) > 0).length;

/* ---------- 2. Water ---------- */

class WaterDemo implements Demo {
  readonly id = "water" as const;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  private surface: Mesh;
  private geo: PlaneGeometry;
  private matReal: MeshStandardMaterial;
  private matToon: MeshToonMaterial;
  private bakes = new Map<number, RippleBake>();
  private pebble: Mesh;
  private drops: InstancedMesh;
  private dropLines: InstancedMesh;
  private rings: Mesh[] = [];
  private env: Texture | null;
  private ramp = toonRamp([120, 200, 255]);
  private n = 0;
  constructor(gl: WebGLRenderer | null) {
    const b = baseScene("#bfd9e6", [0, 1.15, 2.9], [0, 0.0, 0.25]);
    this.scene = b.scene;
    this.camera = b.camera;
    this.env = gl ? skyEnvironment(gl) : null;
    this.scene.add(new HemisphereLight("#f3f8ff", "#4f6b3a", 1.2));
    const sun = new DirectionalLight("#fff3dc", 2.2);
    sun.position.set(-2, 4, 1);
    this.scene.add(sun);
    const bank = new Mesh(new RingGeometry(POND.size * 0.5, 6, 64, 1).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: "#6c8f4a", roughness: 1 }));
    bank.position.y = 0.02;
    this.scene.add(bank, ground("#3d5a2c", 14, -0.25));
    const rnd = mulberry32(8);
    const rock = new MeshStandardMaterial({ color: "#8d8a80", roughness: 0.9 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
      const r = new Mesh(new DodecahedronGeometry(0.08 + rnd() * 0.08, 0), rock);
      r.position.set(Math.cos(a) * POND.size * 0.52, 0.02, Math.sin(a) * POND.size * 0.52);
      r.scale.y = 0.55;
      this.scene.add(r);
    }
    this.geo = new PlaneGeometry(POND.size, POND.size, POND.n - 1, POND.n - 1);
    this.geo.rotateX(-Math.PI / 2);
    this.geo.setAttribute("color", new BufferAttribute(new Float32Array(POND.n * POND.n * 3).fill(1), 3));
    this.matReal = new MeshStandardMaterial({ color: "#174a66", roughness: 0.06, metalness: 0.1, envMap: this.env, envMapIntensity: 1.0 });
    this.matToon = new MeshToonMaterial({ color: "#ffffff", vertexColors: true, gradientMap: this.ramp });
    this.surface = new Mesh(this.geo, this.matReal);
    this.scene.add(this.surface);
    this.pebble = new Mesh(new DodecahedronGeometry(0.06, 1), new MeshStandardMaterial({ color: "#6b625a", roughness: 0.7 }));
    this.scene.add(this.pebble);
    const dropGeo = new SphereGeometry(1, 16, 12);
    this.drops = new InstancedMesh(dropGeo, new MeshStandardMaterial({ color: "#9fd2ee", roughness: 0.05, envMap: this.env }), 16);
    this.dropLines = new InstancedMesh(dropGeo, new MeshBasicMaterial({ color: INK, side: 1 }), 16);
    for (const m of [this.drops, this.dropLines]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    this.scene.add(this.drops, this.dropLines);
    for (let i = 0; i < 18; i++) {
      const r = new Mesh(new RingGeometry(0.94, 1, 72).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }));
      r.position.y = 0.01;
      this.rings.push(r);
      this.scene.add(r);
    }
  }
  private bake(v: number) {
    const k = Math.round(v * 20) / 20;
    let b = this.bakes.get(k);
    if (!b) {
      b = new RippleBake(k);
      this.bakes.set(k, b);
    }
    return b;
  }
  update(t: number, s: CatState) {
    const size = s.value;
    const sim = s.motion === "sim";
    const real = s.look === "real";
    const tt = real ? t : stepped(t, 2);
    const f = frameOf(tt);
    const pos = this.geo.getAttribute("position") as BufferAttribute;
    const col = this.geo.getAttribute("color") as BufferAttribute;
    const n = POND.n;
    const inner = new Color("#5cc6f2");
    const outer = new Color("#2d8fcc");
    const tmpC = new Color();
    const heights = sim ? this.bake(size).heightAt(f) : null;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const id = j * n + i;
        const x = pos.getX(id);
        const z = pos.getZ(id);
        const h = heights ? heights[j * n + i] : keyedHeight(x, z, tt, size);
        // realistic: exaggerate the tiny ripples a little so the lighting can find them
        pos.setY(id, h * (real ? 2.5 : 0.5));
        if (!real) {
          // toon pond: a soft centre-to-bank gradient; the white rings carry the motion
          tmpC.copy(inner).lerp(outer, Math.min(1, Math.hypot(x, z) / (POND.size * 0.5)) ** 1.5);
          col.setXYZ(id, tmpC.r, tmpC.g, tmpC.b);
        }
      }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.surface.material = real ? this.matReal : this.matToon;
    const py = pebbleY(tt);
    this.pebble.visible = py > -0.05;
    this.pebble.position.set(0, py + 0.03, 0);
    // drops
    let k = 0;
    if (sim) {
      for (const d of simDrops(size)) {
        const p = dropAt(d, tt);
        if (!p) continue;
        tmpP.set(p[0], p[1], p[2]);
        tmpQ.identity();
        const r = 0.022 * (0.7 + size * 0.6);
        tmpS.set(r, r * 1.25, r);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.drops.setMatrixAt(k, tmpM);
        tmpS.multiplyScalar(1.25);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.dropLines.setMatrixAt(k, tmpM);
        k++;
      }
    } else {
      for (const d of keyedDrops(tt, size)) {
        if (d.y < 0) continue;
        tmpP.set(d.x, d.y, d.z);
        const l = Math.hypot(d.dx, d.dy) || 1;
        tmpQ.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(d.dx / l, d.dy / l, 0));
        const r = 0.03 * (0.7 + size * 0.6);
        tmpS.set(r, r * 1.7, r);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.drops.setMatrixAt(k, tmpM);
        tmpS.set(r + 0.008, r * 1.7 + 0.008, r + 0.008);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.dropLines.setMatrixAt(k, tmpM);
        k++;
      }
    }
    this.drops.count = k;
    this.dropLines.count = real ? 0 : k;
    this.drops.instanceMatrix.needsUpdate = this.dropLines.instanceMatrix.needsUpdate = true;
    (this.drops.material as MeshStandardMaterial).color.set(real ? "#9fd2ee" : "#5cc4f5");
    // stylized look: white ink rings (keyed timing, or traced from the sim's main ring)
    let ri = 0;
    if (!real) {
      // simulated motion, stylized look: rings traced from the solver (the wave speed, plus every drop that lands)
      const simRings = () => {
        const out = [{ r: Math.max(0, tt - pebbleImpact) * 0.55 + 0.05, a: tt > pebbleImpact ? Math.max(0, 1 - (tt - pebbleImpact) / 3) : 0, x: 0, z: 0 }];
        for (const d of simDrops(size)) {
          if (tt < d.land) continue;
          const a = d.land - pebbleImpact;
          out.push({ r: (tt - d.land) * 0.55 + 0.03, a: Math.max(0, 1 - (tt - d.land) / 1.6), x: d.vx * a, z: d.vz * a });
        }
        return out;
      };
      const rings = sim ? simRings() : keyedRings(tt, size).map((r) => ({ ...r, x: 0, z: 0 }));
      for (const r of rings) {
        if (ri >= this.rings.length || r.a <= 0) continue;
        const m = this.rings[ri++];
        m.visible = true;
        m.position.set(r.x, 0.012, r.z);
        m.scale.set(r.r, 1, r.r);
        (m.material as MeshBasicMaterial).opacity = Math.min(1, r.a * 1.4);
      }
      if (!sim)
        for (const d of keyedDrops(tt, size)) {
          if (d.ring === null || ri >= this.rings.length) continue;
          const m = this.rings[ri++];
          m.visible = true;
          m.position.set(d.x, 0.01, d.z);
          m.scale.setScalar(0.05 + 0.18 * d.ring);
          (m.material as MeshBasicMaterial).opacity = 1 - d.ring;
        }
    }
    for (let i = ri; i < this.rings.length; i++) this.rings[i].visible = false;
    this.n = k;
  }
  stats() {
    return { particles: this.n, grid: `${POND.n}×${POND.n}`, solver: "height-field wave equation" };
  }
  dispose() {
    disposeTree(this.scene);
    this.env?.dispose();
    this.ramp.dispose();
  }
}

/* ---------- 3. Rigid bodies ---------- */

function crateTexture(stylized: boolean) {
  return canvas(256, 256, (g) => {
    g.fillStyle = stylized ? "#e0a25a" : "#a8743f";
    g.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(stylized ? 4 : 7);
    if (!stylized)
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(60,35,15,${0.08 + rnd() * 0.12})`;
        g.lineWidth = 1 + rnd() * 2;
        const y = rnd() * 256;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(256, y + (rnd() - 0.5) * 6);
        g.stroke();
      }
    for (let i = 1; i < 4; i++) {
      g.fillStyle = stylized ? INK : "rgba(50,28,10,0.6)";
      g.fillRect(0, i * 64 - 2, 256, stylized ? 4 : 3);
    }
    g.fillStyle = stylized ? "#c4843f" : "#7c5128";
    g.fillRect(0, 0, 256, 28);
    g.fillRect(0, 228, 256, 28);
    g.fillRect(0, 0, 28, 256);
    g.fillRect(228, 0, 28, 256);
    g.save();
    g.translate(128, 128);
    g.rotate(Math.PI / 4);
    g.fillRect(-170, -14, 340, 28);
    g.restore();
    if (stylized) {
      g.strokeStyle = INK;
      g.lineWidth = 8;
      g.strokeRect(4, 4, 248, 248);
    }
  });
}

class RigidDemo implements Demo {
  readonly id = "rigid" as const;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  private crates: Group[] = [];
  private ball: Mesh;
  private ballToon: Mesh;
  private bakes = new Map<number, CrateBake>();
  private puffs: Mesh[] = [];
  private realMat: MeshStandardMaterial;
  private toonMat: MeshToonMaterial;
  private ramp = toonRamp();
  private moving = 0;
  constructor() {
    const b = baseScene("#4a515c", [0.55, 1.0, 4.3], [0.62, 0.45, 0]);
    this.scene = b.scene;
    this.camera = b.camera;
    this.scene.add(new HemisphereLight("#eef2ff", "#5a4e44", 1.6));
    const key = new DirectionalLight("#fff0dc", 2.6);
    key.position.set(-2, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 4, top: 3, bottom: -1 });
    this.scene.add(key, ground("#9a8f82"));
    const wall = new Mesh(new PlaneGeometry(14, 5), new MeshStandardMaterial({ color: "#6b717c", roughness: 1 }));
    wall.position.set(0, 2.5, -1.6);
    this.scene.add(wall);
    this.realMat = new MeshStandardMaterial({ map: crateTexture(false), roughness: 0.8 });
    this.toonMat = new MeshToonMaterial({ map: crateTexture(true), gradientMap: this.ramp });
    const box = new BoxGeometry(CRATE, CRATE, CRATE);
    for (let i = 0; i < 6; i++) {
      const g = new Group();
      const m = new Mesh(box, this.realMat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = "body";
      const o = new Mesh(box, outlineMaterial(INK, 0.012));
      o.name = "line";
      g.add(m, o);
      this.crates.push(g);
      this.scene.add(g);
    }
    this.ball = new Mesh(new SphereGeometry(BALL_R, 32, 20), new MeshStandardMaterial({ color: "#3a3d42", metalness: 0.6, roughness: 0.35 }));
    this.ball.castShadow = true;
    this.ballToon = new Mesh(new SphereGeometry(BALL_R, 32, 20), new MeshToonMaterial({ color: "#e0453a", gradientMap: this.ramp }));
    this.ballToon.add(new Mesh(this.ballToon.geometry, outlineMaterial(INK, 0.012)));
    this.scene.add(this.ball, this.ballToon);
    for (let i = 0; i < 6; i++) {
      // a dust puff: three overlapping round lobes with one ink line around them
      const p = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ transparent: true, opacity: 0 }));
      const lobes = [[-0.55, 0, 0.7], [0, 0.25, 0.85], [0.55, 0, 0.7]] as const;
      for (const [x, y, r] of lobes) {
        const ink = new Mesh(new CircleGeometry(r * 1.12, 20), new MeshBasicMaterial({ color: INK, transparent: true }));
        ink.position.set(x, y, -0.004);
        const fill = new Mesh(new CircleGeometry(r, 20), new MeshBasicMaterial({ color: "#efe6d6", transparent: true }));
        fill.position.set(x, y, 0);
        p.add(ink, fill);
      }
      this.puffs.push(p);
      this.scene.add(p);
    }
  }
  private bake(v: number) {
    const k = Math.round(v * 20) / 20;
    let b = this.bakes.get(k);
    if (!b) {
      b = new CrateBake(k);
      this.bakes.set(k, b);
    }
    return b;
  }
  update(t: number, s: CatState) {
    const sim = s.motion === "sim";
    const real = s.look === "real";
    const tt = real ? t : stepped(t, 2);
    const fr: CrateFrame = sim ? this.bake(s.value).at(frameOf(tt)) : keyedCrates(tt, s.value);
    const prev: CrateFrame = sim ? this.bake(s.value).at(Math.max(0, frameOf(tt) - 1)) : keyedCrates(tt - 1 / FPS, s.value);
    this.moving = 0;
    fr.crates.forEach((c, i) => {
      const g = this.crates[i];
      g.position.set(c.x, c.y, 0);
      g.rotation.set(0, 0, c.angle);
      g.scale.set(1 / Math.sqrt(c.sy), c.sy, 1);
      (g.getObjectByName("body") as Mesh).material = real ? this.realMat : this.toonMat;
      (g.getObjectByName("line") as Mesh).visible = !real;
      if (Math.hypot(c.x - prev.crates[i].x, c.y - prev.crates[i].y) > 0.004) this.moving++;
    });
    this.ball.visible = real;
    this.ballToon.visible = !real;
    for (const b of [this.ball, this.ballToon]) {
      b.position.set(fr.ball.x, fr.ball.y, 0);
      b.rotation.set(0, 0, fr.ball.angle);
    }
    // dust puffs on the authored landings (stylized look)
    const lay = stackLayout();
    this.puffs.forEach((p, i) => {
      p.visible = false;
      if (real || sim) return;
      const c = fr.crates[i];
      const land = keyedLandTime(i, s.value);
      const u = (tt - land) / 0.32;
      if (u < 0 || u > 1) return;
      p.visible = true;
      p.position.set(c.x + (i % 2 ? 0.2 : -0.2) * (0.6 + u), 0.05 + 0.06 * u, 0.25);
      p.scale.setScalar(0.05 + 0.07 * u);
      for (const ch of p.children) ((ch as Mesh).material as MeshBasicMaterial).opacity = 1 - u * u * u;
      void lay;
    });
  }
  stats() {
    return { bodies: 6, moving: this.moving, solver: "2D Verlet, 6 constraints per crate" };
  }
  dispose() {
    disposeTree(this.scene);
    this.ramp.dispose();
  }
}

/** When keyed crate i touches down (mirrors keyedCrates). */
function keyedLandTime(i: number, impact: number) {
  for (let f = Math.round(HIT_T * FPS); f < FRAMES; f++) {
    const t = f / FPS;
    if (keyedCrates(t, impact).crates[i].sy < 1) return t;
  }
  return Infinity;
}

/* ---------- 4. Cloth ---------- */

function flagTexture(stylized: boolean) {
  return canvas(512, 320, (g) => {
    g.fillStyle = stylized ? "#fff3dc" : "#efe4cf";
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = stylized ? "#e5483b" : "#b8352c";
    for (let i = 0; i < 5; i += 2) g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = stylized ? "#2f6db5" : "#24518a";
    g.fillRect(0, 0, 200, 192);
    g.fillStyle = "#fff6e0";
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      const cx = 40 + (k % 3) * 60;
      const cy = 50 + Math.floor(k / 3) * 80;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 20 : 8;
        (i === 0 ? g.moveTo : g.lineTo).call(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.fill();
    }
    if (stylized) {
      g.strokeStyle = INK;
      g.lineWidth = 14;
      g.strokeRect(0, 0, 512, 320);
    }
  });
}

class ClothDemo implements Demo {
  readonly id = "cloth" as const;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  private flag: Mesh;
  private geo: PlaneGeometry;
  private stick: Group;
  private bakes = new Map<number, ClothBake>();
  private keyedBuf = new Float32Array(FLAG.cols * FLAG.rows * 3);
  private real: MeshStandardMaterial;
  private toon: MeshToonMaterial;
  private stickLine: Mesh;
  private ramp = toonRamp();
  constructor() {
    const b = baseScene("#a9cfe8", [0.15, 1.15, 3.2], [0.05, 1.0, 0]);
    this.scene = b.scene;
    this.camera = b.camera;
    this.scene.add(new HemisphereLight("#f2f7ff", "#5c7a3e", 1.1));
    const sun = new DirectionalLight("#fff4e0", 2.2);
    sun.position.set(-1.5, 3, 3);
    this.scene.add(sun, ground("#7aa04f"));
    const hill = new Mesh(new SphereGeometry(4, 32, 16), new MeshStandardMaterial({ color: "#8db560", roughness: 1 }));
    hill.position.set(1.5, -3.4, -5);
    this.scene.add(hill);
    this.geo = new PlaneGeometry(1, 1, FLAG.cols - 1, FLAG.rows - 1);
    this.real = new MeshStandardMaterial({ map: flagTexture(false), roughness: 0.85, side: DoubleSide });
    this.toon = new MeshToonMaterial({ map: flagTexture(true), gradientMap: this.ramp, side: DoubleSide });
    this.flag = new Mesh(this.geo, this.real);
    this.flag.frustumCulled = false;
    this.scene.add(this.flag);
    this.stick = new Group();
    const pole = new Mesh(new CylinderGeometry(0.018, 0.022, STICK.len, 10), new MeshStandardMaterial({ color: "#8a5a35", roughness: 0.7 }));
    pole.position.y = STICK.len / 2;
    this.stickLine = new Mesh(pole.geometry, outlineMaterial(INK, 0.008));
    this.stickLine.position.y = STICK.len / 2;
    const hand = new Mesh(new SphereGeometry(0.055, 16, 12), new MeshStandardMaterial({ color: "#f1c49b", roughness: 0.6 }));
    const knob = new Mesh(new SphereGeometry(0.03, 12, 8), new MeshStandardMaterial({ color: "#e0b040", metalness: 0.5, roughness: 0.3 }));
    knob.position.y = STICK.len;
    this.stick.add(pole, this.stickLine, hand, knob);
    this.stick.position.set(STICK.hx, STICK.hy, 0);
    this.scene.add(this.stick);
  }
  update(t: number, s: CatState) {
    const sim = s.motion === "sim";
    const real = s.look === "real";
    const tt = real ? t : stepped(t, 2);
    this.stick.rotation.set(0, 0, -stickAngle(tt));
    let src: Float32Array;
    if (sim) {
      const k = Math.round(s.value * 20) / 20;
      let b = this.bakes.get(k);
      if (!b) {
        b = new ClothBake(k);
        this.bakes.set(k, b);
      }
      src = b.at(frameOf(tt));
    } else {
      keyedFlag(tt, s.value, this.keyedBuf);
      src = this.keyedBuf;
    }
    const pos = this.geo.getAttribute("position") as BufferAttribute;
    // PlaneGeometry vertex order: rows top → bottom, columns left → right (same as the cloth grid)
    for (let i = 0; i < FLAG.cols * FLAG.rows; i++) pos.setXYZ(i, src[i * 3], src[i * 3 + 1], src[i * 3 + 2]);
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.flag.material = real ? this.real : this.toon;
    this.stickLine.visible = !real;
  }
  stats() {
    return { vertices: FLAG.cols * FLAG.rows, solver: "Verlet cloth, 10 iterations" };
  }
  dispose() {
    disposeTree(this.scene);
    this.ramp.dispose();
  }
}

/* ---------- 5. Particles & magic ---------- */

class MagicDemo implements Demo {
  readonly id = "magic" as const;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  private glow = spriteMaterial(4, true, "#ffd36b");
  private flyMat = spriteMaterial(4, true, "#c8ff7a");
  private sparks: SpriteCloud;
  private flies: SpriteCloud;
  private stars: InstancedMesh;
  private starLines: InstancedMesh;
  private wand: Group;
  private buf: Float32Array;
  private budget: number;
  private n = 0;
  constructor(low: boolean) {
    const b = baseScene("#0f1d24", [0, 0.95, 3.1], [0, 0.85, 0]);
    this.scene = b.scene;
    this.camera = b.camera;
    this.scene.add(new HemisphereLight("#3c5a6a", "#0b0f0c", 0.7), ground("#16231b"));
    const rnd = mulberry32(12);
    const trunk = new MeshStandardMaterial({ color: "#1f2b25", roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const tr = new Mesh(new CylinderGeometry(0.12 + rnd() * 0.1, 0.18 + rnd() * 0.1, 5, 10), trunk);
      tr.position.set(-2.6 + i * 0.9 + rnd() * 0.3, 2.4, -1.6 - rnd() * 1.5);
      this.scene.add(tr);
    }
    this.budget = low ? 260 : 700;
    this.buf = new Float32Array(Math.max(this.budget, 40) * MAGIC_STRIDE);
    this.sparks = new SpriteCloud(this.budget, this.glow);
    this.flies = new SpriteCloud(40, this.flyMat);
    const star = new ShapeGeometry(starShape(1, 0.28));
    this.stars = new InstancedMesh(star, new MeshBasicMaterial({ color: "#fff1a8" }), 400);
    this.starLines = new InstancedMesh(new ShapeGeometry(starShape(1.28, 0.36)), new MeshBasicMaterial({ color: INK }), 400);
    for (const m of [this.stars, this.starLines]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    this.stars.renderOrder = 3;
    this.starLines.renderOrder = 2;
    this.wand = new Group();
    const rod = new Mesh(new CylinderGeometry(0.012, 0.016, 0.42, 8), new MeshStandardMaterial({ color: "#2a1a12", roughness: 0.5 }));
    rod.position.y = -0.21;
    const tip = new Mesh(new SphereGeometry(0.022, 12, 8), new MeshBasicMaterial({ color: "#fff6c8" }));
    this.wand.add(rod, tip);
    this.scene.add(this.flies.points, this.sparks.points, this.starLines, this.stars, this.wand);
  }
  update(t: number, s: CatState, heightPx: number) {
    setScale(this.glow, this.camera, heightPx);
    setScale(this.flyMat, this.camera, heightPx);
    const sim = s.motion === "sim";
    const real = s.look === "real";
    const n = Math.round(this.budget * (0.25 + 0.75 * s.value));
    const tt = real ? t : stepped(t, 2);
    const tip = wandTip(tt);
    this.wand.position.set(tip[0], tip[1], tip[2]);
    this.wand.rotation.set(0, 0, -0.5 + 0.25 * Math.sin(tt * 3));
    // the particle positions this frame
    const P: { x: number; y: number; z: number; size: number; glow: number; rot: number }[] = [];
    if (sim) {
      const c = sparks(tt, n, this.buf);
      for (let i = 0; i < c; i++) {
        const o = i * MAGIC_STRIDE;
        P.push({ x: this.buf[o], y: this.buf[o + 1], z: this.buf[o + 2], size: this.buf[o + 3], glow: this.buf[o + 4], rot: (i % 2) * 0.4 });
      }
    } else {
      for (const k of keyedSparkles(tt, Math.round(10 + 20 * s.value))) P.push({ x: k.x, y: k.y, z: k.z, size: 0.06 * k.scale, glow: Math.min(1, k.scale), rot: k.rot });
    }
    this.n = P.length;
    if (real) {
      this.stars.count = this.starLines.count = 0;
      this.sparks.points.visible = true;
      P.forEach((p, i) => {
        this.sparks.pos[i * 3] = p.x;
        this.sparks.pos[i * 3 + 1] = p.y;
        this.sparks.pos[i * 3 + 2] = p.z;
        this.sparks.size[i] = p.size * (sim ? 2.8 : 2);
        this.sparks.alpha[i] = p.glow;
      });
      this.sparks.commit(P.length);
    } else {
      this.sparks.points.visible = false;
      const m = Math.min(400, P.length);
      for (let i = 0; i < m; i++) {
        const p = P[i];
        tmpP.set(p.x, p.y, p.z);
        tmpQ.setFromAxisAngle(new Vector3(0, 0, 1), p.rot);
        const r = p.size * (sim ? 1.1 : 1);
        tmpS.set(r, r, r);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.stars.setMatrixAt(i, tmpM);
        tmpP.z -= 0.002;
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.starLines.setMatrixAt(i, tmpM);
      }
      this.stars.count = this.starLines.count = m;
      this.stars.instanceMatrix.needsUpdate = this.starLines.instanceMatrix.needsUpdate = true;
    }
    const nf = fireflies(t, 24, this.buf);
    for (let i = 0; i < nf; i++) {
      const o = i * MAGIC_STRIDE;
      this.flies.pos[i * 3] = this.buf[o];
      this.flies.pos[i * 3 + 1] = this.buf[o + 1];
      this.flies.pos[i * 3 + 2] = this.buf[o + 2];
      this.flies.size[i] = this.buf[o + 3] * (real ? 1.6 : 1.2);
      this.flies.alpha[i] = this.buf[o + 4] * (real ? 1 : 0.6);
    }
    this.flies.commit(nf);
  }
  stats() {
    return { particles: this.n, budget: this.budget, solver: sim_label };
  }
  dispose() {
    disposeTree(this.scene);
    this.glow.dispose();
    this.flyMat.dispose();
  }
}
const sim_label = "closed-form sparks + drag";

/* ---------- 6. Hand-drawn effects ---------- */

function brickTexture() {
  const t = canvas(512, 512, (g) => {
    g.fillStyle = "#c9b8a6";
    g.fillRect(0, 0, 512, 512);
    const rnd = mulberry32(3);
    for (let r = 0; r < 16; r++)
      for (let c = -1; c < 5; c++) {
        g.fillStyle = `hsl(${10 + rnd() * 10}, ${45 + rnd() * 15}%, ${38 + rnd() * 10}%)`;
        g.fillRect(c * 128 + (r % 2) * 64 + 4, r * 32 + 4, 120, 26);
      }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1, 2);
  return t;
}

class ImpactDemo implements Demo {
  readonly id = "drawn" as const;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  flash = false;
  private ghosts: Mesh[] = [];
  private ballReal: Mesh;
  private ballToon: Mesh;
  private ballLine: Mesh;
  private mults: Mesh[] = [];
  private lines: LineSegments;
  private star: Mesh;
  private chips: InstancedMesh;
  private ramp = toonRamp();
  private phase = "";
  constructor() {
    const b = baseScene("#cfd7de", [-0.05, 0.7, 3.25], [0.0, 0.52, 0]);
    this.scene = b.scene;
    this.camera = b.camera;
    this.scene.add(new HemisphereLight("#ffffff", "#7a6a5a", 1.2));
    const key = new DirectionalLight("#fff3e0", 2.2);
    key.position.set(-2, 4, 3);
    key.castShadow = true;
    const floor = ground("#b8a690");
    floor.userData.vxSet = true;
    this.scene.add(key, floor);
    const wall = new Mesh(new BoxGeometry(0.4, 2.2, 2.4), new MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }));
    wall.position.set(WALL_X + 0.2, 1.1, 0);
    wall.receiveShadow = true;
    wall.userData.vxSet = true;
    this.scene.add(wall);
    const ballGeo = new SphereGeometry(BALL, 32, 20);
    this.ballReal = new Mesh(ballGeo, new MeshStandardMaterial({ color: "#d8402f", roughness: 0.45 }));
    this.ballReal.castShadow = true;
    for (let i = 0; i < 6; i++) {
      const g = new Mesh(ballGeo, new MeshStandardMaterial({ color: "#d8402f", roughness: 0.45, transparent: true, depthWrite: false }));
      this.ghosts.push(g);
      this.scene.add(g);
    }
    this.ballToon = new Mesh(ballGeo, new MeshToonMaterial({ color: "#ef4b35", gradientMap: this.ramp }));
    this.ballLine = new Mesh(ballGeo, outlineMaterial(INK, 0.014));
    this.ballToon.add(this.ballLine);
    for (let i = 0; i < 3; i++) {
      const m = new Mesh(new CircleGeometry(BALL, 24), new MeshBasicMaterial({ color: "#ef4b35", transparent: true, opacity: 0.55 - i * 0.14, depthWrite: false }));
      this.mults.push(m);
      this.scene.add(m);
    }
    this.lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: INK }));
    this.lines.geometry.setAttribute("position", new BufferAttribute(new Float32Array(10 * 6), 3).setUsage(DynamicDrawUsage));
    this.lines.frustumCulled = false;
    this.star = new Mesh(new ShapeGeometry(burstShape(0.42, 10)), new MeshBasicMaterial({ color: "#ffe14d", side: DoubleSide }));
    const starInk = new Mesh(new ShapeGeometry(burstShape(0.5, 10)), new MeshBasicMaterial({ color: INK, side: DoubleSide }));
    starInk.position.z = -0.003;
    this.star.add(starInk);
    this.chips = new InstancedMesh(new BoxGeometry(0.03, 0.022, 0.02), new MeshStandardMaterial({ color: "#9a4a36" }), 24);
    this.chips.frustumCulled = false;
    this.scene.add(this.ballReal, this.ballToon, this.lines, this.star, this.chips);
  }
  update(t: number, s: CatState) {
    const sim = s.motion === "sim";
    const real = s.look === "real";
    const speed = s.value;
    const pose = (x: number): BallPose => (sim ? simBall(x, speed) : keyedBall(x, speed));
    const p = pose(t);
    this.flash = !real && p.impactFrame;
    this.phase = p.impactFrame ? "impact frame" : p.smear > 0 ? "smear" : p.hit ? "contact" : "";
    // realistic look: motion blur from a 180° shutter (six sub-frame samples)
    this.ballReal.visible = real;
    this.ghosts.forEach((g, i) => {
      const q = pose(t - ((i + 1) / 7) * (0.5 / FPS));
      g.visible = real;
      g.position.set(q.x, q.y, 0);
      g.scale.set(q.along, q.across, 1);
      (g.material as MeshStandardMaterial).opacity = 0.22;
    });
    const dir = p.dir;
    this.ballReal.position.set(p.x, p.y, 0);
    this.ballReal.scale.set(sim ? 1 : p.along, sim ? 1 : p.across, 1);
    this.ballReal.rotation.set(0, 0, dir);
    this.ballToon.visible = !real;
    this.ballToon.position.set(p.x, p.y, 0);
    this.ballToon.rotation.set(0, 0, dir);
    // stylized: smear stretch only on the drawn version; a sim ball stays round
    this.ballToon.scale.set(p.along, p.across, 1);
    this.mults.forEach((m, i) => {
      const mp = p.multiples[i];
      m.visible = !real && !!mp;
      if (mp) m.position.set(mp[0], mp[1], -0.05);
    });
    const pos = this.lines.geometry.getAttribute("position") as BufferAttribute;
    let nl = 0;
    const showLines = !real && (p.speedLines || (sim && Math.abs(p.vx) > 4));
    if (showLines)
      for (let i = 0; i < 5; i++) {
        const y = p.y + (i - 2) * 0.07;
        const x0 = p.x - BALL * 1.4 - (i % 2) * 0.08;
        pos.setXYZ(nl * 2, x0, y, -0.02);
        pos.setXYZ(nl * 2 + 1, x0 - 0.35 - (i % 3) * 0.12, y, -0.02);
        nl++;
      }
    pos.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, nl * 2);
    this.star.visible = !real && p.star > 0;
    this.star.position.set(WALL_X - 0.02, p.y, 0.05);
    this.star.rotation.y = -Math.PI / 2 + 0.25;
    this.star.scale.setScalar(0.5 + 0.6 * Math.max(0, p.star));
    // realistic look: chips of brick
    const hit = sim ? simHitTime(speed) : keyedHitTime(speed);
    const ch = real ? debris(t, hit, 18) : [];
    ch.forEach((c, i) => {
      tmpP.set(c[0], c[1], c[2]);
      tmpQ.setFromAxisAngle(new Vector3(0.3, 1, 0.2).normalize(), (t - hit) * 12 + i);
      tmpS.set(1, 1, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.chips.setMatrixAt(i, tmpM);
    });
    this.chips.count = ch.length;
    this.chips.instanceMatrix.needsUpdate = true;
  }
  stats() {
    return { phase: this.phase, solver: "ballistic + restitution" };
  }
  dispose() {
    disposeTree(this.scene);
    this.ramp.dispose();
  }
}

function burstShape(r: number, spikes: number) {
  const pts: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * (0.8 + 0.2 * ((i * 7) % 3) / 2) : r * 0.42;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return shapeFrom(pts);
}

export function makeDemo(id: CategoryId, gl: WebGLRenderer | null, low: boolean): Demo {
  switch (id) {
    case "fire":
      return new FireDemo(low);
    case "water":
      return new WaterDemo(gl);
    case "rigid":
      return new RigidDemo();
    case "cloth":
      return new ClothDemo();
    case "magic":
      return new MagicDemo(low);
    default:
      return new ImpactDemo();
  }
}
