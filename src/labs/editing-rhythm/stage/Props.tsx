"use client";

import { useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, MeshStandardMaterial, Vector3, type Group, type HemisphereLight, type DirectionalLight, type Mesh, type Object3D, type PointLight } from "three";
import { mats } from "@/scene/materials";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { MARKS } from "../engine/marks";
import { BEATS, SLIP, boxGlow, duskLevel, lampLevel, lidAngle, mothsOut, reelAt } from "../engine/source";

const DEG = Math.PI / 180;
const GLOW = "#7FF3E4";
const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const local = (t: number, reel: "main" | "kule" | "slip" | "mont") => {
  const r = reelAt(t);
  return r && r.reel === reel ? r.local : null;
};

/* ───────────── the crate and the glowing box ───────────── */

const BOX = { w: 0.25, h: 0.125, d: 0.18, lid: 0.04 };
/** Module-level: there is one box, and its glow is animated per frame. */
const BOX_MATS = {
  seam: new MeshStandardMaterial({ color: "#0d2b2a", emissive: new Color(GLOW), emissiveIntensity: 1, roughness: 0.4 }),
  inner: new MeshBasicMaterial({ color: new Color(GLOW), toneMapped: false }),
  beam: new MeshBasicMaterial({ color: new Color("#9ffcf0"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, vertexColors: true }),
  wood: new MeshStandardMaterial({ color: "#3b2416", roughness: 0.55, metalness: 0.05 }),
};

function GlowBox() {
  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const shaft = useRef<Mesh>(null);
  const m = BOX_MATS;
  const beamGeo = useMemo(() => {
    // an open cone whose vertex colours fade to black at the top (additive: black = invisible)
    const g = new CylinderGeometry(0.6, 0.09, 1.8, 32, 6, true);
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const u = 1 - (pos.getY(i) + 0.9) / 1.8;
      const v = Math.pow(u, 1.6);
      col[i * 3] = v;
      col[i * 3 + 1] = v;
      col[i * 3 + 2] = v;
    }
    g.setAttribute("color", new Float32BufferAttribute(col, 3));
    return g;
  }, []);
  useFrameUpdater(({ t }) => {
    const L = local(t, "main");
    if (root.current) root.current.visible = L !== null;
    if (L === null) {
      if (light.current) light.current.intensity = 0;
      return;
    }
    const g = boxGlow(L);
    if (lid.current) lid.current.rotation.x = -lidAngle(L) * DEG;
    m.seam.emissiveIntensity = 0.15 + g * 1.25;
    m.inner.color.set(GLOW).multiplyScalar(0.5 + g * 1.1);
    const burst = smooth(BEATS.reveal - 0.1, BEATS.reveal + 0.1, L) * (1 - smooth(BEATS.reveal + 0.2, BEATS.reveal + 2.6, L));
    m.beam.opacity = 0.32 * burst + 0.06 * smooth(15.5, 17, L);
    if (shaft.current) shaft.current.visible = m.beam.opacity > 0.005;
    if (light.current) light.current.intensity = 0.25 + g * 2.6;
  }, ORDER.POSE);
  const [x, y, z] = MARKS.box;
  const { w, h, d, lid: lt } = BOX;
  return (
    <>
      <group ref={root} position={[x, y, z]} rotation={[0, 18 * DEG, 0]}>
        {/* body: dark wood, brass corners, a glowing carved band */}
        <RoundedBox args={[w, h, d]} radius={0.012} smoothness={2} position={[0, h / 2, 0]} castShadow receiveShadow material={m.wood} />
        <mesh position={[0, h * 0.55, d / 2 + 0.001]} material={m.seam}>
          <boxGeometry args={[w * 0.74, 0.006, 0.003]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * w * 0.22, h * 0.55, d / 2 + 0.002]} rotation={[0, 0, 45 * DEG]} material={m.seam}>
            <boxGeometry args={[0.022, 0.022, 0.003]} />
          </mesh>
        ))}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.012), h / 2, sz * (d / 2 - 0.012)]} material={mats.brass()} castShadow>
            <boxGeometry args={[0.03, h + 0.006, 0.03]} />
          </mesh>
        ))}
        {/* inner light, seen when the lid opens */}
        <mesh position={[0, h - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.inner}>
          <planeGeometry args={[w * 0.86, d * 0.82]} />
        </mesh>
        {/* lid hinged on its back edge */}
        <group ref={lid} position={[0, h, -d / 2]}>
          <RoundedBox args={[w + 0.012, lt, d + 0.012]} radius={0.012} smoothness={2} position={[0, lt / 2, d / 2]} castShadow material={m.wood} />
          <mesh position={[0, lt + 0.002, d / 2]} material={mats.brass()}>
            <boxGeometry args={[w * 0.5, 0.004, 0.012]} />
          </mesh>
          <mesh position={[0, 0.003, d / 2]} material={m.inner}>
            <boxGeometry args={[w + 0.004, 0.004, d + 0.004]} />
          </mesh>
        </group>
        {/* the burst: a soft additive shaft of light */}
        <mesh ref={shaft} position={[0, h + 0.9, 0]} material={m.beam} geometry={beamGeo} />
      </group>
      <pointLight ref={light} position={[x, y + 0.3, z + 0.05]} color={GLOW} intensity={0} distance={3.2} decay={2} />
    </>
  );
}

