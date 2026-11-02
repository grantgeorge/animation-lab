"use client";

import { useRef, useState } from "react";
import exp from "./experiment.json";
import takesData from "./takes.json";

type Obs = { criterion: string; label: "Matches" | "Partly matches" | "Changed"; at?: number; note: string };
type Take = { id: string; take: string; url: string; posterUrl: string; transcript: string; words: { text: string; start: number; end: number }[]; voiceMatch: { r: number; offsetS: number }; observations: Obs[]; date: string };
type Condition = { id: string; title: string; short: string; inputs: string[]; endpointId: string; parameters: Record<string, string | number>; addendum: string; takes: Take[] };
const E = exp as unknown as { line: string; direction: string; references: Record<string, string>; about: string; reviewStatus: string; summary: string[]; conditions: Condition[] };
const CAST = (takesData.takes as unknown as Record<string, { words: { text: string; start: number; end: number }[] }>).sarcastic.words;

const LABEL: Record<Obs["label"], string> = {
  Matches: "bg-[rgb(142_240_195/0.14)] text-subject",
  "Partly matches": "bg-[rgb(255_181_71/0.14)] text-distance",
  Changed: "bg-[rgb(255_107_107/0.14)] text-[#ff9a9a]",
};
const CRIT: Record<string, string> = { emotion: "Emotion reads", face: "Face", gesture: "Gesture on cue", voice: "Voice", lipsync: "Lip sync", unrequested: "Unrequested changes" };

export function AiTakes() {
  const [ci, setCi] = useState(0);
  const [take, setTake] = useState<"a" | "b">("b");
  const video = useRef<HTMLVideoElement>(null);
  if (!E.conditions?.length) return null;
  const c = E.conditions[ci];
  const t = c.takes.find((x) => x.take === take) ?? c.takes[0];
  return (
    <section className="mt-12" aria-labelledby="ai-takes" data-testid="ai-takes">
      <h2 id="ai-takes" className="text-[22px] font-bold tracking-tight">
        Directing a generated performance
      </h2>
      <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-ink-1">
        We asked a video model for the same sarcastic “{E.line}” four ways, adding one kind of direction at a time. Every take is real and shown as returned. Compare what each input actually controlled.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1.5 md:grid-cols-4" role="tablist" aria-label="Kind of direction">
        {E.conditions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={ci === i}
            onClick={() => setCi(i)}
            className={`rounded-[10px] border px-3 py-2 text-left ${ci === i ? "border-[var(--color-focal)] bg-[rgb(95_227_255/0.08)]" : "border-white/10 hover:bg-white/5"}`}
            data-testid={`ai-cond-${x.id}`}
          >
            <span className="mono block text-[10px] text-ink-2">{String.fromCharCode(65 + i)}</span>
            <span className="text-[12.5px] font-semibold">{x.title}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]" role="tabpanel">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-black">
            <video key={t.id} ref={video} src={t.url} poster={t.posterUrl} controls preload="metadata" playsInline className="aspect-video w-full" aria-label={`${c.title}, take ${t.take.toUpperCase()}`} data-testid="ai-video" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {(["a", "b"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={take === k} onClick={() => setTake(k)} className={`ctl-chip ${take === k ? "ctl-chip-on" : ""}`} data-testid={`ai-take-${k}`}>
                Take {k.toUpperCase()}
              </button>
            ))}
            <span className="mono ml-auto text-[10.5px] text-ink-3">
              {c.endpointId} · {Object.entries(c.parameters).map(([k, v]) => `${k}=${v}`).join(" ")}
            </span>
          </div>
          <Timing take={t} />
        </div>

        <div className="space-y-3">
          <div className="rounded-[10px] border border-white/[0.08] p-3">
            <p className="micro mb-1.5">Inputs supplied</p>
            <div className="flex flex-wrap gap-1.5">
              {c.inputs.map((i) => (
                <span key={i} className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-1">
                  {i}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.id === "expression" ? E.references.expressionFrame : E.references.neutralFrame} alt="Opening frame supplied to the model" className="w-1/2 rounded-md" />
              {c.id === "acting" && <video src={E.references.actingVideo} muted playsInline loop controls preload="none" className="w-1/2 rounded-md" aria-label="Authored 2D acting reference" />}
              {c.id === "voice" && <audio src={E.references.voice} controls preload="none" className="w-1/2" aria-label="Cast voice take" />}
            </div>
            {c.addendum && <p className="mono mt-2 text-[10.5px] leading-relaxed text-ink-2">+ “{c.addendum}”</p>}
          </div>
          <div className="rounded-[10px] border border-white/[0.08] p-3">
            <p className="micro mb-1.5">Review · take {t.take.toUpperCase()}</p>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-ink-1" data-testid="ai-review">
              {t.observations.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`mono h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] ${LABEL[o.label]}`}>{o.label}</span>
                  <span>
                    <span className="text-ink-0">{CRIT[o.criterion] ?? o.criterion}.</span> {o.note}
                    {o.at !== undefined && (
                      <button
                        type="button"
                        className="mono ml-1 text-[10.5px] text-focal-text hover:underline"
                        onClick={() => {
                          if (video.current) video.current.currentTime = o.at!;
                        }}
                      >
                        @{o.at.toFixed(1)}s
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.025] p-4">
        <p className="micro mb-2">What the inputs controlled</p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-1">
          {E.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <details className="drawer mt-3">
          <summary className="text-[12px] text-focal-text">The shared direction and how this was made</summary>
          <pre className="mono mt-2 whitespace-pre-wrap rounded-md bg-black/30 p-2.5 text-[10.5px] text-ink-1">{E.direction}</pre>
          <p className="mt-2 text-[11.5px] text-ink-2">{E.about}</p>
        </details>
        <p className="mt-2 text-[11px] text-ink-3">{E.reviewStatus}</p>
      </div>
    </section>
  );
}

/** Where each word landed in this take vs in the cast voice take. */
function Timing({ take }: { take: Take }) {
  const span = 5.5;
  const row = (words: { text: string; start: number; end: number }[], color: string) => (
    <div className="relative h-6 rounded bg-white/[0.04]">
      {words.map((w, i) => (
        <span
          key={i}
          className="mono absolute top-0.5 overflow-hidden whitespace-nowrap rounded px-1 text-[10px] leading-5 text-[#0b0e14]"
          style={{ left: `${(w.start / span) * 100}%`, width: `${Math.max(3, ((w.end - w.start) / span) * 100)}%`, background: color }}
          title={`${w.text} ${w.start.toFixed(2)}–${w.end.toFixed(2)} s`}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
  return (
    <div className="mt-3 space-y-1" aria-label="Word timing compared with the cast voice take">
      <p className="micro">Word timing</p>
      <div className="grid grid-cols-[88px_1fr] items-center gap-2">
        <span className="text-[11px] text-ink-2">Cast voice</span>
        {row(CAST, "#8ef0c3")}
        <span className="text-[11px] text-ink-2">This take</span>
        {row(take.words, "#ffb547")}
      </div>
      <p className="text-[11px] text-ink-2">
        Transcript: “{take.transcript}” · voice match with the cast take r = {take.voiceMatch.r.toFixed(2)}
        {take.voiceMatch.r > 0.95 ? " (it is the cast take)" : take.voiceMatch.r > 0.6 ? " (similar, re-synthesized)" : " (a different voice)"}
      </p>
    </div>
  );
}
