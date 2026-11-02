"use client";

import { NODES } from "../content";
import type { Look } from "../engine/look";
import { gfStore, NODE_ORDER, useGF, type NodeId } from "../store";
import { Slot } from "./Monitor";

/** How much a node is doing in the current look (0 = idle), for the strip's status line. */
export function nodeAmount(look: Look, id: NodeId): string {
  const f = look.finish;
  switch (id) {
    case "grade": {
      const g = look.grade;
      const parts = [g.stock !== "none" ? "stock" : "", Math.abs(g.temperature) > 0.01 ? "WB" : "", Math.abs(g.contrast - 1) > 0.01 ? "contrast" : "", g.split.shadowAmt + g.split.highlightAmt > 0 ? "split" : "", Math.abs(g.saturation - 1) > 0.01 ? "sat" : "", Math.abs(g.exposure) > 0.01 ? "exp" : "", [g.lift, g.gamma, g.gain].some((w) => w.x || w.y || w.m) ? "wheels" : ""].filter(Boolean);
      return parts.length ? parts.slice(0, 3).join(" · ") : "neutral";
    }
    case "stylize":
      return look.stylize.mode === "none" ? "off" : look.stylize.mode;
    case "lens":
      return f.lens.distortion || f.lens.aberration || f.lens.streaks ? "on" : "—";
    case "halation":
      return f.halation.amount ? `${Math.round(f.halation.amount * 100)}%` : "—";
    case "bloom":
      return f.bloom.amount ? `${Math.round(f.bloom.amount * 100)}%` : "—";
    case "vignette":
      return f.vignette.amount ? `${Math.round(f.vignette.amount * 100)}%` : "—";
    case "sharpen":
      return f.sharpen ? `${Math.round(f.sharpen * 100)}%` : "—";
    case "grain":
      return f.grain.amount ? `${Math.round(f.grain.amount * 100)}%` : "—";
    case "weave":
      return f.weave ? `${Math.round(f.weave * 100)}%` : "—";
  }
}

export function PipelineStrip({ thumbs, selected, onSelect }: { thumbs: boolean; selected?: NodeId | "source" | null; onSelect?: (id: NodeId | "source") => void }) {
  const nodes = useGF((s) => s.nodes);
  const look = useGF((s) => s.look);
  const grade = NODE_ORDER.filter((n) => NODES[n].stage === "grade");
  const finish = NODE_ORDER.filter((n) => NODES[n].stage === "finish");
  const card = (id: NodeId) => {
    const on = nodes[id];
    const amt = nodeAmount(look, id);
    const idle = amt === "—" || amt === "off" || amt === "neutral";
    return (
      <div key={id} className="gf-node" data-on={on ? "1" : "0"} data-idle={idle ? "1" : "0"} data-selected={selected === id ? "1" : undefined}>
        {thumbs && <Slot id={`thumb:${id}`} className="gf-thumb" testId={`thumb-${id}`} onClick={() => onSelect?.(id)} />}
        <button type="button" className="gf-node-toggle" data-testid={`node-${id}`} aria-pressed={on} title={`${on ? "Bypass" : "Enable"} ${NODES[id].label}`} onClick={() => gfStore.getState().setNode(id, !on)}>
          <i aria-hidden />
          <span className="gf-node-name">{NODES[id].label}</span>
          <span className="gf-node-amt mono">{on ? amt : "bypassed"}</span>
        </button>
      </div>
    );
  };
  return (
    <section className="gf-strip" data-testid="pipeline-strip" data-thumbs={thumbs ? "1" : "0"} aria-label="Pipeline: grade, finish, deliver">
      <div className="gf-stage">
        <span className="gf-stage-label">Generate</span>
        <div className="gf-stage-nodes">
          <div className="gf-node gf-node-fixed" data-selected={selected === "source" ? "1" : undefined}>
            {thumbs && <Slot id="thumb:source" className="gf-thumb" testId="thumb-source" onClick={() => onSelect?.("source")} />}
            <div className="gf-node-toggle" aria-disabled>
              <span className="gf-node-name">Source</span>
              <span className="gf-node-amt mono">render</span>
            </div>
          </div>
        </div>
      </div>
      <span className="gf-arrow" aria-hidden>→</span>
      <div className="gf-stage">
        <span className="gf-stage-label">Grade <em>LUT-able</em></span>
        <div className="gf-stage-nodes">{grade.map(card)}</div>
      </div>
      <span className="gf-arrow" aria-hidden>→</span>
      <div className="gf-stage gf-stage-wide">
        <span className="gf-stage-label">Finish <em>not in a LUT</em></span>
        <div className="gf-stage-nodes">{finish.map(card)}</div>
      </div>
      <span className="gf-arrow" aria-hidden>→</span>
      <div className="gf-stage">
        <span className="gf-stage-label">Deliver</span>
        <div className="gf-stage-nodes">
          <div className="gf-node gf-node-fixed gf-node-deliver">
            <div className="gf-node-toggle" aria-disabled>
              <span className="gf-node-name">Rec.709</span>
              <span className="gf-node-amt mono">8-bit out</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
