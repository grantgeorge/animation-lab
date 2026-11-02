"use client";

import { useState } from "react";
import { getAsset } from "./content/assets";
import { NOTE_TEXT } from "./content/scene";
import { MediaPlayer } from "./MediaPlayer";
import type { Chapter, ChapterId } from "./types";

/** Real before/after media for the director's note, where a real edit exists. */
export const NOTE_MEDIA: Partial<Record<ChapterId, { before: string; after: string; label: string }>> = {
  multiplane: { before: "still-multiplane", after: "note-multiplane-blue-scarf", label: "Repainted cel (GPT Image 2.5 Sunburst edit)" },
  television: { before: "still-television", after: "note-television-blue-scarf", label: "Updated drawing (GPT Image 2.5 Sunburst edit)" },
  generative: { before: "exp-revision-source", after: "exp-revision", label: "Keyframe edit + H3 Max regeneration" },
};

export function ExampleStage({ chapter, note }: { chapter: Chapter; note: boolean; reducedMotion: boolean }) {
  const hero = getAsset(chapter.heroAssetId);
  const noteMedia = note ? NOTE_MEDIA[chapter.id] : undefined;
  if (noteMedia && getAsset(noteMedia.before) && getAsset(noteMedia.after)) return <NoteCompare chapter={chapter} {...noteMedia} />;
  if (!hero) {
    return (
      <div className="grid aspect-video place-items-center bg-[#0b0f16] p-6 text-center" data-testid="asset-pending">
        <div>
          <p className="micro">Example pending</p>
          <p className="mt-2 max-w-md text-[13px] text-ink-1">The approved example for {chapter.title} hasn&apos;t been published yet. The explanation and demonstration still work.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <MediaPlayer asset={hero} label={`${chapter.title} example`} />
      {note && !noteMedia ? (
        <p className="border-t border-white/[0.06] bg-[#0b0f16] px-4 py-2 text-[12px] text-ink-1">
          Director&apos;s note: “{NOTE_TEXT}” Open <strong className="text-ink-0">See how it works</strong> to apply it to this method.
        </p>
      ) : null}
    </>
  );
}

function NoteCompare({ chapter, before, after, label }: { chapter: Chapter; before: string; after: string; label: string }) {
  const [side, setSide] = useState<"before" | "after">("after");
  const a = getAsset(side === "before" ? before : after)!;
  return (
    <div data-testid="note-compare">
      <MediaPlayer key={a.id} asset={a} label={`${chapter.title}, ${side} the note`} />
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] bg-[#0b0f16] px-4 py-2">
        <div role="radiogroup" aria-label="Before or after the director's note" className="flex gap-1">
          {(["before", "after"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={side === s} onClick={() => setSide(s)} className={`ctl-chip capitalize ${side === s ? "ctl-chip-on" : ""}`}>
              {s}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-ink-2">{side === "after" ? `${label}. Real output, shown as returned.` : "The approved original."}</span>
      </div>
    </div>
  );
}
