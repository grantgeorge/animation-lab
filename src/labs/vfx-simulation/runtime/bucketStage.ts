import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  PointsMaterial,
  Quaternion,
  RGBAFormat,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  CatmullRomCurve3,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BUCKET, CAM, CARD, DECAL, IMPACT, bucketFrame, bucketPose, type BeatTimes, type Phys, type Timing, type Treatment } from "../engine/beat";
import { cartoonPose, type CartoonPose } from "../engine/cartoon";
import { PAL, drawingAt, splat, type Drawing, type Ink } from "../engine/drawn";
import { realSimTime, type FluidBake } from "../engine/fluid";
import { GH, GRID, GW, newGrid, rasterParticles, rasterPrims, cardToWorld, type Legibility } from "../engine/legibility";
import { cartoonPrims } from "../engine/measure";
import { drawingFills } from "../engine/drawn";
import { FPS, frameOf, stepped } from "../engine/timing";
import { PIP_MARK } from "../engine/pipClip";
import { deckTexture, disposeTree, outlineMaterial, toonRamp, wallTexture } from "./materials";

const UP = new Vector3(0, 1, 0);
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const tmpP = new Vector3();
const CARTOON_BLUE = "#3aaaf0";
const INK = PAL.ink;

export interface BucketView {
  treatment: Treatment;
  /** Output time (s). */
  t: number;
  timing: Timing;
  phys: Phys;
  beat: BeatTimes;
  bake: FluidBake | null;
  /** Inspect overlays. */
  vectors: boolean;
  raster: boolean;
  inspect: boolean;
  legibility: Legibility | null;
}

export interface BucketShown {
  sampleT: number;
  phase: string;
  particles: number;
  flash: boolean;
  drawing: number;
}

/** Build a canvas texture of the given pixel size. */
function canvasTex(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return { c, g: c.getContext("2d")!, tex };
}

/**
 * The bucket set and every treatment's effect objects, built imperatively once. The orchestrator calls
 * `show()` once per view per frame: it hides what that view doesn't use and poses the rest at that
 * view's time, then renders.
 */
export class BucketStage {
  readonly root = new Group();
  readonly camera: PerspectiveCamera;
  private ramp = toonRamp();
  private env: Texture | null = null;
  private realSet = new Group();
  private paperSet = new Group();
  private bucketPivot = new Group();
  private bucketInner = new Group();
  private bucketStd = new Group();
  private bucketToon = new Group();
  private waterDisc: Mesh;
  private real = new Group();
  private drops: InstancedMesh;
  private dropMax: number;
  private posA: Float32Array;
  private posB: Float32Array;
  private puddleTex: DataTexture;
  private puddleData: Uint8Array;
  private puddleAcc: Float32Array;
  private puddle: Mesh;
  private vectors: LineSegments;
  private solverGrid: LineSegments | null = null;
  private solverKey = "";
  private cartoon = new Group();
  private blobs: InstancedMesh;
  private blobLines: InstancedMesh;
  private shines: InstancedMesh;
  private crown: Mesh;
  private crownLine: Mesh;
  private crownGeo: BufferGeometry;
  private puddleToon: Mesh;
  private puddleToonLine: Mesh;
  private puddleGeo: BufferGeometry;
  private sats: InstancedMesh;
  private satLines: InstancedMesh;
  private ringMesh: Mesh;
  private trail: Points;
  private trailKey = "";
  private drawn = new Group();
  private card: ReturnType<typeof canvasTex>;
  private decal: ReturnType<typeof canvasTex>;
  private cardMesh: Mesh;
  private decalMesh: Mesh;
  private cardFrame: LineSegments;
  private drawnShadows: Group;
  private lastDrawingKey = "";
  private raster: InstancedMesh;
  private rasterGrid = newGrid();
  private flashScene = new Scene();
  private flashCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private flashSplat: Mesh;
  private flashBg: Mesh;
  private white = new MeshBasicMaterial({ color: "#ffffff" });
  readonly key: DirectionalLight;