function Crate() {
  const ref = useRef<Group>(null);
  useFrameUpdater(({ t }) => {
    if (ref.current) ref.current.visible = local(t, "main") !== null;
  }, ORDER.POSE);
  const [x, , z] = MARKS.crate;
  const H = MARKS.crateHeight;
  return (
    <group ref={ref} position={[x, 0, z]} rotation={[0, 18 * DEG, 0]}>
      <RoundedBox args={[0.46, H, 0.38]} radius={0.015} smoothness={2} position={[0, H / 2, 0]} castShadow receiveShadow material={mats.wood()} />
      {[0.1, 0.23, 0.36].map((yy) => (
        <mesh key={yy} position={[0, yy, 0.192]} material={mats.iron()}>
          <boxGeometry args={[0.47, 0.012, 0.006]} />
        </mesh>
      ))}
    </group>
  );
}

/* ───────────── the moths ───────────── */

const N_MOTHS = 24;
const rand = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function Moths() {
  const group = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const items = useRef<(Group | null)[]>([]);
  const wing = useMemo(() => new MeshBasicMaterial({ color: new Color("#5FE6D6"), transparent: true, opacity: 0.8, depthWrite: false, side: DoubleSide, toneMapped: false }), []);
  const body = useMemo(() => new MeshBasicMaterial({ color: new Color("#FFF2C4").multiplyScalar(1.4), toneMapped: false }), []);
  const params = useMemo(() => Array.from({ length: N_MOTHS }, (_, i) => ({ delay: rand(i, 1) * 1.6, speed: 0.22 + rand(i, 2) * 0.3, radius: 0.12 + rand(i, 3) * 0.55, spin: (rand(i, 4) > 0.5 ? 1 : -1) * (1.2 + rand(i, 5) * 1.6), phase: rand(i, 6) * Math.PI * 2, flap: 16 + rand(i, 7) * 10, size: 0.7 + rand(i, 8) * 0.6 })), []);
  const c = useMemo(() => new Vector3(), []);
  useFrameUpdater(({ t }) => {
    const L = local(t, "main");
    const on = L !== null && L > BEATS.moths;
    if (group.current) group.current.visible = on;
    if (!on || L === null) {
      if (light.current) light.current.intensity = 0;
      return;
    }
    const [bx, by, bz] = MARKS.box;
    c.set(0, 0, 0);
    let n = 0;
    params.forEach((p, i) => {
      const g = items.current[i];
      if (!g) return;
      const a = L - BEATS.moths - p.delay;
      if (a < 0) {
        g.visible = false;
        return;
      }
      g.visible = true;
      const rise = Math.min(a * p.speed * 1.6, 0.6) + Math.max(0, a - 0.4) * p.speed;
      const r = p.radius * smooth(0, 1.6, a) + 0.03;
      const ang = p.phase + p.spin * a;
      g.position.set(bx + Math.cos(ang) * r, by + 0.18 + rise + 0.05 * Math.sin(a * 3 + p.phase), bz + Math.sin(ang) * r * 0.8);
      g.rotation.set(0, -ang + Math.PI / 2, 0.3 * Math.sin(a * 2 + p.phase));
      const s = p.size * smooth(0, 0.3, a);
      g.scale.setScalar(s);
      const flap = Math.sin(a * p.flap) * 0.9;
      (g.children[0] as Object3D).rotation.z = flap;
      (g.children[1] as Object3D).rotation.z = -flap;
      c.add(g.position);
      n++;
    });
    if (n && light.current) {
      light.current.position.copy(c.multiplyScalar(1 / n));
      light.current.intensity = 1.6 * mothsOut(L);
    }
  }, ORDER.POSE);
  return (
    <>
      <group ref={group}>
        {params.map((_, i) => (
          <group key={i} ref={(el) => { items.current[i] = el; }}>
            <group>
              <mesh position={[0.019, 0, 0]} material={wing}>
                <circleGeometry args={[0.02, 10]} />
              </mesh>
            </group>
            <group>
              <mesh position={[-0.019, 0, 0]} material={wing}>
                <circleGeometry args={[0.02, 10]} />
              </mesh>
            </group>
            <mesh material={body}>
              <sphereGeometry args={[0.006, 6, 4]} />
            </mesh>
          </group>
        ))}
      </group>
      <pointLight ref={light} color="#BFFBF2" intensity={0} distance={3.5} decay={2} />
    </>
  );
}

