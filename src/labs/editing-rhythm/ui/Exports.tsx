"use client";

import { useState } from "react";
import { cutList, edl, seedancePrompt, validateCutList, validateEdl } from "../engine/exports";
import { PRESET_INFO } from "../engine/presets";
import { EXP_INFO } from "./content";
import { activeEdit, isPristine, useER, type ERState } from "../store";
import { explanationFor } from "./explainExp";

export function editTitle(s: ERState) {
  if (s.exp === "timeline" || s.exp === "pacing") return `Editing Rhythm – ${PRESET_INFO[s.preset].label}${isPristine(s) ? "" : " (edited)"}`;
  return `Editing Rhythm – ${EXP_INFO[s.exp].tab}`;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Cut list JSON (TrueStudio), CMX3600 EDL, and a Seedance multi-shot prompt of the current edit. */
export function Exports() {
  const s = useER((x) => x);
  const [copied, setCopied] = useState(false);
  const e = activeEdit(s);
  const title = editTitle(s);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const prompt = seedancePrompt(e, s.exp === "timeline" || s.exp === "pacing" ? PRESET_INFO[s.preset].label.toLowerCase() : EXP_INFO[s.exp].tab.toLowerCase());
  return (
    <section className="er-exports" data-testid="exports">
      <div className="er-eyebrow">Hand off the edit</div>
      <div className="er-export-row">
        <button
          type="button"
          data-testid="export-json"
          onClick={() => {
            const c = cutList(e, title, explanationFor(s));
            if (validateCutList(c).length) return;
            download(`${slug}.cutlist.json`, JSON.stringify(c, null, 2), "application/json");
          }}
        >
          Cut list <span>.json</span>
        </button>
        <button
          type="button"
          data-testid="export-edl"
          onClick={() => {
            const text = edl(e, title);
            if (validateEdl(text).errors.length) return;
            download(`${slug}.edl`, text, "text/plain");
          }}
        >
          EDL <span>CMX3600</span>
        </button>
        <button
          type="button"
          data-testid="export-prompt"
          onClick={() => {
            void navigator.clipboard?.writeText(prompt).then(
              () => setCopied(true),
              () => setCopied(false),
            );
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? "Copied" : "Copy prompt"} <span>Seedance</span>
        </button>
      </div>
      <details className="er-prompt-box">
        <summary>Seedance multi-shot prompt</summary>
        <pre data-testid="prompt-text">{prompt}</pre>
      </details>
    </section>
  );
}