  constructor(gl: WebGLRenderer | null, opts: { low: boolean; maxDroplets: number }) {
    this.camera = new PerspectiveCamera(CAM.fovDeg, 16 / 9, 0.05, 40);
    this.camera.position.set(...CAM.pos);
    this.camera.lookAt(...CAM.target);
    this.camera.updateMatrixWorld();
    if (gl) {
      const pm = new PMREMGenerator(gl);
      this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    // lights
    const hemi = new HemisphereLight("#e4ecff", "#6b5644", 1.25);
    const key = new DirectionalLight("#fff1dc", 2.6);
    key.position.set(-2.2, 4.2, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(opts.low ? 512 : 1536, opts.low ? 512 : 1536);
    const sc = key.shadow.camera;
    sc.left = -2.4;
    sc.right = 2.4;
    sc.top = 2;
    sc.bottom = -1.4;
    sc.near = 0.5;
    sc.far = 12;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.target.position.set(0, 0, 0);
    this.key = key;
    const fill = new DirectionalLight("#cfe0ff", 0.7);
    fill.position.set(3, 1.6, 2);
    this.root.add(hemi, key, key.target, fill, new AmbientLight("#ffffff", 0.08));
    this.buildSet(opts.low);
    this.buildBucket();
    this.waterDisc = this.bucketInner.getObjectByName("water") as Mesh;
    // realistic
    this.dropMax = opts.maxDroplets;
    const dropMat = new MeshStandardMaterial({ color: "#3f88c0", roughness: 0.22, metalness: 0.05, envMap: this.env, envMapIntensity: 0.9, emissive: "#082a44", emissiveIntensity: 0.45 });
    this.drops = new InstancedMesh(new IcosahedronGeometry(1, opts.low ? 0 : 1), dropMat, this.dropMax);
    this.drops.instanceMatrix.setUsage(DynamicDrawUsage);
    this.drops.frustumCulled = false;
    this.drops.count = 0;
    this.posA = new Float32Array(this.dropMax * 3);
    this.posB = new Float32Array(this.dropMax * 3);
    const PW = 128;
    const PH = 96;
    this.puddleData = new Uint8Array(PW * PH * 4);
    this.puddleAcc = new Float32Array(PW * PH);
    this.puddleTex = new DataTexture(this.puddleData, PW, PH, RGBAFormat);
    this.puddleTex.magFilter = LinearFilter;
    this.puddleTex.minFilter = LinearFilter;
    this.puddleTex.needsUpdate = true;
    this.puddle = new Mesh(new PlaneGeometry(PUDDLE.x1 - PUDDLE.x0, PUDDLE.z1 - PUDDLE.z0), new MeshStandardMaterial({ color: "#2f6f9f", roughness: 0.04, metalness: 0.1, envMap: this.env, envMapIntensity: 0.75, transparent: true, opacity: 0.88, alphaMap: this.puddleTex, depthWrite: false }));
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.position.set((PUDDLE.x0 + PUDDLE.x1) / 2, 0.003, (PUDDLE.z0 + PUDDLE.z1) / 2);
    this.puddle.renderOrder = 1;
    this.vectors = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.75, depthTest: false }));
    this.vectors.geometry.setAttribute("position", new BufferAttribute(new Float32Array(Math.ceil(this.dropMax / 3) * 6), 3).setUsage(DynamicDrawUsage));
    this.vectors.frustumCulled = false;
    this.vectors.renderOrder = 10;
    this.real.add(this.drops, this.puddle, this.vectors);
    // cartoon
    const blobGeo = new SphereGeometry(1, 28, 18);
    this.blobs = new InstancedMesh(blobGeo, new MeshToonMaterial({ color: CARTOON_BLUE, gradientMap: this.ramp, emissive: "#0c3a5c", emissiveIntensity: 0.35 }), 32);
    this.blobLines = new InstancedMesh(blobGeo, new MeshBasicMaterial({ color: INK, side: 1 }), 32);
    this.shines = new InstancedMesh(new CircleGeometry(1, 18), new MeshBasicMaterial({ color: "#ffffff" }), 32);
    for (const m of [this.blobs, this.blobLines, this.shines]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
    }
    this.crownGeo = new BufferGeometry();
    initCrownGeometry(this.crownGeo);
    this.crown = new Mesh(this.crownGeo, new MeshToonMaterial({ color: CARTOON_BLUE, gradientMap: this.ramp, side: DoubleSide, emissive: "#0c3a5c", emissiveIntensity: 0.35 }));
    this.crownLine = new Mesh(this.crownGeo, outlineMaterial(INK, 0.009));
    this.puddleGeo = new BufferGeometry();
    initDiscGeometry(this.puddleGeo);
    this.puddleToon = new Mesh(this.puddleGeo, new MeshToonMaterial({ color: "#5ec2f5", gradientMap: this.ramp, emissive: "#0c3a5c", emissiveIntensity: 0.2 }));
    this.puddleToon.position.y = 0.006;
    this.puddleToonLine = new Mesh(this.puddleGeo, new MeshBasicMaterial({ color: INK }));
    this.puddleToonLine.position.y = 0.004;
    const disc = new CircleGeometry(1, 22).rotateX(-Math.PI / 2);
    this.sats = new InstancedMesh(disc, new MeshToonMaterial({ color: "#5ec2f5", gradientMap: this.ramp }), 16);
    this.satLines = new InstancedMesh(disc, new MeshBasicMaterial({ color: INK }), 16);
    for (const m of [this.sats, this.satLines]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
    }
    this.ringMesh = new Mesh(new RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }));
    this.ringMesh.position.y = 0.009;
    this.trail = new Points(new BufferGeometry(), new PointsMaterial({ color: "#ff8fd0", size: 3.5, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.85 }));
    this.trail.renderOrder = 9;
    this.cartoon.add(this.puddleToonLine, this.puddleToon, this.satLines, this.sats, this.ringMesh, this.blobLines, this.blobs, this.shines, this.crownLine, this.crown, this.trail);
    // hand-drawn
    this.card = canvasTex(1024, Math.round((1024 * (CARD.y1 - CARD.y0)) / (CARD.x1 - CARD.x0)));
    this.decal = canvasTex(1024, Math.round((1024 * (DECAL.z1 - DECAL.z0)) / (DECAL.x1 - DECAL.x0)));
    this.cardMesh = new Mesh(new PlaneGeometry(CARD.x1 - CARD.x0, CARD.y1 - CARD.y0), new MeshBasicMaterial({ map: this.card.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.cardMesh.position.set((CARD.x0 + CARD.x1) / 2, (CARD.y0 + CARD.y1) / 2, CARD.z);
    this.cardMesh.renderOrder = 5;
    this.decalMesh = new Mesh(new PlaneGeometry(DECAL.x1 - DECAL.x0, DECAL.z1 - DECAL.z0), new MeshBasicMaterial({ map: this.decal.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.decalMesh.rotation.x = -Math.PI / 2;
    this.decalMesh.position.set((DECAL.x0 + DECAL.x1) / 2, 0.004, (DECAL.z0 + DECAL.z1) / 2);
    this.decalMesh.renderOrder = 2;
    const fr = new BufferGeometry();
    const [x0, x1, y0, y1, z] = [CARD.x0, CARD.x1, CARD.y0, CARD.y1, CARD.z];
    fr.setAttribute("position", new Float32BufferAttribute([x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z], 3));
    this.cardFrame = new LineSegments(fr, new LineBasicMaterial({ color: "#ff8fd0", transparent: true, opacity: 0.8 }));
    this.drawnShadows = new Group();
    const shadowMat = new MeshBasicMaterial({ color: "#3b4a5a", transparent: true, opacity: 0.22, depthWrite: false });
    const s1 = new Mesh(new CircleGeometry(1, 28).rotateX(-Math.PI / 2), shadowMat);
    s1.scale.set(0.24, 1, 0.13);
    s1.position.set(PIP_MARK.x + 0.04, 0.003, PIP_MARK.z);
    s1.name = "pip-shadow";
    const s2 = new Mesh(new CircleGeometry(1, 28).rotateX(-Math.PI / 2), shadowMat);
    s2.scale.set(0.2, 1, 0.12);
    s2.name = "bucket-shadow";
    this.drawnShadows.add(s1, s2);
    this.drawn.add(this.decalMesh, this.cardMesh, this.cardFrame, this.drawnShadows);
    // inspect: legibility raster
    this.raster = new InstancedMesh(new PlaneGeometry(GRID.cell * 0.86, GRID.cell * 0.86), new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthTest: false, depthWrite: false }), GW * GH);
    this.raster.instanceColor = new InstancedBufferAttribute(new Float32Array(GW * GH * 3), 3);
    this.raster.frustumCulled = false;
    this.raster.renderOrder = 20;
    this.raster.count = 0;
    this.root.add(this.realSet, this.paperSet, this.bucketPivot, this.real, this.cartoon, this.drawn, this.raster);
    // impact flash overlay
    this.flashBg = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ color: INK, depthTest: false, transparent: true }));
    this.flashSplat = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: "#ffffff", depthTest: false }));
    this.flashScene.add(this.flashBg, this.flashSplat);
  }

  private buildSet(low: boolean) {
    const floorGeo = new PlaneGeometry(7, 4.5);
    const deck = deckTexture(false);
    deck.repeat.set(3.5, 2.6);
    const floor = new Mesh(floorGeo, new MeshStandardMaterial({ map: deck, roughness: 0.78, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0.2, 0, -0.2);
    floor.receiveShadow = true;
    const wallTex = wallTexture(false);
    wallTex.repeat.set(2, 1);
    const wall = new Mesh(new PlaneGeometry(7, 2.6), new MeshStandardMaterial({ map: wallTex, roughness: 0.9 }));
    wall.position.set(0.2, 1.3, -1.45);
    wall.receiveShadow = !low;
    this.realSet.add(floor, wall);
    // the paper set: the same layout, painted flat
    const pdeck = deckTexture(true);
    pdeck.repeat.set(3.5, 2.6);
    const pfloor = new Mesh(floorGeo, new MeshBasicMaterial({ map: pdeck, toneMapped: false }));
    pfloor.rotation.x = -Math.PI / 2;
    pfloor.position.copy(floor.position);
    const pwallTex = wallTexture(true);
    pwallTex.repeat.set(2, 1);
    const pwall = new Mesh(wall.geometry, new MeshBasicMaterial({ map: pwallTex, toneMapped: false }));
    pwall.position.copy(wall.position);
    this.paperSet.add(pfloor, pwall);
  }

  private buildBucket() {
    const pts: Vector2[] = [];
    const { rTop, rBot, h } = BUCKET;
    pts.push(new Vector2(0.001, 0.004), new Vector2(rBot - 0.006, 0), new Vector2(rBot, 0.008));
    for (let i = 1; i <= 8; i++) {
      const v = i / 8;
      pts.push(new Vector2(rBot + (rTop - rBot) * v, h * v));
    }
    pts.push(new Vector2(rTop + 0.008, h + 0.004), new Vector2(rTop - 0.004, h + 0.006));
    for (let i = 8; i >= 0; i--) {
      const v = i / 8;
      pts.push(new Vector2(rBot + (rTop - rBot) * v - 0.007, Math.max(0.012, h * v)));
    }
    const lathe = new LatheGeometry(pts, 48);
    const metal = new MeshStandardMaterial({ color: "#a8b3ba", metalness: 0.65, roughness: 0.32, envMap: this.env, envMapIntensity: 1 });
    const body = new Mesh(lathe, metal);
    body.castShadow = true;
    body.receiveShadow = true;
    const ribMat = new MeshStandardMaterial({ color: "#7d8a92", metalness: 0.7, roughness: 0.35, envMap: this.env });
    const ribs = [0.28, 0.66].map((v) => {
      const r = new Mesh(new TorusGeometry(rBot + (rTop - rBot) * v + 0.002, 0.005, 6, 48), ribMat);
      r.rotation.x = Math.PI / 2;
      r.position.y = h * v;
      return r;
    });
    const handleCurve = new CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => {
      const a = (i / 12) * Math.PI;
      return new Vector3(Math.cos(a) * (rTop + 0.012), h + 0.02 + Math.sin(a) * 0.15, 0.0);
    }));
    const handle = new Mesh(new TubeGeometry(handleCurve, 32, 0.0045, 6), new MeshStandardMaterial({ color: "#5d666c", metalness: 0.7, roughness: 0.4 }));
    handle.rotation.y = 0.35;
    handle.castShadow = true;
    this.bucketStd.add(body, ...ribs, handle);
    // toon twin for the hand-drawn treatment
    const toon = new MeshToonMaterial({ color: "#b8c4cc", gradientMap: this.ramp });
    const tb = new Mesh(lathe, toon);
    const tl = new Mesh(lathe, outlineMaterial(INK, 0.006));
    const th = new Mesh(handle.geometry, new MeshToonMaterial({ color: "#5d666c", gradientMap: this.ramp }));
    th.rotation.y = 0.35;
    this.bucketToon.add(tb, tl, th);
    const water = new Mesh(new CircleGeometry(rBot + (rTop - rBot) * BUCKET.fill - 0.008, 40).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: "#4a8db8", roughness: 0.05, metalness: 0.2, envMap: this.env }));
    water.position.y = h * BUCKET.fill;
    water.name = "water";
    this.bucketInner.add(this.bucketStd, this.bucketToon, water);
    this.bucketPivot.add(this.bucketInner);
  }

  private poseBucket(tr: Treatment, t: number, b: BeatTimes) {
    const pose = bucketPose(tr, t, b);
    const fr = bucketFrame(pose);
    this.bucketPivot.position.set(fr.pivot[0], fr.pivot[1], BUCKET.z);
    this.bucketPivot.rotation.set(0, 0, (pose.angle * Math.PI) / 180);
    this.bucketInner.position.set(BUCKET.x + pose.slide - fr.pivot[0], 0, 0);
    this.bucketInner.scale.set(1 / Math.sqrt(pose.squash), pose.squash, 1 / Math.sqrt(pose.squash));
    this.waterDisc.visible = pose.water > 0.02;
    this.waterDisc.scale.setScalar(0.4 + 0.6 * pose.water);
    this.waterDisc.position.y = BUCKET.h * BUCKET.fill * (0.3 + 0.7 * pose.water);
    const sh = this.drawnShadows.getObjectByName("bucket-shadow");
    if (sh) sh.position.set(BUCKET.x + pose.slide + (pose.angle < -45 ? 0.12 : 0), 0.003, BUCKET.z);
    return fr;
  }

  /** Configure and pose the stage for one view. Returns what was shown. */
  show(v: BucketView): BucketShown {
    const tr = v.treatment;
    const tq = stepped(v.t, v.timing.step);
    const drawn = tr === "drawn";
    this.realSet.visible = !drawn;
    this.paperSet.visible = drawn;
    this.bucketStd.visible = !drawn;
    this.bucketToon.visible = drawn;
    this.real.visible = tr === "real";
    this.cartoon.visible = tr === "cartoon";
    this.drawn.visible = drawn;
    this.key.castShadow = !drawn;
    this.poseBucket(tr, tq, v.beat);
    const out: BucketShown = { sampleT: tq, phase: "", particles: 0, flash: false, drawing: -1 };
    const grid = v.raster ? this.rasterGrid.fill(0) : null;
    if (tr === "real") this.showReal(v, tq, out, grid);
    else if (tr === "cartoon") this.showCartoon(v, tq, out, grid);
    else this.showDrawn(v, tq, out, grid);
    this.vectors.visible = tr === "real" && v.vectors && v.inspect;
    this.trail.visible = tr === "cartoon" && v.vectors && v.inspect;
    this.cardFrame.visible = drawn && v.inspect;
    if (this.solverGrid) this.solverGrid.visible = tr === "real" && v.raster && v.inspect;
    this.showRaster(grid, v);
    return out;
  }

  private showReal(v: BucketView, tq: number, out: BucketShown, grid: Uint8Array | null) {
    const bake = v.bake;
    if (!bake) {
      this.drops.count = 0;
      out.phase = "baking";
      return;
    }
    const n = Math.min(bake.sim.n, this.dropMax);
    const simT = realSimTime(tq, v.beat, v.timing.hold, v.phys.stylization);
    const shown = bake.sample(simT, this.posA);
    bake.sample(simT - 1 / 60, this.posB);
    out.sampleT = shown;
    out.phase = simT < v.beat.release ? "in the bucket" : simT < bake.sim.firstContact ? "sheet in the air" : simT < bake.sim.firstContact + 0.45 ? "splash & spray" : "puddle spreads";
    this.ensureSolverGrid(bake.sim.h, bake.key);
    // drawn a little larger than the solver radius so neighbours merge into one glossy mass
    const r = bake.sim.radius * 1.55;
    let k = 0;
    const vec = this.vectors.geometry.getAttribute("position") as BufferAttribute;
    let nv = 0;
    const PW = 128;
    const PH = 96;
    this.puddleAcc.fill(0);
    for (let i = 0; i < n; i++) {
      const x = this.posA[i * 3];
      if (Number.isNaN(x)) continue;
      const y = this.posA[i * 3 + 1];
      const z = this.posA[i * 3 + 2];
      const px = this.posB[i * 3];
      const vx = Number.isNaN(px) ? 0 : (x - px) * 60;
      const vy = Number.isNaN(px) ? 0 : (y - this.posB[i * 3 + 1]) * 60;
      const vz = Number.isNaN(px) ? 0 : (z - this.posB[i * 3 + 2]) * 60;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const ground = y < r * 2.4;
      if (ground) {
        const u = ((x - PUDDLE.x0) / (PUDDLE.x1 - PUDDLE.x0)) * PW;
        const w = ((z - PUDDLE.z0) / (PUDDLE.z1 - PUDDLE.z0)) * PH;
        const cu = Math.floor(u);
        const cw = Math.floor(w);
        for (let dw = -1; dw <= 1; dw++)
          for (let du = -1; du <= 1; du++) {
            const a = cu + du;
            const b = PH - 1 - (cw + dw);
            if (a < 0 || b < 0 || a >= PW || b >= PH) continue;
            this.puddleAcc[b * PW + a] += du === 0 && dw === 0 ? 1 : 0.45;
          }
      }
      // droplets resting in the puddle shrink into the sheet; moving ones streak along their velocity
      const rest = ground ? (sp < 0.35 ? 0.22 : 0.6) : 1;
      // only fast spray streaks; the bulk stays round so neighbours read as one surface
      const streak = sp > 1.6 ? Math.min(1.7, 1 + ((sp - 1.6) * 0.3) / 60 / r) : 1;
      tmpV.set(vx, vy, vz);
      if (sp > 1e-4) tmpQ.setFromUnitVectors(UP, tmpV.multiplyScalar(1 / sp));
      else tmpQ.identity();
      tmpS.set(r * rest / Math.sqrt(streak), r * rest * streak, r * rest / Math.sqrt(streak));
      tmpP.set(x, y, z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.drops.setMatrixAt(k++, tmpM);
      if (v.inspect && v.vectors && !ground && i % 7 === 0 && nv < vec.count / 2) {
        vec.setXYZ(nv * 2, x, y, z);
        vec.setXYZ(nv * 2 + 1, x + vx * 0.05, y + vy * 0.05, z + vz * 0.05);
        nv++;
      }
    }
    this.drops.count = k;
    this.drops.instanceMatrix.needsUpdate = true;
    out.particles = k;
    vec.needsUpdate = true;
    this.vectors.geometry.setDrawRange(0, nv * 2);
    // the puddle sheet: splatted density, blurred, soft-thresholded into alpha
    const acc = this.puddleAcc;
    const tmp = new Float32Array(acc.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < PH; y++)
        for (let x = 0; x < PW; x++) {
          const i = y * PW + x;
          tmp[i] = (acc[i] * 2 + (x > 0 ? acc[i - 1] : 0) + (x < PW - 1 ? acc[i + 1] : 0) + (y > 0 ? acc[i - PW] : 0) + (y < PH - 1 ? acc[i + PW] : 0)) / 6;
        }
      acc.set(tmp);
    }
    const dens = 1.4 * (2400 / Math.max(300, bake.sim.n)) ** 0.66;
    for (let i = 0; i < acc.length; i++) {
      const a = Math.max(0, Math.min(1, (acc[i] * dens - 0.25) / 0.9));
      const j = i * 4;
      const b = Math.round(a * 255);
      this.puddleData[j] = b;
      this.puddleData[j + 1] = b;
      this.puddleData[j + 2] = b;
      this.puddleData[j + 3] = 255;
    }
    this.puddleTex.needsUpdate = true;
    if (grid) rasterParticles(this.posA, n, grid);
  }

  private ensureSolverGrid(h: number, key: string) {
    if (this.solverKey === key && this.solverGrid) return;
    if (this.solverGrid) {
      this.real.remove(this.solverGrid);
      this.solverGrid.geometry.dispose();
    }
    const pts: number[] = [];
    const x0 = -0.6;
    const x1 = 1.7;
    const y1 = 0.9;
    const z = IMPACT.z;
    for (let x = x0; x <= x1 + 1e-6; x += h) pts.push(x, 0, z, x, y1, z);
    for (let y = 0; y <= y1 + 1e-6; y += h) pts.push(x0, y, z, x1, y, z);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    this.solverGrid = new LineSegments(g, new LineBasicMaterial({ color: "#7fd9ff", transparent: true, opacity: 0.12, depthTest: false }));
    this.solverGrid.renderOrder = 8;
    this.real.add(this.solverGrid);
    this.solverKey = key;
  }

  private showCartoon(v: BucketView, tq: number, out: BucketShown, grid: Uint8Array | null) {
    const pose = cartoonPose(tq, v.beat, v.phys);
    out.phase = pose.phase;
    this.applyCartoon(pose);
    out.particles = pose.blobs.length + (pose.crown ? 1 : 0);
    if (grid) rasterPrims(cartoonPrims(pose), grid);
    // inspect: every authored blob centre over the loop (the keyed paths)
    const key = JSON.stringify([v.phys, v.timing]);
    if (v.inspect && v.vectors && key !== this.trailKey) {
      const pts: number[] = [];
      for (let f = 0; f < 96; f++) {
        const p = cartoonPose(f / FPS, v.beat, v.phys);
        for (const b of p.blobs) pts.push(b.x, b.y, b.z);
      }
      this.trail.geometry.dispose();
      this.trail.geometry = new BufferGeometry();
      this.trail.geometry.setAttribute("position", new Float32BufferAttribute(pts, 3));
      this.trailKey = key;
    }
  }

  private applyCartoon(pose: CartoonPose) {
    const cam = this.camera;
    let k = 0;
    let ks = 0;
    for (const b of pose.blobs) {
      if (b.r < 0.002) continue;
      const s = Math.max(0.2, b.stretch);
      tmpV.set(b.dx, b.dy, 0);
      if (tmpV.lengthSq() < 1e-8) tmpV.set(0, 1, 0);
      tmpQ.setFromUnitVectors(UP, tmpV.normalize());
      const along = b.r * s;
      const across = b.r / Math.sqrt(s);
      tmpP.set(b.x, b.y, b.z);
      tmpS.set(across, along, across);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.blobs.setMatrixAt(k, tmpM);
      const o = 0.011;
      tmpS.set(across + o, along + o, across + o);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.blobLines.setMatrixAt(k, tmpM);
      k++;
      if (b.shine && b.r > 0.025) {
        // a cartoon glint: a small white oval on the lit, camera-facing side
        tmpV.copy(cam.position).sub(tmpP).normalize();
        tmpP.addScaledVector(tmpV, b.r * 0.92);
        tmpP.x -= across * 0.32;
        tmpP.y += along * 0.3;
        tmpS.set(b.r * 0.3, b.r * 0.16, 1);
        tmpQ.copy(cam.quaternion).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.5 + Math.atan2(b.dy, b.dx) * 0.2));
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.shines.setMatrixAt(ks++, tmpM);
      }
    }
    this.blobs.count = k;
    this.blobLines.count = k;
    this.shines.count = ks;
    for (const m of [this.blobs, this.blobLines, this.shines]) m.instanceMatrix.needsUpdate = true;
    const c = pose.crown;
    this.crown.visible = this.crownLine.visible = !!c && c.h > 0.004;
    if (c && c.h > 0.004) updateCrownGeometry(this.crownGeo, c);
    const p = pose.puddle;
    this.puddleToon.visible = this.puddleToonLine.visible = !!p;
    if (p) {
      updateDiscGeometry(this.puddleGeo, p.x, p.z, p.r, p.wob, p.phase);
      this.puddleToonLine.scale.set(1, 1, 1);
      // the ink edge: same disc, a touch larger, under it
      this.puddleToonLine.position.set(p.x * -0.012 / Math.max(0.05, p.r), 0.004, p.z * -0.012 / Math.max(0.05, p.r));
      this.puddleToonLine.scale.set(1 + 0.012 / Math.max(0.05, p.r), 1, 1 + 0.012 / Math.max(0.05, p.r));
    }
    let ns = 0;
    for (const s of pose.satellites) {
      if (s.r < 0.003 || ns >= 16) continue;
      tmpP.set(s.x, 0.0065, s.z);
      tmpQ.identity();
      tmpS.set(s.r, 1, s.r * 0.85);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.sats.setMatrixAt(ns, tmpM);
      tmpP.y = 0.005;
      tmpS.set(s.r + 0.01, 1, s.r * 0.85 + 0.01);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.satLines.setMatrixAt(ns, tmpM);
      ns++;
    }
    this.sats.count = this.satLines.count = ns;
    this.sats.instanceMatrix.needsUpdate = this.satLines.instanceMatrix.needsUpdate = true;
    const ring = pose.ring;
    this.ringMesh.visible = !!ring;
    if (ring) {
      this.ringMesh.position.set(ring.x, 0.009, ring.z);
      this.ringMesh.scale.set(ring.r, 1, ring.r * 0.85);
      (this.ringMesh.material as MeshBasicMaterial).opacity = ring.alpha;
    }
  }

  private showDrawn(v: BucketView, tq: number, out: BucketShown, grid: Uint8Array | null) {
    const dw = drawingAt(tq, v.t, v.beat, v.phys, v.timing.step);
    out.phase = dw.phase;
    out.drawing = dw.index;
    out.flash = dw.impact > 0;
    out.particles = dw.card.length + dw.floor.length;
    const key = `${dw.index}|${dw.impact}|${JSON.stringify(v.phys)}|${JSON.stringify(v.timing)}`;
    if (key !== this.lastDrawingKey) {
      this.paintCard(dw);
      this.lastDrawingKey = key;
    }
    if (grid) rasterPrims(cardToWorld(drawingFills(dw)), grid);
    if (dw.impact) this.prepareFlash(dw);
  }

  private paintCard(dw: Drawing) {
    const { c, g, tex } = this.card;
    g.clearRect(0, 0, c.width, c.height);
    const sx = c.width / (CARD.x1 - CARD.x0);
    const sy = c.height / (CARD.y1 - CARD.y0);
    const map = (x: number, y: number): [number, number] => [(x - CARD.x0) * sx, c.height - (y - CARD.y0) * sy];
    if (!dw.impact) drawInks(g, dw.card, map, sx / 420);
    tex.needsUpdate = true;
    const d = this.decal;
    d.g.clearRect(0, 0, d.c.width, d.c.height);
    const dx = d.c.width / (DECAL.x1 - DECAL.x0);
    const dz = d.c.height / (DECAL.z1 - DECAL.z0);
    drawInks(d.g, dw.floor, (x, z) => [(x - DECAL.x0) * dx, (z - DECAL.z0) * dz], dx / 420);
    d.tex.needsUpdate = true;
  }

  private prepareFlash(dw: Drawing) {
    const cam = this.camera;
    const pts = splat(dw.flashAt[0], dw.flashAt[1] - 0.06, 0.42, 11, 5, 0.85);
    const shape = new Shape();
    for (let i = 0; i < pts.length; i += 2) {
      tmpP.set(pts[i], pts[i + 1], CARD.z).project(cam);
      if (i === 0) shape.moveTo(tmpP.x, tmpP.y);
      else shape.lineTo(tmpP.x, tmpP.y);
    }
    this.flashSplat.geometry.dispose();
    this.flashSplat.geometry = new ShapeGeometry(shape);
  }

  /** The impact frame: the picture drops to two flat values (silhouettes on ink), then the splat. */
  renderFlash(gl: WebGLRenderer, scene: Scene) {
    const prevOverride = scene.overrideMaterial;
    const keep = [this.realSet.visible, this.paperSet.visible, this.drawn.visible];
    this.realSet.visible = this.paperSet.visible = this.drawn.visible = false;
    this.raster.visible = false;
    gl.setClearColor(INK, 1);
    gl.clear();
    scene.overrideMaterial = this.white;
    gl.render(scene, this.camera);
    scene.overrideMaterial = prevOverride;
    [this.realSet.visible, this.paperSet.visible, this.drawn.visible] = keep;
    const auto = gl.autoClear;
    gl.autoClear = false;
    (this.flashBg.material as MeshBasicMaterial).opacity = 0;
    gl.render(this.flashScene, this.flashCam);
    gl.autoClear = auto;
  }

  private showRaster(grid: Uint8Array | null, v: BucketView) {
    if (!grid || !v.inspect) {
      this.raster.count = 0;
      this.raster.visible = false;
      return;
    }
    this.raster.visible = true;
    const f = frameOf(v.t);
    const legible = v.legibility?.frames[f]?.legible ?? false;
    const col = new Color(legible ? "#8ef0c3" : "#ffb547");
    let k = 0;
    for (let cy = 0; cy < GH; cy++)
      for (let cx = 0; cx < GW; cx++) {
        if (!grid[cy * GW + cx]) continue;
        tmpP.set(GRID.x0 + (cx + 0.5) * GRID.cell, GRID.y0 + (cy + 0.5) * GRID.cell, IMPACT.z + 0.32);
        tmpM.makeTranslation(tmpP.x, tmpP.y, tmpP.z);
        this.raster.setMatrixAt(k, tmpM);
        this.raster.setColorAt(k, col);
        k++;
      }
    this.raster.count = k;
    this.raster.instanceMatrix.needsUpdate = true;
    if (this.raster.instanceColor) this.raster.instanceColor.needsUpdate = true;
  }

  dispose() {
    disposeTree(this.root);
    disposeTree(this.flashScene);
    this.env?.dispose();
    this.ramp.dispose();
    this.white.dispose();
  }
}

