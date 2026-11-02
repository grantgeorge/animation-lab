"use client";

import { CONSTRUCT_COPY, CUE_COPY, MOVE_COPY } from "../content";
import { CUE_IDS, STEP_ORDER, isCueOn, useED } from "../store";
import { live } from "../runtime/live";
import { LiveBar, LiveText, Slot } from "./Chrome";
import { LiveSvg } from "./LiveSvg";

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

/** Converging path edges extended to their vanishing point, plus the horizon. */
function drawGuides() {
  const { left, right, vp } = live.path;
  if (!left.length) return null;
  const P = (p: [number, number]) => `${(p[0] * 1600).toFixed(1)},${(p[1] * 900).toFixed(1)}`;
  const line = (pts: [number, number][]) => {
    const all = vp ? [...pts, vp] : pts;
    return `<polyline points="${all.map(P).join(" ")}" fill="none" stroke="#5fe3ff" stroke-width="2" stroke-dasharray="7 7" opacity="0.85"/>`;
  };
  let body = line(left) + line(right);
  if (vp) {
    const [x, y] = [vp[0] * 1600, vp[1] * 900];
    body += `<line x1="0" y1="${y.toFixed(1)}" x2="1600" y2="${y.toFixed(1)}" stroke="#ffb547" stroke-width="1.4" stroke-dasharray="3 9" opacity="0.7"/>`;
    body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="none" stroke="#5fe3ff" stroke-width="2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#5fe3ff"/>`;
    body += `<text x="${(x + 14).toFixed(1)}" y="${(y - 12).toFixed(1)}" fill="#9ff0ff" font-size="20" font-family="ui-monospace, monospace">vanishing point</text>`;
    body += `<text x="16" y="${(y - 8).toFixed(1)}" fill="#ffd08a" font-size="18" font-family="ui-monospace, monospace">horizon (eye level)</text>`;
  }
  return { viewBox: "0 0 1600 900", body };
}

export function RevealMeter({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ed-reveal ${compact ? "ed-reveal-compact" : ""}`} data-testid="reveal-meter">
      <div className="ed-reveal-head">
        <span className="ed-eyebrow">REVEALED SINCE FRAME 0</span>
        <LiveText className="ed-reveal-num mono" data-testid="reveal-value" get={() => pct(live.reveal.total)} />
      </div>
      <LiveBar get={() => [live.reveal.disoccluded, live.reveal.edge]} testId="reveal-bar" />
      <div className="ed-reveal-legend mono">
        <span className="ed-dot ed-dot-pink" />
        <LiveText get={() => `behind objects ${pct(live.reveal.disoccluded)}`} />
        <span className="ed-dot ed-dot-cyan" />
        <LiveText get={() => `at the edge ${pct(live.reveal.edge)}`} />
      </div>
    </div>
  );
}

export function MainPicture() {
  const construct = useED((s) => s.construct);
  const move = useED((s) => s.move);
  const guides = useED((s) => s.cues.guides);
  const overlay = useED((s) => s.overlay);
  const mode = useED((s) => s.mode);
  return (
    <div className="ed-main-frame">
      <Slot id="main" testId="monitor-main">
        {guides && <LiveSvg className="ed-overlay" draw={drawGuides} testId="perspective-guides" />}
        <div className="ed-chips">
          <span className="ed-chip ed-chip-cyan" data-testid="construct-chip">
            {CONSTRUCT_COPY[construct].label} · {CONSTRUCT_COPY[construct].short.toUpperCase()}
          </span>
          <span className="ed-chip">{MOVE_COPY[move].label.toUpperCase()}</span>
          {construct !== "3d" && (
            <LiveText
              className="ed-chip ed-chip-pink"
              data-testid="holes-chip"
              get={() => {
                const c = live.construction;
                if (!c) return "";
                const parts = [];
                if (c.hole > 0.001) parts.push(`never painted ${pct(c.hole)}`);
                if (c.void > 0.001) parts.push(`off the card ${pct(c.void)}`);
                return parts.join(" · ");
              }}
            />
          )}
          {overlay === "reveal" && <span className="ed-chip ed-chip-pink">TINT = REVEALED</span>}
          {overlay === "bands" && (
            <span className="ed-chip ed-chip-bands">
              <i className="b-fg" />FG <i className="b-mg" />MG <i className="b-bg" />BG
            </span>
          )}
        </div>
        {mode !== "inspect" && (
          <div className="ed-chips ed-chips-right">
            <RevealMeter compact />
          </div>
        )}
        <div className="ed-chips ed-chips-bottom">
          <LiveText className="ed-chip" data-testid="lens-chip" get={() => `${Math.round(live.cam.focalMm)} mm · Pip ${live.cam.distToPipM.toFixed(1)} m away`} />
        </div>
        <div className="ed-chips ed-chips-bottom ed-chips-right">
          <LiveText
            className="ed-chip ed-chip-amber"
            data-testid="tree-chip"
            get={() => (live.scale.k === 1 ? `tree ${live.scale.treeTrueM} m` : `tree ${live.scale.treeTrueM} m · reads as ${Math.round(live.scale.treeReadsM)} m`)}
          />
        </div>
      </Slot>
    </div>
  );
}

/** One line under the picture: what the last take-apart step added, or what the construction is doing. */
export function CaptionBar() {
  const step = useED((s) => s.step);
  const construct = useED((s) => s.construct);
  const move = useED((s) => s.move);
  const cues = useED((s) => s.cues);
  const on = CUE_IDS.filter((id) => isCueOn(cues, id));
  let tag: string;
  let text: string;
  if (step === null && on.length === 1) {
    tag = `ONLY ${CUE_COPY[on[0]].label.toUpperCase()} · 1 / 7`;
    text = `${CUE_COPY[on[0]].line} Every other cue is off.`;
  } else if (step === 0) {
    tag = "FLAT · 0 / 7";
    text = "Every depth cue off: no haze, no foreground, no reference, merged flat silhouettes, no focus, a long lens, no parallax. The forest reads as a flat backdrop.";
  } else if (step !== null) {
    const id = STEP_ORDER[step - 1];
    tag = `+ ${CUE_COPY[id].label.toUpperCase()} · ${step} / 7`;
    text = CUE_COPY[id].line;
  } else {
    tag = `${CONSTRUCT_COPY[construct].label} · ${MOVE_COPY[move].label.toUpperCase()}`;
    text = `${CONSTRUCT_COPY[construct].line} ${MOVE_COPY[move].line}`;
  }
  return (
    <div className="ed-caption-bar" data-testid="caption-bar">
      <b className="mono">{tag}</b>
      <span>{text}</span>
    </div>
  );
}