/* ───────────── Kuleshov props: the gift (in Pip's hands) and the fallen lantern ───────────── */

function Gift() {
  const ref = useRef<Group>(null);
  const scene = useThree((s) => s.scene);
  const bones = useRef<{ l: Object3D | null; r: Object3D | null; root: Object3D | null }>({ l: null, r: null, root: null });
  const a = useMemo(() => new Vector3(), []);
  const b = useMemo(() => new Vector3(), []);
  const red = useMemo(() => new MeshStandardMaterial({ color: "#B8352F", roughness: 0.55 }), []);
  const gold = useMemo(() => new MeshStandardMaterial({ color: "#E9C46A", roughness: 0.35, metalness: 0.4 }), []);
  useFrameUpdater(({ t }) => {
    const g = ref.current;
    if (!g) return;
    const on = local(t, "kule") !== null;
    g.visible = on;
    if (!on) return;
    const k = bones.current;
    if (!k.l || !k.r) {
      const pip = scene.getObjectByName("Pip");
      k.root = pip ?? null;
      k.l = pip?.getObjectByName("LeftHand") ?? null;
      k.r = pip?.getObjectByName("RightHand") ?? null;
      if (!k.l || !k.r) return;
    }
    k.l.getWorldPosition(a);
    k.r.getWorldPosition(b);
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.position.y += 0.035;
    g.rotation.set(0, MARKS.kule.pipYaw * DEG, 0);
  }, ORDER.PRESENTATION);
  return (
    <group ref={ref} visible={false}>
      <RoundedBox args={[0.13, 0.1, 0.11]} radius={0.008} smoothness={2} material={red} castShadow />
      <mesh material={gold}>
        <boxGeometry args={[0.134, 0.104, 0.018]} />
      </mesh>
      <mesh material={gold}>
        <boxGeometry args={[0.02, 0.104, 0.114]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.02, 0.06, 0]} rotation={[Math.PI / 2, 0, s * 0.5]} material={gold}>
          <torusGeometry args={[0.018, 0.005, 6, 14]} />
        </mesh>
      ))}
    </group>
  );
}

