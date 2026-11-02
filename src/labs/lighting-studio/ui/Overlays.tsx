"use client";

import { useEffect, useRef } from "react";
import { studioStore, useStudio } from "../store";
import { CHANNEL_NAMES } from "./hooks";

export function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  return (
    <div className="ls-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-ink-0" data-testid="toast">
          {t.key && <kbd className="mono rounded bg-white/10 px-1.5 text-[10.5px] text-ink-1">{t.key}</kbd>}
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** One line under the top edge telling you what dragging does right now. */
export function FrameHint() {
  const view = useStudio((s) => s.view);
  const selected = useStudio((s) => s.selected);
  const solo = useStudio((s) => s.solo);
  const light = selected === "ambient" ? "key" : selected;
  return (
    <p className="ls-frame-hint" data-testid="frame-hint">
      {view === "shot" ? (
        <>
          Drag to move the <b className="text-ink-0">{CHANNEL_NAMES[light].toLowerCase()}</b> light
        </>
      ) : (
        <>Drag to orbit · scroll to zoom</>
      )}
      {solo && <span className="ml-2 text-distance">· solo {CHANNEL_NAMES[solo].toLowerCase()}</span>}
    </p>
  );
}

const KEYS: [string, string][] = [
  ["1 – 5", "Looks: flat · storybook · cinematic · noir · sunset"],
  ["0", "Back to the three-point starting rig"],
  ["K · F · R · A", "Select key · fill · rim · ambient"],
  ["← → ↑ ↓", "Swing the selected light around / up (⇧ ×3)"],
  ["S", "Solo the selected light"],
  ["T · [ ]", "Take the look apart · previous / next step"],
  ["V", "Swap shot and inspect view"],
  ["Space", "Play / pause Bram when the picture is focused"],
  ["C", "Copy the lighting prompt"],
  ["? · Esc", "Help · close"],
];

export function HelpDialog() {
  const open = useStudio((s) => s.helpOpen);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="lighting-help-title"
      onClose={() => studioStore.getState().setHelpOpen(false)}
      className="m-auto max-h-[84vh] w-[620px] max-w-[92vw] overflow-y-auto rounded-[20px] border border-white/15 bg-[#101526] p-7 text-ink-0 backdrop:bg-[#05070fb0] backdrop:backdrop-blur-sm"
      data-testid="help"
    >
      <button type="button" onClick={() => studioStore.getState().setHelpOpen(false)} className="float-right text-2xl leading-none text-ink-2 hover:text-ink-0" aria-label="Close">
        ×
      </button>
      <h2 id="lighting-help-title" className="text-[22px] font-bold tracking-tight">Lighting Studio</h2>
      <Section title="Three lights">
        The <b>key</b> is the main light and decides where the shadows fall. The <b>fill</b> controls how dark those shadows get. The <b>rim</b> comes from behind and draws a bright edge that separates the silhouette from the background.
      </Section>
      <Section title="Estimated ratio and stops">
        The ratio estimates (key + fill + bounce) ÷ (fill + bounce), using each source’s power and distance. 2:1 is one stop; 8:1 is three stops. Lower ratios usually open the shadows; higher ratios deepen them. This is a rig estimate, not a measurement of the image: direction, blinds and backlighting change the contrast you see.
      </Section>
      <Section title="Hard and soft">
        A source that appears larger from the subject makes softer shadow edges. In this studio, the Softness control approximates that effect with shadow blur and a softer beam edge. Compare the shadow edges as you adjust it; it is not a true area-light simulation.
      </Section>
      <Section title="The prompt line">
        The line under the looks describes what you see in words an AI video model understands. It updates as you move the lights. Press <b>C</b> to copy it.
      </Section>
      <h3 className="micro mb-2 mt-5">Keys</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="mono text-ink-0">{k}</dt>
            <dd className="text-ink-1">{v}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="micro mb-1">{title}</h3>
      <p className="text-[13.5px] leading-relaxed text-ink-1">{children}</p>
    </section>
  );
}
