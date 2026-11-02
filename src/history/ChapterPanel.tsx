"use client";

import Link from "next/link";
import { getLab } from "@/labs/registry";
import { getAsset, getProvenance } from "./content/assets";
import { NOTE_TEXT, SCENE } from "./content/scene";
import { SOURCES } from "./content/sources";
import type { Chapter, View } from "./types";

export function ChapterPanel({
  chapter,
  view,
  note,
  onView,
  onNote,
  onPrev,
  onNext,
}: {
  chapter: Chapter;
  view: View;
  note: boolean;
  onView: (v: View) => void;
  onNote: (on: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <aside aria-labelledby="chapter-title" className="glass flex flex-col gap-4 p-5" data-testid="chapter-panel">
      <div>
        <p className="mono text-[10.5px] tracking-wider text-ink-2">
          CHAPTER {chapter.number} OF 8 · {chapter.periodLabel.toUpperCase()}
        </p>
        <h2 id="chapter-title" className="mt-1 text-[24px] font-bold tracking-tight" data-testid="chapter-title" aria-live="polite">
          {chapter.title}
        </h2>
      </div>

      <dl className="space-y-3 text-[13.5px] leading-relaxed">
        <div>
          <dt className="micro mb-0.5">What changed</dt>
          <dd className="text-ink-0">{chapter.whatChanged}</dd>
        </div>
        <div>
          <dt className="micro mb-0.5">What you control</dt>
          <dd className="text-ink-1">{chapter.filmmakerControl}</dd>
        </div>
        <div className="rounded-[10px] border border-[rgb(95_227_255/0.2)] bg-[rgb(95_227_255/0.05)] p-3">
          <dt className="micro mb-0.5 !text-focal-text">Connection to AI</dt>
          <dd className="text-ink-0">{chapter.aiConnection}</dd>
        </div>
      </dl>

      <div className="rounded-[10px] bg-white/[0.04] p-3">
        <p className="text-[12.5px] text-ink-1">{chapter.controlHint}</p>
        {view === "watch" ? (
          <button type="button" className="ctl-btn ctl-btn-primary mt-2" onClick={() => onView("process")} data-testid="open-process">
            See how it works →
          </button>
        ) : (
          <button type="button" className="ctl-btn mt-2" onClick={() => onView("watch")}>
            ← Back to the example
          </button>
        )}
      </div>

      <div className={`rounded-[10px] border p-3 ${note ? "border-[rgb(47_111_208/0.6)] bg-[rgb(47_111_208/0.12)]" : "border-white/[0.08]"}`} data-testid="director-note">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="micro">Try a director&apos;s note</p>
            <p className="mt-1 text-[13px] font-medium text-ink-0">“{NOTE_TEXT}”</p>
          </div>
          <button type="button" className={`ctl-btn shrink-0 ${note ? "ctl-btn-primary" : ""}`} aria-pressed={note} onClick={() => onNote(!note)} data-testid="note-toggle">
            {note ? "Applied" : "Apply"}
          </button>
        </div>
        {note && (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-1" data-testid="note-explanation">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: SCENE.target.to }} aria-hidden />
            {chapter.directorNoteExplanation}
          </p>
        )}
      </div>

      <details className="drawer rounded-[10px] border border-white/[0.07] px-3 py-2">
        <summary className="flex items-center justify-between text-[12.5px] font-medium text-ink-1">
          Milestones and sources <span className="chev text-ink-3 transition-transform">›</span>
        </summary>
        <ul className="mt-2 space-y-2 text-[12.5px] leading-snug text-ink-1">
          {chapter.milestones.map((m) => (
            <li key={m.title}>
              <span className="mono mr-1.5 text-[11px] text-distance">{m.year ?? m.note ?? ""}</span>
              {m.title}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
          {chapter.sourceIds.map((id) => (
            <li key={id}>
              <a href={SOURCES[id].url} target="_blank" rel="noreferrer" className="text-[12px] text-focal-text underline-offset-2 hover:underline">
                {SOURCES[id].title}
              </a>
              <span className="text-[11px] text-ink-3"> · {SOURCES[id].publisher}</span>
            </li>
          ))}
        </ul>
      </details>

      <ExampleDetails chapter={chapter} />

      {chapter.relatedLabIds.map((id) => {
        const lab = getLab(id);
        return lab && lab.status === "available" ? (
          <Link key={id} href={`/labs/${id}`} className="text-[12.5px] font-medium text-focal-text hover:underline" data-testid="lab-link">
            Explore camera and framing in the {lab.title} lab →
          </Link>
        ) : null;
      })}

      <div className="mt-auto flex justify-between gap-2 pt-1">
        <button type="button" className="ctl-btn" onClick={onPrev} data-testid="prev-chapter">
          ← Previous
        </button>
        <button type="button" className="ctl-btn" onClick={onNext} data-testid="next-chapter">
          Next →
        </button>
      </div>
    </aside>
  );
}

function ExampleDetails({ chapter }: { chapter: Chapter }) {
  const asset = getAsset(chapter.heroAssetId);
  const prov = getProvenance(asset?.provenanceId);
  return (
    <details className="drawer rounded-[10px] border border-white/[0.07] px-3 py-2" data-testid="example-details">
      <summary className="flex items-center justify-between text-[12.5px] font-medium text-ink-1">
        About this example <span className="chev text-ink-3 transition-transform">›</span>
      </summary>
      <div className="mt-2 space-y-3 text-[12px] leading-relaxed text-ink-1">
        {chapter.id !== "generative" && (
          <p>
            The example is an <strong className="text-ink-0">AI recreation</strong> of a historical look, generated from a frame of the Lens &amp; Framing lab. It shows an
            appearance, not the original production method. The demonstration under <em>See how it works</em> explains the method.
          </p>
        )}
        {!prov && <p className="text-ink-2">Provenance will appear when the example is published.</p>}
        {prov?.steps.map((s) => (
          <div key={s.label} className="rounded-lg bg-black/25 p-2.5">
            <p className="font-medium text-ink-0">{s.label}</p>
            <p className="mono mt-0.5 text-[10.5px] text-ink-2">
              {s.model} · {s.endpointId} · {s.date}
            </p>
            <p className="mono mt-1 text-[10.5px] text-ink-2">{Object.entries(s.parameters).map(([k, v]) => `${k}=${v}`).join("  ")}</p>
            {s.inputs.length > 0 && <p className="mt-1 text-[11px] text-ink-2">Inputs: {s.inputs.join(", ")}</p>}
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-focal-text">Prompt</summary>
              <pre className="mono mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[10.5px] text-ink-1">{s.prompt}</pre>
            </details>
          </div>
        ))}
        {prov && prov.edits.length > 0 && <p className="text-[11px] text-ink-2">Edits after generation: {prov.edits.join("; ")}</p>}
        {prov?.note && <p className="text-[11px] text-ink-2">{prov.note}</p>}
      </div>
    </details>
  );
}
