import { CanvasTexture, DataTexture, DataUtils, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { periodicFbm2, periodicNoise2, rng } from "../engine/noise";
import { strokeLayout, TILE_LAYOUT, wrapOffsets, type Stroke } from "../engine/strokes";

/**
 * Procedural painted textures, drawn once on the client with seeded randomness (deterministic).
 * The brush tile is a DATA texture: R = stroke value, G = warm/cool hue id, B = break mask.
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** One gouache dab: tapered body plus dry-brush bristle streaks. */
function drawStroke(g: CanvasRenderingContext2D, s: Stroke, ox: number, oy: number) {
  const r = rng(s.seed);
  const R = Math.round(s.value * 255), G = Math.round(s.hue * 255), B = Math.round(s.mask * 255);
  g.save();
  g.translate(s.x + ox, s.y + oy);
  g.rotate(s.angle);
  const L = s.length / 2;
  const W = s.width / 2;
  // body: a leaf shape, blunt at the start, tapering out
  g.beginPath();
  g.moveTo(-L, -W * 0.7);
  g.bezierCurveTo(-L * 0.3, -W * 1.15, L * 0.5, -W * 0.9, L, -W * 0.1);
  g.bezierCurveTo(L * 0.55, W * 0.95, -L * 0.3, W * 1.1, -L, W * 0.7);
  g.bezierCurveTo(-L * 1.12, W * 0.2, -L * 1.12, -W * 0.3, -L, -W * 0.7);
  g.closePath();
  g.fillStyle = `rgba(${R},${G},${B},0.92)`;
  g.fill();
  // bristles: thin streaks with slight value drift, fading where the brush runs dry
  for (let i = 0; i < s.bristles; i++) {
    const y = (r() * 2 - 1) * W * 0.85;
    const dv = (r() * 2 - 1) * 34;
    const start = -L + r() * L * 0.3;
    const end = L * (0.35 + r() * 0.6);
    g.beginPath();
    g.moveTo(start, y);
    g.quadraticCurveTo((start + end) / 2, y + (r() * 2 - 1) * 2, end, y + (r() * 2 - 1) * 2.5);
    g.lineWidth = 0.8 + r() * 2.2;
    g.strokeStyle = `rgba(${Math.max(0, Math.min(255, R + dv))},${G},${B},${0.35 + r() * 0.35})`;
    g.stroke();
  }
  g.restore();
}

export function brushTileCanvas(size = TILE_LAYOUT.size): HTMLCanvasElement {
  const c = canvas(size, size);
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, size, size);
  for (const s of strokeLayout({ ...TILE_LAYOUT, size })) for (const [ox, oy] of wrapOffsets(s, size)) drawStroke(g, s, ox, oy);
  return c;
}

export function brushTexture(): { texture: Texture; canvas: HTMLCanvasElement } {
  const c = brushTileCanvas();
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 4;
  t.name = "painterly-brush-tile";
  return { texture: t, canvas: c };
}

/** Tileable watercolour paper: soft cloud, fibres and a faint weave. Grey 128 = neutral. */
export function paperTexture(size = 512): Texture {
  const c = canvas(size, size);
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const d = img.data;
  const period = 16;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period, v = (y / size) * period;
      const cloud = periodicFbm2(u, v, period, 4, 3);
      const tooth = periodicNoise2(u * 8, v * 8, period * 8, 9);
      const weave = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 96) * Math.sin((y / size) * Math.PI * 2 * 96);
      const val = 0.5 + (cloud - 0.5) * 0.55 + (tooth - 0.5) * 0.42 + (weave - 0.5) * 0.06;
      const k = Math.max(0, Math.min(255, Math.round(val * 255)));
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = k;
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  // fibres
  const r = rng(21);
  g.globalAlpha = 0.07;
  for (let i = 0; i < 260; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 6 + r() * 26;
    g.strokeStyle = r() > 0.5 ? "#fff" : "#000";
    g.lineWidth = 0.6 + r();
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * l * 0.5 + r() * 3, y + oy + Math.sin(a) * l * 0.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      g.stroke();
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.name = "painterly-paper";
  return t;
}

/* ---------- 2D overlay cards (painted RGBA, sRGB) ---------- */

/** Feather a card to zero well inside its edges, so the quad never shows. */
function featherEdges(c: HTMLCanvasElement, inner = 0.55) {
  const g = c.getContext("2d")!;
  g.save();
  g.globalCompositeOperation = "destination-in";
  g.globalAlpha = 1;
  g.filter = "none";
  g.translate(c.width / 2, c.height / 2);
  g.scale(c.width / 2, c.height / 2);
  const m = g.createRadialGradient(0, 0, inner, 0, 0, 1);
  m.addColorStop(0, "rgba(0,0,0,1)");
  m.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = m;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
}

function cardTexture(c: HTMLCanvasElement, name: string, inner = 0.55): Texture {
  featherEdges(c, inner);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.name = name;
  return t;
}

