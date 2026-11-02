"use client";

import { useEffect, useRef } from "react";
import { cbcr, histogram, parade, vectorscope, waveform } from "../engine/scopes";
import { live } from "../runtime/live";

const BINS = 72;
type Kind = "waveform" | "parade" | "vectorscope" | "histogram";

function drawDensity(ctx: CanvasRenderingContext2D, w: number, h: number, cols: number, bins: number, data: Float32Array, rgb: [number, number, number], x0 = 0, width = w) {
  const img = ctx.createImageData(cols, bins);
  for (let x = 0; x < cols; x++)
    for (let b = 0; b < bins; b++) {
      const v = data[x * bins + b];
      const i = ((bins - 1 - b) * cols + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = Math.round(v * 255);
    }
  const off = new OffscreenCanvas(cols, bins);
  off.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, x0, 0, width, h);
}

function graticule(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.font = "9px ui-monospace, monospace";
  ctx.lineWidth = 1;
  for (const v of [0, 25, 50, 75, 100]) {
    const y = Math.round(h - (v / 100) * (h - 1)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillText(String(v), 3, Math.max(9, y - 2));
  }
}

function draw(kind: Kind, c: HTMLCanvasElement) {
  const f = live.scope;
  const ctx = c.getContext("2d");
  if (!ctx || !f) return;
  const w = c.width, h = c.height;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#07080a";
  ctx.fillRect(0, 0, w, h);
  if (kind === "waveform") {
    drawDensity(ctx, w, h, f.width, BINS, waveform(f, BINS), [170, 240, 200]);
    graticule(ctx, w, h);
  } else if (kind === "parade") {
    const [r, g, b] = parade(f, BINS);
    const third = w / 3;
    ctx.globalCompositeOperation = "lighter";
    drawDensity(ctx, w, h, f.width, BINS, r, [255, 90, 90], 0, third - 2);
    drawDensity(ctx, w, h, f.width, BINS, g, [90, 255, 120], third + 1, third - 2);
    drawDensity(ctx, w, h, f.width, BINS, b, [100, 150, 255], 2 * third + 2, third - 2);
    ctx.globalCompositeOperation = "source-over";
    graticule(ctx, w, h);
  } else if (kind === "vectorscope") {
    const size = 96;
    const v = vectorscope(f, size);
    const side = Math.min(w, h);
    const x0 = (w - side) / 2;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      img.data[i * 4] = 190;
      img.data[i * 4 + 1] = 245;
      img.data[i * 4 + 2] = 215;
      img.data[i * 4 + 3] = Math.round(v[i] * 255);
    }
    const off = new OffscreenCanvas(size, size);
    off.getContext("2d")!.putImageData(img, 0, 0);
    const cx = w / 2, cy = h / 2, R = side / 2 - 2;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    // skin-tone line (≈123° in Cb/Cr)
    ctx.strokeStyle = "rgba(255,190,140,0.25)";
    ctx.beginPath();
    const [sb, sr] = cbcr(0.85, 0.62, 0.5);
    const sl = Math.hypot(sb, sr);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (sb / sl) * R, cy - (sr / sl) * R);
    ctx.stroke();
    // 75 % colour targets
    ctx.font = "8px ui-monospace, monospace";
    for (const [label, col] of [["R", [0.75, 0, 0]], ["Yl", [0.75, 0.75, 0]], ["G", [0, 0.75, 0]], ["Cy", [0, 0.75, 0.75]], ["B", [0, 0, 0.75]], ["Mg", [0.75, 0, 0.75]]] as [string, number[]][]) {
      const [cb, cr] = cbcr(col[0], col[1], col[2]);
      const x = cx + cb * 1.6 * 2 * R, y = cy - cr * 1.6 * 2 * R;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.strokeRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText(label, x + 5, y + 3);
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(off, x0 + 2, 2, side - 4, side - 4);
    ctx.globalCompositeOperation = "source-over";
  } else {
    const hst = histogram(f, 64);
    ctx.globalCompositeOperation = "lighter";
    const bar = (a: Float32Array, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < a.length; i++) ctx.lineTo((i / (a.length - 1)) * w, h - a[i] * (h - 6));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };
    bar(hst.r, "rgba(255,80,80,0.55)");
    bar(hst.g, "rgba(80,255,120,0.5)");
    bar(hst.b, "rgba(90,140,255,0.6)");
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (const q of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(q * w + 0.5, 0); ctx.lineTo(q * w + 0.5, h); ctx.stroke(); }
  }
}

const LABELS: Record<Kind, [string, string]> = {
  waveform: ["Waveform", "Luma by column: height is brightness, left to right follows the frame."],
  parade: ["RGB parade", "R, G and B side by side: unequal heights in a neutral area mean a cast."],
  vectorscope: ["Vectorscope", "Hue is angle, saturation is distance from centre. The warm line is skin tone."],
  histogram: ["Histogram", "How many pixels sit at each level: piled at an edge means clipping."],
};

export function Scopes() {
  const refs = useRef<Partial<Record<Kind, HTMLCanvasElement | null>>>({});
  useEffect(() => {
    let raf = 0;
    let seen = -1;
    const loop = () => {
      if (live.scopeVersion !== seen) {
        seen = live.scopeVersion;
        for (const k of Object.keys(LABELS) as Kind[]) {
          const c = refs.current[k];
          if (c) draw(k, c);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="gf-scopes" data-testid="scopes">
      {(Object.keys(LABELS) as Kind[]).map((k) => (
        <figure key={k} className="gf-scope" data-testid={`scope-${k}`}>
          <canvas ref={(el) => { refs.current[k] = el; }} width={k === "vectorscope" ? 200 : 300} height={k === "vectorscope" ? 200 : 132} />
          <figcaption>
            <b>{LABELS[k][0]}</b> {LABELS[k][1]}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
