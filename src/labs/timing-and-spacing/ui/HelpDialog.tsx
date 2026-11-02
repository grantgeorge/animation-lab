"use client";

import { useEffect, useRef } from "react";
import { useTiming } from "../store";

const KEYS: [string, string][] = [
  ["Space", "Play / pause"],
  [",  .", "Previous / next frame"],
  ["Home", "Back to frame 0"],
  ["1 – 4", "Lessons: linear vs eased · heavy vs light · anticipation · squash & stretch"],
  ["C", "Compare on / off"],
  ["?  ·  Esc", "This help · close"],
];

export function HelpDialog() {
  const open = useTiming((s) => s.helpOpen);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => useTiming.getState().setHelpOpen(false);
  return (
    <dialog
      ref={ref}
      onClose={close}
      className="ts-help-dialog"
      aria-labelledby="timing-help-title"
      data-testid="help"
    >
      <button type="button" onClick={close} className="float-right text-2xl leading-none text-ink-2 hover:text-ink-0" aria-label="Close">
        ×
      </button>
      <h2 id="timing-help-title" className="text-[22px] font-medium tracking-tight">Timing &amp; Spacing</h2>
      <Section title="Timing vs spacing">
        <b>Timing</b> is how many frames an action takes. <b>Spacing</b> is how far the character moves from one frame to the next. Same timing, different spacing, completely different feel. The dots in the trajectory are the spacing: close dots are slow, far-apart dots are fast.
      </Section>
      <Section title="The three views">
        The stage plays the character. The trajectory shows its path with one dot per frame (24 per second). The timing curve is the height over time: drag the round tangent handles to reshape every arc, the diamond apex key to change height and airtime, or the background to scrub.
      </Section>
      <Section title="The physics underneath">
        A real bounce is a parabola: height ∝ (time from apex)², so it eases into and out of the top and hits the floor at full speed. Each rebound keeps a fraction of its speed (restitution e): heights shrink by e², airtimes by e. All objects fall at the same rate; weight shows in how much bounce survives, how much the body gives, and how animators cheat the hang time.
      </Section>
      <Section title="Motion prompt">
        The phrase under the controls describes the current motion in words a video model understands. It is built only from the settings, so the same settings always give the same words.
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
      <p className="mono mt-6 text-[10.5px] leading-relaxed text-ink-2">
        Assumptions: 24 fps · character 0.5 m tall · no air drag in the curves (light presets cheat airtime instead) · horizontal speed constant in flight, reduced by friction at each contact.
      </p>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className="micro mb-1.5 mt-5">{title}</h3>
      <p className="text-[13.5px] leading-[1.6] text-ink-1">{children}</p>
    </>
  );
}
