"use client";

import { useEffect, useRef, useState } from "react";
import { EDIT_COPY, KEYS, MODE_COPY, RULE_BREAK } from "../content";
import { scStore, useSC } from "../store";
import { useAnalysis } from "./derived";
import { live } from "../runtime/live";

/** What this mode teaches, plus the card for the loaded edit preset. */
export function ConceptCard() {
  const mode = useSC((s) => s.mode);
  const preset = useSC((s) => s.editPreset);
  const m = MODE_COPY[mode];
  const e = preset ? EDIT_COPY[preset] : null;
  return (
    <div className="glass mt-3 p-3" data-testid="concept-card">
      <h2 className="text-[15px] font-semibold text-ink-0">{m.title}</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-1">{m.body}</p>
      {mode === "inspect" && <p className="mt-1.5 text-[12px] leading-relaxed text-ink-1">{RULE_BREAK}</p>}
      {e && mode === "experiment" && (
        <div className="mt-2 rounded-lg bg-white/[0.04] p-2" data-testid="edit-concept">
          <h3 className={`text-[12.5px] font-semibold ${preset === "crossing" ? "text-[#FF8A8A]" : "text-subject"}`}>{e.title}</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-1">{e.body}</p>
        </div>
      )}
      <p className="mt-2 border-l-2 border-[#FFB547] pl-2 text-[11.5px] leading-snug text-ink-2">{m.tip}</p>
    </div>
  );
}

function CopyButton({ text, testId }: { text: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      className="mono rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-ink-1 hover:bg-white/15"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable: the text stays selectable */
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** The edit as a multi-shot AI video prompt (deterministic), with a copy button. */
export function PromptBox({ maxH = "max-h-[220px]" }: { maxH?: string }) {
  const { prompt } = useAnalysis();
  return (
    <div className="glass mt-3 p-2.5" data-testid="prompt-box">
      <div className="mb-1 flex items-center justify-between">
        <span className="micro text-[9px]">Multi-shot prompt · AI video</span>
        <CopyButton text={prompt} testId="copy-prompt" />
      </div>
      <pre className={`mono select-all overflow-y-auto whitespace-pre-wrap text-[10.5px] leading-snug text-ink-0 ${maxH}`} data-testid="prompt-text">
        {prompt}
      </pre>
    </div>
  );
}

/** Watch mode caption: the prompt line for the shot on screen, live. */
export function ShotCaption() {
  const { prompt } = useAnalysis();
  const lines = prompt.split("\n");
  const shots = lines.filter((l) => l.startsWith("Shot "));
  const [i, setI] = useState(0);
  useEffect(() => {
    // Polled at 10 Hz rather than re-rendering React every frame.
    const h = setInterval(() => setI(live.shotIndex), 100);
    return () => clearInterval(h);
  }, []);
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="shot-caption">
      <p className="mono min-w-0 flex-1 truncate text-[12px] text-ink-0" title={shots[i] ?? ""}>
        {shots[i] ?? ""}
      </p>
      <CopyButton text={prompt} testId="copy-prompt" />
    </div>
  );
}

export function Help() {
  const help = useSC((s) => s.help);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; if (help && !el?.open) el?.showModal(); else if (!help && el?.open) el.close(); }, [help]);
  return <dialog ref={dialog} onClose={() => scStore.getState().setHelp(false)} className="sc-guide" data-testid="help" aria-labelledby="sc-guide-title">
    <button type="button" className="sc-guide-close" onClick={() => scStore.getState().setHelp(false)} aria-label="Close field guide">×</button>
    <span className="sc-eyebrow">FIELD GUIDE</span><h2 id="sc-guide-title">Coverage &amp; editing</h2>
    <p>Three cameras watch one performance. Compose each angle, then choose when the audience sees it. The large program frame follows your edit.</p>
    <h3>Keep the geography clear</h3><p>Place cameras on the same side of the line between the characters. Then cross it deliberately and compare the direction of their eyelines.</p>
    <dl>{KEYS.map(([k, v]) => <div className="sc-key" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <p className="sc-guide-note">Watch plays the finished sequence. Inspect explains the camera positions. Experiment lets you compose and edit.</p>
  </dialog>;
}

export function Toast() {
  const toast = useSC((s) => s.toast);
  const [hiddenId, setHiddenId] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setHiddenId(toast.id), 1400);
    return () => clearTimeout(h);
  }, [toast]);
  const shown = toast && toast.id !== hiddenId ? toast : null;
  if (!shown) return null;
  return (
    <div role="status" className="glass mono pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 px-3 py-1.5 text-[12px] text-ink-0" data-testid="toast">
      {shown.text}
    </div>
  );
}