const FLAME = new MeshStandardMaterial({ color: "#3a2410", emissive: new Color("#FF9B4A"), emissiveIntensity: 1.2, roughness: 0.5 });

function FallenLantern() {
  const ref = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const flame = FLAME;
  useFrameUpdater(({ t }) => {
    const L = local(t, "kule");
    if (ref.current) ref.current.visible = L !== null;
    const f = L === null ? 0 : 0.55 + 0.25 * Math.sin(L * 13.1) * Math.sin(L * 7.3 + 1) + 0.15 * Math.sin(L * 29);
    flame.emissiveIntensity = 0.12 + f * 0.55;
    if (light.current) light.current.intensity = L === null ? 0 : 0.35 + f * 0.7;
  }, ORDER.POSE);
  const [x, , z] = MARKS.kule.lantern;
  return (
    <>
      <group ref={ref} position={[x, 0, z]} rotation={[0, 0.35, 0]} visible={false}>
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, 0]} castShadow material={mats.iron()}>
          <cylinderGeometry args={[0.1, 0.16, 0.16, 20]} />
        </mesh>
        <mesh position={[-0.92, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={mats.iron()}>
          <cylinderGeometry args={[0.035, 0.045, 1.8, 14]} />
        </mesh>
        <group position={[-1.95, 0.13, 0.04]} rotation={[0.2, 0.3, Math.PI / 2 + 0.25]}>
          <mesh material={flame}>
            <boxGeometry args={[0.2, 0.28, 0.2]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.iron()} castShadow>
            <coneGeometry args={[0.2, 0.16, 4]} />
          </mesh>
          {[[0.11, 0.11], [-0.11, 0.11], [0.11, -0.11], [-0.11, -0.11]].map(([px, pz]) => (
            <mesh key={`${px}${pz}`} position={[px, 0, pz]} material={mats.iron()}>
              <boxGeometry args={[0.025, 0.3, 0.025]} />
            </mesh>
          ))}
        </group>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[-1.7 - rand(i, 9) * 0.5, 0.004, (rand(i, 10) - 0.5) * 0.5]} rotation={[-Math.PI / 2, 0, rand(i, 11) * 3]} material={mats.windowGlow()}>
            <planeGeometry args={[0.03 + rand(i, 12) * 0.04, 0.02 + rand(i, 13) * 0.03]} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[x - 1.75, 0.3, z + 0.75]} color="#FF9B4A" intensity={0} distance={2.4} decay={2} />
    </>
  );
}

/* ───────────── the banana peel ───────────── */

function Peel() {
  const ref = useRef<Group>(null);
  const yellow = useMemo(() => new MeshStandardMaterial({ color: "#E8C547", roughness: 0.6 }), []);
  const inner = useMemo(() => new MeshStandardMaterial({ color: "#F6EBC0", roughness: 0.7 }), []);
  const tip = useMemo(() => new MeshStandardMaterial({ color: "#4a3418", roughness: 0.8 }), []);
  useFrameUpdater(({ t }) => {
    const g = ref.current;
    if (!g) return;
    const L = local(t, "slip");
    g.visible = L !== null;
    if (L === null) return;
    const [px, , pz] = MARKS.slip.peel;
    // rest → shoots forward under the foot → (during the fall) pops into the air and lands
    const skid = smooth(SLIP.skid[0], SLIP.skid[1] + 0.15, L);
    const fly = Math.min(1, Math.max(0, (L - (SLIP.fall[0] - 0.05)) / 0.7));
    const x = px + 0.48 * skid + 1.0 * fly;
    const y = fly > 0 && fly < 1 ? 4 * fly * (1 - fly) * 0.6 : 0;
    g.position.set(x, y + 0.01, pz + 0.14 * fly);
    g.rotation.set(fly * Math.PI * 3, skid * 2.2 + fly * 5, 0);
  }, ORDER.POSE);
  return (
    <group ref={ref} visible={false} scale={1.6}>
      {[0, 2.1, 4.2].map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <mesh position={[0.055, 0.004, 0]} scale={[0.07, 0.012, 0.026]} material={yellow} castShadow>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
          <mesh position={[0.055, 0.012, 0]} scale={[0.058, 0.004, 0.018]} material={inner}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
          <mesh position={[0.12, 0.004, 0]} scale={[0.012, 0.01, 0.012]} material={tip}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.02, 0]} rotation={[0, 0, 0.6]} material={tip}>
        <cylinderGeometry args={[0.008, 0.011, 0.05, 8]} />
      </mesh>
    </group>
  );
}

