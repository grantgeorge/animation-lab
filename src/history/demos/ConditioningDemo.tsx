"use client";

import { useRef, useState } from "react";
import { getAsset } from "../content/assets";
import { EXPERIMENT } from "../content/experiment";
import { MediaPlayer, type PlayerHandle } from "../MediaPlayer";
import type { ExperimentTake, ReviewObservation } from "../types";
import type { DemoProps } from "./controls";

type Tab = "brief" | "references" | "takes" | "review" | "revision";
const CRITERIA: Record<ReviewObservation["criterion"], string> = {
  identity: "Identity & relative size",
  scarf: "Scarf & palette",
  beats: "Required beats",
  composition: "Composition & environment",
  unrequested: "Unrequested changes",
  performance: "Performance",
};
const LABEL_STYLE: Record<ReviewObservation["label"], string> = {
  Matches: "bg-[rgb(142_240_195/0.14)] text-subject",
  "Partly matches": "bg-[rgb(255_181_71/0.14)] text-distance",
  Changed: "bg-[rgb(255_107_107/0.14)] text-[#ff9a9a]",
};
const takeName = (t: ExperimentTake) => `${t.condition === "text" ? "A" : "B"}${t.index}`;

export default function ConditioningDemo({ note }: DemoProps) {
  const exp = EXPERIMENT;
  const [tab, setTab] = useState<Tab>(note ? "revision" : "takes");
  const [sel, setSel] = useState(exp.takes.find((t) => t.id === exp.heroTakeId)?.id ?? exp.takes[0]?.id);
  const take = exp.takes.find((t) => t.id === sel);
  const asset = getAsset(take?.assetId);
  const player = useRef<PlayerHandle>(null);
  const tabs: { id: Tab; label: string }[] = [
    { id: "brief", label: "Brief" },
    { id: "references", label: "References" },
    { id: "takes", label: `Takes (${exp.takes.length})` },
    { id: "review", label: "Review" },
    ...(exp.revision ? [{ id: "revision" as Tab, label: "Revision" }] : []),
  ];

  if (exp.takes.length === 0) {
    return <div className="grid aspect-video place-items-center bg-[#0b0f16] text-[13px] text-ink-2">The experiment results are being reviewed and will appear here.</div>;
  }

  return (
    <div data-testid="conditioning">
      {tab === "revision" && exp.revision ? (
        <RevisionView />
      ) : asset ? (
        <MediaPlayer key={asset.id} ref={player} asset={asset} label={`Take ${take ? takeName(take) : ""}`} />
      ) : (
        <div className="grid aspect-video place-items-center bg-black text-[12px] text-ink-2">{take?.failed ? `Take ${takeName(take)} failed: ${take.failed}` : "No clip"}</div>
      )}
      <div className="border-t border-white/[0.06] bg-[#0b0f16]">
        <div role="tablist" aria-label="Experiment" className="flex gap-1 overflow-x-auto px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-t-md px-3 py-1.5 text-[12px] font-medium ${tab === t.id ? "bg-white/[0.08] text-ink-0" : "text-ink-2 hover:text-ink-1"}`}
              data-testid={`exp-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="max-h-[340px] overflow-y-auto bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-ink-1">
          {tab === "brief" && (
            <div className="space-y-2">
              <p className="text-ink-0">Both conditions used this brief, in the {exp.look} look:</p>
              <pre className="mono whitespace-pre-wrap rounded-md bg-black/30 p-2.5 text-[11px] text-ink-1">{exp.brief}</pre>
              {exp.conditions.map((c) => (
                <div key={c.id} className="rounded-md bg-black/20 p-2.5">
                  <p className="font-medium text-ink-0">{c.id === "text" ? "A" : "B"} · {c.title}</p>
                  <p className="mono text-[10.5px] text-ink-2">
                    {c.endpointId} · {Object.entries(c.parameters).map(([k, v]) => `${k}=${v}`).join(" ")}
                  </p>
                  <p className="text-[11.5px]">Inputs: {c.inputs.join(", ")}</p>
                  {c.promptAddendum && <pre className="mono mt-1 whitespace-pre-wrap text-[10.5px] text-ink-2">+ {c.promptAddendum}</pre>}
                </div>
              ))}
              <p className="text-[11.5px] text-ink-2">{exp.about}</p>
            </div>
          )}
          {tab === "references" && (
            <div>
              <p className="mb-2">Condition B also received these. Condition A received only the text.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {exp.references.map((r) => {
                  const a = getAsset(r.assetId);
                  return (
                    <figure key={r.assetId} className="overflow-hidden rounded-md bg-black/30">
                      {a?.kind === "video" ? (
                        <video src={a.url} poster={a.posterUrl} muted playsInline loop controls className="aspect-video w-full object-cover" aria-label={r.label} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a?.url} alt={r.label} className="aspect-video w-full object-contain" />
                      )}
                      <figcaption className="px-2 py-1 text-[10.5px] text-ink-2">{r.label}</figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          )}
          {tab === "takes" && (
            <div className="space-y-3">
              {(["text", "references"] as const).map((cond) => (
                <div key={cond}>
                  <p className="micro mb-1.5">{cond === "text" ? "A · Description only" : "B · With references"}</p>
                  <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={cond === "text" ? "Description-only takes" : "Reference takes"}>
                    {exp.takes
                      .filter((t) => t.condition === cond)
                      .map((t) => {
                        const a = getAsset(t.assetId);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={sel === t.id}
                            onClick={() => setSel(t.id)}
                            className={`overflow-hidden rounded-md border-2 text-left ${sel === t.id ? "border-[var(--color-distance)]" : "border-transparent hover:border-white/20"}`}
                            data-testid={`take-${takeName(t)}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {a?.posterUrl ? <img src={a.posterUrl} alt="" className="aspect-video w-full object-cover" loading="lazy" /> : <div className="aspect-video bg-black/40" />}
                            <span className="mono block px-1.5 py-0.5 text-[10.5px] text-ink-1">Take {takeName(t)}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
              <p className="text-[11.5px] text-ink-2">Every returned take is shown, including the weaker ones. Four takes per condition illustrate behavior; they are not a success rate.</p>
            </div>
          )}
          {tab === "review" && take && (
            <div>
              <p className="mb-2 text-ink-0">
                Take {takeName(take)} · {take.condition === "text" ? "description only" : "with references"}
              </p>
              <ul className="space-y-1.5" data-testid="review-list">
                {take.observations.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mono h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] ${LABEL_STYLE[o.label]}`}>{o.label}</span>
                    <span>
                      <span className="text-ink-0">{CRITERIA[o.criterion]}.</span> {o.note}
                      {o.at !== undefined && (
                        <button type="button" className="mono ml-1 text-[10.5px] text-focal-text hover:underline" onClick={() => player.current?.seek(o.at!)}>
                          @{o.at.toFixed(1)}s
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-3">{exp.reviewStatus}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevisionView() {
  const rev = EXPERIMENT.revision!;
  const [side, setSide] = useState<"before" | "after">("after");
  const src = EXPERIMENT.takes.find((t) => t.id === rev.sourceTakeId);
  const a = getAsset(side === "after" ? rev.assetId : src?.assetId);
  return (
    <div data-testid="revision">
      {a && <MediaPlayer key={a.id} asset={a} label={side === "after" ? "Revised take" : "Source take"} />}
      <div className="space-y-2 px-4 py-3 text-[12px] text-ink-1">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Before or after the revision" className="flex gap-1">
            {(["before", "after"] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={side === s} onClick={() => setSide(s)} className={`ctl-chip capitalize ${side === s ? "ctl-chip-on" : ""}`}>
                {s}
              </button>
            ))}
          </div>
          <span className="mono text-[10.5px] text-ink-2">{rev.operation}</span>
        </div>
        <p>
          <span className="text-ink-0">Instruction:</span> {rev.instruction}
        </p>
        <ul className="space-y-1">
          {rev.observations.map((o, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mono h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] ${LABEL_STYLE[o.label]}`}>{o.label}</span>
              <span>
                <span className="text-ink-0">{CRITERIA[o.criterion]}.</span> {o.note} {o.at !== undefined && <span className="mono text-[10.5px] text-ink-2">@{o.at.toFixed(1)}s</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] text-ink-2">
          Compare chapters 2 and 4: there the same note changed one cel or one fill layer and nothing else could move. Here the model re-synthesized every frame, so the whole clip has to be checked, and the timing did shift.
        </p>
      </div>
    </div>
  );
}
