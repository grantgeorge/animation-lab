"use client";

import { NODES } from "../content";
import type { NodeId } from "../store";
import { Scopes } from "./Scopes";

export function InspectPanel({ node }: { node: NodeId | "source" }) {
  const info = node === "source" ? null : NODES[node];
  return (
    <div className="gf-inspect-panel" data-testid="inspect-panel">
      <div className="gf-panel-heading">
        <span className="gf-eyebrow">Scopes · graded frame, 160×90 readback</span>
        <h2>Read the picture, not the monitor</h2>
        <p>Drag the wipe on the picture; move any slider in Experiment and watch the traces move.</p>
      </div>
      <Scopes />
      <section className="gf-node-note" data-testid="node-note">
        <span className="gf-eyebrow">{node === "source" ? "Generate · Source" : info!.stage === "grade" ? `Grade stage · ${info!.label === "Grade" ? "colour" : info!.label}` : `Finish stage · ${info!.label}`}</span>
        {node === "source" ? (
          <p>The clean render (or the AI clip as delivered): display-referred Rec.709, 8 bits per channel in practice. Everything after this is post.</p>
        ) : (
          <>
            <p>{info!.what}</p>
            <p className="gf-why">{info!.why}</p>
            <p className="gf-lut" data-lut={info!.lut ? "1" : "0"}>{info!.lut ? "Fits in a LUT: per-pixel colour only." : "Not LUT-able: it looks at neighbouring pixels or at time."}</p>
          </>
        )}
      </section>
    </div>
  );
}