/** A shaft of moonlight: soft vertical strokes, bright at the window, dying out on the floor. */
export function shaftCanvas(): HTMLCanvasElement {
  const c = canvas(256, 512);
  const g = c.getContext("2d")!;
  const r = rng(31);
  for (let i = 0; i < 70; i++) {
    const x = 30 + r() * 196;
    const w = 4 + r() * 22;
    g.globalAlpha = 0.05 + r() * 0.09;
    g.strokeStyle = r() > 0.3 ? "#dbe8ff" : "#fff3d9";
    g.lineWidth = w;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, -10);
    g.bezierCurveTo(x + (r() - 0.5) * 18, 160, x + (r() - 0.5) * 24, 330, x + (r() - 0.5) * 30, 400 + r() * 120);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-in";
  const v = g.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, "rgba(0,0,0,0.95)");
  v.addColorStop(0.55, "rgba(0,0,0,0.55)");
  v.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 512);
  const h = g.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, "rgba(0,0,0,0)");
  h.addColorStop(0.25, "rgba(0,0,0,1)");
  h.addColorStop(0.75, "rgba(0,0,0,1)");
  h.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = h;
  g.fillRect(0, 0, 256, 512);
  return c;
}

/** A painted smoke wisp: a few curling, dry strokes. */
export function smokeCanvas(seed = 41): HTMLCanvasElement {
  const c = canvas(256, 384);
  const g = c.getContext("2d")!;
  const r = rng(seed);
  g.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    let x = 128 + (r() - 0.5) * 30;
    let y = 372;
    const amp = 18 + r() * 26;
    const phase = r() * 6;
    for (let s = 0; s < 26; s++) {
      const ny = y - 13;
      const nx = 128 + Math.sin(phase + s * 0.32) * amp * (0.4 + s / 26) + (r() - 0.5) * 4;
      g.globalAlpha = (0.08 + 0.08 * r()) * Math.sin((s / 26) * Math.PI);
      g.strokeStyle = r() > 0.4 ? "#efe6d8" : "#c9d3e2";
      g.lineWidth = 6 + s * 0.9 + r() * 6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(nx, ny);
      g.stroke();
      x = nx;
      y = ny;
    }
  }
  return c;
}

/** A painted highlight: a star of short bright strokes around a soft core. */
export function glintCanvas(): HTMLCanvasElement {
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  const r = rng(51);
  const core = g.createRadialGradient(128, 128, 0, 128, 128, 110);
  core.addColorStop(0, "rgba(255,236,200,0.75)");
  core.addColorStop(0.25, "rgba(255,200,130,0.28)");
  core.addColorStop(1, "rgba(255,180,110,0)");
  g.fillStyle = core;
  g.fillRect(0, 0, 256, 256);
  g.lineCap = "round";
  g.filter = "blur(1.5px)";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const l = 22 + r() * 36;
    g.globalAlpha = 0.12 + r() * 0.18;
    g.strokeStyle = "#fff4dc";
    g.lineWidth = 3 + r() * 6;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 10, 128 + Math.sin(a) * 10);
    g.lineTo(128 + Math.cos(a) * l, 128 + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}

/** Dry-brush scratches and wear, dark, for walls and floorboards. */
export function scratchCanvas(seed = 61): HTMLCanvasElement {
  const c = canvas(512, 256);
  const g = c.getContext("2d")!;
  const r = rng(seed);
  g.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    let x = r() * 512, y = r() * 256;
    const a = -0.4 + r() * 0.8;
    const n = 3 + Math.floor(r() * 6);
    g.globalAlpha = 0.18 + r() * 0.3;
    g.strokeStyle = r() > 0.85 ? "#7a5a3e" : "#24160c";
    g.lineWidth = 0.8 + r() * 2.4;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < n; k++) {
      x += Math.cos(a) * (8 + r() * 16);
      y += Math.sin(a) * (8 + r() * 16) + (r() - 0.5) * 3;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // soft-edge the card so it melts into the surface
  g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-in";
  const m = g.createRadialGradient(256, 128, 40, 256, 128, 260);
  m.addColorStop(0, "rgba(0,0,0,1)");
  m.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = m;
  g.fillRect(0, 0, 512, 256);
  return c;
}

export function cardTextures() {
  return {
    shaft: cardTexture(shaftCanvas(), "painterly-shaft", 0.7),
    smoke: [cardTexture(smokeCanvas(41), "painterly-smoke-a"), cardTexture(smokeCanvas(43), "painterly-smoke-b")],
    glint: cardTexture(glintCanvas(), "painterly-glint"),
    scratch: cardTexture(scratchCanvas(61), "painterly-scratch", 0.6),
  };
}

/* ---------- inverse tone curve for the projected matte ---------- */

const rrtOdt = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
/** three.js ACESFilmic on a grey value (its matrices preserve grey), exposure 1. */
export const acesGrey = (x: number) => Math.min(1, Math.max(0, rrtOdt(x / 0.6)));

export function acesInverseLut(n = 256): Texture {
  const data = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const target = Math.min(0.985, i / (n - 1));
    let lo = 0, hi = 32;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (acesGrey(mid) < target) lo = mid;
      else hi = mid;
    }
    data[i] = DataUtils.toHalfFloat((lo + hi) / 2);
  }
  const t = new DataTexture(data, n, 1, RedFormat, HalfFloatType);
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  t.name = "painterly-aces-inverse";
  return t;
}
