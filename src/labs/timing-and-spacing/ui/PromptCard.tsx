"use client";

import { useEffect, useState } from "react";
import { useTiming } from "../store";
import { variantColor } from "./colors";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The deterministic motion phrase for the current settings, ready to paste into a video-model prompt. */
export function PromptCard() {
  const variants = useTiming((s) => s.variants);
  const copied = useTiming((s) => s.copied);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = async (id: string, text: string) => {
    if (await copyText(text)) {
      setFlash(id);
      useTiming.getState().markCopied();
    }
  };
  return (
    <section className="ts-prompt" aria-label="Motion prompt" data-testid="prompt-card">
      <div>
        <span className="ts-eyebrow">MOTION NOTES</span>
      </div>
      <div className="ts-prompt-variants">
        {variants.map((v) => (
          <div key={v.id} className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[12px] leading-[1.45] text-ink-0" data-testid={`prompt-${v.id}`}>
              {v.id !== "main" && <span className="mono font-semibold" style={{ color: variantColor(v.id) }}>{v.id} · </span>}
              {v.prompt}
            </p>
            <button
              type="button"
              onClick={() => copy(v.id, v.prompt)}
              data-testid={`copy-${v.id}`}
              aria-label={`Copy motion prompt${v.id !== "main" ? ` ${v.id}` : ""}`}
              className="mono h-6 shrink-0 rounded-[7px] bg-white/[0.08] px-2 text-[10.5px] text-ink-1 hover:bg-white/15"
            >
              {flash === v.id ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
