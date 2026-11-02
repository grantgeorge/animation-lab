"use client";

import { useCallback, useRef } from "react";
import { CLEAN_LINE, TECHNIQUES, techniqueOf } from "../content";
import { LAYER_IDS, stepOf } from "../engine/types";
import { registerSlot } from "../live";
import { ptStore, usePT } from "../store";

/** The shot (16:9) with the clean ↔ painted wipe. Left of the handle is clean 3D. */
function ShotFrame() {
  const wipe = usePT((s) => s.wipe);
  const mode = usePT((s) => s.mode);
  const layers = usePT((s) => s.layers);
  const drag = useRef(false);
  const register = useCallback((el: HTMLDivElement | null) => registerSlot("picture", el), []);
  const setFrom = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    ptStore.getState().setWipe((e.clientX - r.left) / r.width);
  };
  const on = LAYER_IDS.filter((id) => layers[id]).length;
  return (
    <div
      ref={register}
      className="pt-frame"
      data-testid="look-frame"
      data-wipe={wipe.toFixed(3)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFrom(e);
      }}
      onPointerMove={(e) => drag.current && setFrom(e)}
      onPointerUp={(e) => {
        drag.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    >
      <div className="pt-frame-caption" aria-hidden>
        <span>WORKSHOP · 35 MM · 16:9</span>
        <span>{on === 0 ? "CLEAN 3D" : `PAINTED · ${on}/5 LAYERS`}</span>
      </div>
      {wipe > 0.04 && <span className="pt-tag pt-tag-left">CLEAN 3D</span>}
      {wipe < 0.96 && wipe > 0.04 && <span className="pt-tag pt-tag-right">PAINTED</span>}
      <div className="pt-wipe" style={{ left: `${wipe * 100}%` }} data-testid="wipe-handle">
        <span className="pt-wipe-knob" aria-hidden>
          <svg width="14" height="10" viewBox="0 0 14 10">
            <path d="M4 1 0 5l4 4M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      </div>
      {mode === "watch" && wipe < 0.02 && <span className="pt-wipe-hint">Drag across the picture to compare with the clean 3D render</span>}
    </div>
  );
}

function InspectFrame() {
  const focus = usePT((s) => s.focus);
  const register = useCallback((el: HTMLDivElement | null) => registerSlot("picture", el), []);
  const registerPip = useCallback((el: HTMLDivElement | null) => registerSlot("pip", el), []);
  const t = techniqueOf(focus);
  const hint: Record<string, string> = {
    texture: "Unlit painted albedo on a turntable: the strokes are in the surface",
    shading: "Bands, cool shadows, warm light, a stroke of rim",
    projection: "Gold: the projector (the shot camera). Blue: where the camera is now. A doubled lamp is the lamp painted into the matte, now landing on the wall behind it",
    overlays: "Exploded: every effect is a flat painted card",
    composite: "The whole frame, before the screen-space finish",
  };
  return (
    <div ref={register} className="pt-observer" data-testid="observer-window" aria-label="3D breakdown: drag to orbit">
      <div className="pt-frame-caption" aria-hidden>
        <span>
          INSPECT · {t.n} {t.title.toUpperCase()}
        </span>
        <span>DRAG TO ORBIT</span>
      </div>
      <p className="pt-observer-hint">{hint[focus]}</p>
      <div ref={registerPip} className="pt-pip" data-testid="pip">
        <span>SHOT · FINAL</span>
      </div>
    </div>
  );
}

export function LookPicture() {
  const mode = usePT((s) => s.mode);
  return <div className="pt-picture" data-testid="look-picture">{mode === "inspect" ? <InspectFrame /> : <ShotFrame />}</div>;
}

/** The five techniques as a build-up: click a number to stack up to it, the dot to toggle one alone. */
export function BuildUp() {
  const layers = usePT((s) => s.layers);
  const focus = usePT((s) => s.focus);
  const mode = usePT((s) => s.mode);
  const step = stepOf(layers);
  const t = techniqueOf(focus);
  const st = ptStore.getState();
  return (
    <section className="pt-buildup" data-testid="build-up" aria-label="The five techniques">
      <div className="pt-steps">
        <button type="button" className="pt-step pt-step-zero" aria-pressed={step === 0} data-testid="step-0" onClick={() => st.setStep(0)}>
          <span className="pt-step-n">0</span>
          <span className="pt-step-name">Clean 3D</span>
        </button>
        {TECHNIQUES.map((tech) => {
          const on = layers[tech.id];
          return (
            <div key={tech.id} className="pt-step" data-on={on ? "1" : "0"} data-focus={focus === tech.id ? "1" : "0"}>
              <button
                type="button"
                className="pt-step-main"
                data-testid={`step-${tech.n}`}
                onClick={() => (mode === "inspect" ? st.setFocus(tech.id) : st.setStep(tech.n))}
                title={mode === "inspect" ? `Inspect ${tech.title}` : `Build up to ${tech.title}`}
              >
                <span className="pt-step-n">{tech.n}</span>
                <span className="pt-step-name">{tech.short}</span>
                <span className={`pt-space pt-space-${tech.space}`}>{tech.space}</span>
              </button>
              <button
                type="button"
                className="pt-step-toggle"
                role="switch"
                aria-checked={on}
                aria-label={`${tech.title} on/off`}
                data-testid={`layer-${tech.id}`}
                onClick={() => st.toggleLayer(tech.id)}
              />
            </div>
          );
        })}
      </div>
      <div className="pt-step-detail" data-testid="technique-detail" data-layer={step === 0 ? "clean" : focus}>
        <span className="pt-step-detail-n">{step === 0 ? 0 : t.n}</span>
        <p>
          {step === 0 ? (
            <>
              <b>Clean 3D.</b> {CLEAN_LINE}
            </>
          ) : (
            <>
              <b>{t.title}.</b> {t.line}
            </>
          )}
        </p>
      </div>
    </section>
  );
}