/** Puddle sheet extents (x, z). */
const PUDDLE = { x0: -0.7, x1: 2.4, z0: -1.05, z1: 1.25 } as const;

/** Paint ink shapes onto a 2D canvas. `map` converts shape space to pixels; `px` scales line widths. */
export function drawInks(g: CanvasRenderingContext2D, inks: Ink[], map: (x: number, y: number) => [number, number], px: number) {
  g.lineJoin = "round";
  g.lineCap = "round";
  for (const s of inks) {
    if (s.kind === "fill") {
      g.beginPath();
      for (let i = 0; i < s.pts.length; i += 2) {
        const [x, y] = map(s.pts[i], s.pts[i + 1]);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = s.fill;
      g.fill();
      if (s.line > 0) {
        g.strokeStyle = PAL.ink;
        g.lineWidth = s.line * px * 1.6;
        g.stroke();
      }
    } else if (s.kind === "stroke") {
      g.beginPath();
      for (let i = 0; i < s.pts.length; i += 2) {
        const [x, y] = map(s.pts[i], s.pts[i + 1]);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = s.color;
      g.lineWidth = s.width * px * 1.6;
      g.stroke();
    } else {
      const [cx, cy] = map(s.x, s.y);
      const [ex] = map(s.x + s.r, s.y);
      const r = Math.abs(ex - cx);
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = s.rot + (i * Math.PI) / 4;
        const rr = i % 2 === 0 ? r : r * 0.28;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = s.fill;
      g.fill();
      g.strokeStyle = PAL.ink;
      g.lineWidth = 2 * px * 1.6;
      g.stroke();
    }
  }
}

/* Crown geometry: M columns around × P profile points (outer up, lip, inner down). */
const CM = 72;
const CP = 8;
function initCrownGeometry(g: BufferGeometry) {
  g.setAttribute("position", new BufferAttribute(new Float32Array(CM * CP * 3), 3).setUsage(DynamicDrawUsage));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(CM * CP * 3), 3).setUsage(DynamicDrawUsage));
  const idx: number[] = [];
  for (let i = 0; i < CM; i++) {
    const i2 = (i + 1) % CM;
    for (let j = 0; j < CP - 1; j++) {
      const a = i * CP + j;
      const b = i2 * CP + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  g.setIndex(idx);
}

function updateCrownGeometry(g: BufferGeometry, c: NonNullable<CartoonPose["crown"]>) {
  const pos = g.getAttribute("position") as BufferAttribute;
  const n = c.points;
  for (let i = 0; i < CM; i++) {
    const th = (i / CM) * Math.PI * 2;
    // spikes sit on the crown's rim points (crownAngle: 2πk/n + 0.35)
    const rel = (th - 0.35) / ((Math.PI * 2) / n);
    const k = ((Math.round(rel) % n) + n) % n;
    const bump = Math.max(0, Math.cos((rel - Math.round(rel)) * Math.PI)) ** 4;
    const top = c.h * (1 + c.spike * (1 + c.jitter[k]) * bump);
    const prof: [number, number][] = [];
    for (let j = 0; j < 4; j++) {
      const v = j / 3;
      prof.push([c.r0 + (c.r1 - c.r0) * v ** 1.4, v * top]);
    }
    for (let j = 3; j >= 0; j--) {
      const v = j / 3;
      prof.push([Math.max(0.005, c.r0 + (c.r1 - c.r0) * v ** 1.4 - c.thick * (1 - 0.6 * v)), v * top * 0.985]);
    }
    for (let j = 0; j < CP; j++) {
      const [r, y] = prof[j];
      pos.setXYZ(i * CP + j, c.x + Math.cos(th) * r, y, c.z + Math.sin(th) * r);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

const DN = 56;
function initDiscGeometry(g: BufferGeometry) {
  g.setAttribute("position", new BufferAttribute(new Float32Array((DN + 1) * 3), 3).setUsage(DynamicDrawUsage));
  g.setAttribute("normal", new BufferAttribute(new Float32Array((DN + 1) * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const idx: number[] = [];
  for (let i = 0; i < DN; i++) idx.push(0, 1 + ((i + 1) % DN), 1 + i);
  g.setIndex(idx);
}

function updateDiscGeometry(g: BufferGeometry, x: number, z: number, r: number, wob: number, phase: number) {
  const pos = g.getAttribute("position") as BufferAttribute;
  pos.setXYZ(0, x, 0, z);
  for (let i = 0; i < DN; i++) {
    const a = (i / DN) * Math.PI * 2;
    const k = 1 + wob * (0.6 * Math.sin(3 * a + phase) + 0.4 * Math.sin(5 * a - phase * 1.3));
    pos.setXYZ(1 + i, x + Math.cos(a) * r * k * 1.1, 0, z + Math.sin(a) * r * k * 0.9);
  }
  pos.needsUpdate = true;
  g.computeBoundingSphere();
}

/** Unused-import guard for tree-shaking friendly builds. */
export const _blend = AdditiveBlending;