/* ───────────── the montage: street lamps and the dusk light ───────────── */

const LAMP_HEADS = MARKS.mont.lamps.map(() => new MeshStandardMaterial({ color: "#2a2014", emissive: new Color("#FFB46A"), emissiveIntensity: 0, roughness: 0.4 }));

function Lamps() {
  const ref = useRef<Group>(null);
  const lights = useRef<(PointLight | null)[]>([]);
  const heads = LAMP_HEADS;
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  useFrameUpdater(({ t }) => {
    const L = local(t, "mont");
    if (ref.current) ref.current.visible = L !== null;
    MARKS.mont.lamps.forEach((_, k) => {
      const lv = L === null ? 0 : lampLevel(k, L);
      const flick = 1 + 0.05 * Math.sin((L ?? 0) * 9 + k * 2);
      heads[k].emissiveIntensity = lv * 5 * flick;
      const l = lights.current[k];
      if (l) l.intensity = lv * 8 * flick;
    });
    const dusk = L === null ? 0 : duskLevel(L);
    if (hemi.current) hemi.current.intensity = dusk * 2.0;
    if (sun.current) sun.current.intensity = dusk * 2.6;
  }, ORDER.POSE);
  return (
    <>
      <group ref={ref} visible={false}>
        {MARKS.mont.lamps.map((p, k) => (
          <group key={k} position={[p[0], 0, p[2]]}>
            <mesh position={[0, 0.07, 0]} material={mats.iron()} castShadow>
              <cylinderGeometry args={[0.09, 0.13, 0.14, 16]} />
            </mesh>
            <mesh position={[0, 1.05, 0]} material={mats.iron()} castShadow>
              <cylinderGeometry args={[0.03, 0.04, 2.1, 12]} />
            </mesh>
            <group position={[0, 2.22, 0]}>
              <mesh material={heads[k]}>
                <boxGeometry args={[0.18, 0.25, 0.18]} />
              </mesh>
              <mesh position={[0, 0.19, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.iron()}>
                <coneGeometry args={[0.18, 0.14, 4]} />
              </mesh>
              <mesh position={[0, -0.14, 0]} material={mats.iron()}>
                <boxGeometry args={[0.22, 0.03, 0.22]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      {MARKS.mont.lamps.map((p, k) => (
        <pointLight key={k} ref={(el) => { lights.current[k] = el; }} position={[p[0], 2.2, p[2] + 0.25]} color="#FFB46A" intensity={0} distance={5} decay={2} />
      ))}
      <hemisphereLight ref={hemi} args={["#8FA6E0", "#5a3a28", 0]} />
      <directionalLight ref={sun} position={[-6, 2.2, 3]} color="#FF9F6B" intensity={0} />
    </>
  );
}

/** Every lab prop; each shows itself only in its own reel (driven by master source time). */
export function Props() {
  return (
    <>
      <Crate />
      <GlowBox />
      <Moths />
      <Gift />
      <FallenLantern />
      <Peel />
      <Lamps />
    </>
  );
}

