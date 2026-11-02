"use client";

import { useEffect, useRef } from "react";
import { labStore, useLab } from "@/ui/store/labStore";

const KEYS: [string, string][] = [
  ["1 – 6", "Lens presets 18 · 24 · 35 · 50 · 85 · 135 mm"],
  ["[  ]", "Focal length −1 / +1 mm (⇧ ±5)"],
  ["← →", "Dolly 0.1 m (Match: framing ±5 %)"],
  ["M", "Fixed camera / Match framing"],
  ["T", "Framing target: Bram → Pip → Both"],
  ["Space", "Play / pause"],
  ["Home · , .", "Restart · frame step"],
  ["V · ⇧F", "Swap main view · shot fullscreen"],
  ["F · G · O", "Frustum · grid · monitor guides"],
  ["R · ⇧V · ⇧R", "Reset stage view · next stage view · reset camera"],
  ["S · C · X", "Save shot · copy shot language · export settings"],
  ["⇧U · Esc", "Hide interface · close"],
];

export function HelpModal() {
  const open = useLab((s) => s.ui.helpOpen);
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
      aria-labelledby="lens-help-title"
      onClose={() => labStore.getState().setHelpOpen(false)}
      className="m-auto max-h-[84vh] w-[620px] max-w-[92vw] overflow-y-auto rounded-xl border border-white/15 bg-[#17191d] p-7 text-ink-0 backdrop:bg-[#05070fb0] backdrop:backdrop-blur-sm"
      data-testid="help"
    >
      <button type="button" onClick={() => labStore.getState().setHelpOpen(false)} className="float-right text-2xl leading-none text-ink-2 hover:text-ink-0" aria-label="Close">
        ×
      </button>
      <h2 id="lens-help-title" className="text-[22px] font-bold tracking-tight">Lens &amp; Framing</h2>
      <Section title="What you see">
        One animated take, one cinema camera. Camera view shows the 16:9 frame you film. Switch to Studio to see where the camera stands and how its lens and distance shape the shot.
      </Section>
      <Section title="Fixed vs Match">
        <b>Fixed</b>: the camera stays put and the lens changes the crop. <b>Match</b>: the camera dollies to keep the subject&apos;s standing mark framed at the same size. The background changes relative to the subject. Playback remains free to move away from that mark.
      </Section>
      <Section title="Why perspective changes">
        For two objects of equal size, the nearer one appears larger. Changing the lens from one position scales both equally. Moving the camera changes their relative distances, which changes perspective.
      </Section>
      <Section title="Shot language">
        The line under the monitor describes the shot the way a storyboard or an AI video prompt would: shot size first, then lens, angle, distance, perspective, movement. Press <b>C</b> to copy it.
      </Section>
      <h3 className="micro mt-5 mb-2">Keys</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="mono text-ink-0">{k}</dt>
            <dd className="text-ink-1">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mono mt-6 text-[10.5px] leading-relaxed text-ink-2">
        Assumptions: ideal pinhole camera · 36 × 20.25 mm gate (16:9) · no focus breathing · no depth of field · no lens distortion · distances measured from the camera&apos;s entrance pupil, in meters.
      </p>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className="micro mt-5 mb-1.5">{title}</h3>
      <p className="text-[13.5px] leading-[1.6] text-ink-1">{children}</p>
    </>
  );
}
