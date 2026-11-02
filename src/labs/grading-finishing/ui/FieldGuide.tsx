"use client";

import { useEffect, useRef } from "react";
import { CAPTION } from "../content";
import { gfStore, useGF } from "../store";

export function FieldGuide() {
  const open = useGF((s) => s.help);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="gf-guide" data-testid="field-guide" onClose={() => gfStore.getState().setHelp(false)}>
      <button type="button" className="gf-guide-close" aria-label="Close" onClick={() => gfStore.getState().setHelp(false)}>×</button>
      <span className="gf-eyebrow">Field guide</span>
      <h2>Grading &amp; Finishing</h2>
      <p>An AI or CG shot passes through three stages: <b>generation</b> (characters, lighting, set, camera), <b>grading</b> (colour: exposure, balance, contrast, palette, stock) and <b>finishing</b> (texture and optics: grain, halation, bloom, lens, sharpening, delivery).</p>
      <h3>Why the order matters</h3>
      <p>Grade first, on the clean picture. Stylize next. Then the lens, the film’s glow, vignette and sharpening, and grain last, so nothing blurs or warps it. Only the grade fits in a LUT.</p>
      <h3>Halation is not bloom</h3>
      <p>Halation is light bouncing off the film base back into the red layer: a tight red-orange rim on bright edges. Bloom is diffusion: a wide, neutral glow and lifted blacks.</p>
      <h3>Grain is not noise</h3>
      <p>Film grain clumps, is mostly monochrome, is strongest in the mids and changes every frame. A static or per-pixel colour noise overlay reads as video static.</p>
      <h3>One show look</h3>
      <p>Balance each clip, apply one show look to every shot, then override sparingly. This is the practical way to make clips from different days and models cut together. It can’t fix light direction, character design or rendering style; those have to be fixed at generation.</p>
      <dl className="gf-keys">
        <div><dt>W · I · E</dt><dd>Watch, Inspect, Experiment</dd></div>
        <div><dt>Space</dt><dd>Play / pause (grain freezes when paused)</dd></div>
        <div><dt>C</dt><dd>Before / after wipe</dd></div>
        <div><dt>1 · 2 · 3</dt><dd>Doorway, alley, workshop</dd></div>
        <div><dt>Esc</dt><dd>Close this guide</dd></div>
      </dl>
      <p className="gf-guide-note">{CAPTION}</p>
    </dialog>
  );
}
