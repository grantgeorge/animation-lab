"use client";

import { useState } from "react";
import { getLook } from "../engine/look";
import { AI_FINISHING_NOTE, lookPhrase } from "../engine/prompt";
import { getShot } from "../engine/shots";
import { chainCube, shotLayers, showLookDoc } from "../engine/showlook";
import { gfStore, useGF } from "../store";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The current grade as a .cube: the look alone in the one-shot view; balance + look + override for the selected shot in the show view. */
export function currentCube(): { name: string; text: string } {
  const s = gfStore.getState();
  const name = s.lookId ? getLook(s.lookId).label : "Custom look";
  if (s.view === "show") {
    const layers = shotLayers(s.shot, s.step === "raw" ? "override" : s.step, s.look, s.shots[s.shot], { includeDrift: false });
    return { name: `${slug(name)}-${s.shot}.cube`, text: chainCube(layers, `${name} · ${getShot(s.shot).label}`) };
  }
  return { name: `${slug(name)}.cube`, text: chainCube([s.look.grade], name) };
}

export function currentShowDoc() {
  const s = gfStore.getState();
  return showLookDoc(s.lookId ? getLook(s.lookId).label : "Custom show look", s.look, s.lookId, s.shots);
}

export function DeliverPanel() {
  const look = useGF((s) => s.look);
  const view = useGF((s) => s.view);
  const [copied, setCopied] = useState(false);
  const phrase = lookPhrase(look);
  return (
    <details className="gf-deliver" data-testid="deliver">
      <summary>
        Deliver <span>LUT, show preset and a Seedance phrase</span>
      </summary>
      <div className="gf-deliver-body">
        <span className="gf-eyebrow">Prompt phrase · Seedance 2.5</span>
        <p className="gf-phrase mono" data-testid="look-phrase">{phrase}</p>
        <button
          type="button"
          className="gf-mini"
          data-testid="copy-phrase"
          onClick={() => {
            void navigator.clipboard?.writeText(phrase).then(() => setCopied(true));
            setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? "Copied" : "Copy phrase"}
        </button>
        <div className="gf-downloads">
          <button type="button" className="gf-primary" data-testid="download-cube" onClick={() => { const c = currentCube(); download(c.name, c.text, "text/plain"); }}>
            Download .cube LUT (33³)
          </button>
          <button type="button" className="gf-secondary" data-testid="download-json" onClick={() => { const d = currentShowDoc(); download(`${slug(d.name)}.show-look.json`, JSON.stringify(d, null, 2), "application/json"); }}>
            Show look JSON
          </button>
        </div>
        <p className="gf-note">
          The .cube holds the grade only ({view === "show" ? "this shot’s balance, the show grade and its override" : "the look’s grade"}): Rec.709 in, Rec.709 out, for the clip as delivered. Grain, halation, bloom, lens, vignette and stylization look at neighbouring pixels or at time, so no LUT can carry them: rebuild those with your finishing tools from the JSON.
        </p>
        <span className="gf-eyebrow">Prompt the look, or finish it in post?</span>
        <ul className="gf-ai-note">{AI_FINISHING_NOTE.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
    </details>
  );
}
