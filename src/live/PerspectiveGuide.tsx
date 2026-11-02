"use client";

import { useMeasurementText } from "@/renderer/runtime/measurementStore";
import { useLab } from "@/ui/store/labStore";
import { sceneDescriptor as scene } from "@/labs/lens-and-framing/config";

const cap = (t: string) => t.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase());

/** Four live comparisons inside the monitor: what the camera position is doing to the picture. */
export function PerspectiveGuide() {
  const on = useLab((s) => s.viz.perspectiveGuide);
  const face = useMeasurementText((m) => m, (m) => (Number.isFinite(m.faceStretch) ? `${m.faceStretch.toFixed(2)}×` : "—"));
  const fg = useMeasurementText((m) => m, (m) => (m.fgBgMagnification ? `${m.fgBgMagnification.toFixed(1)}×` : "out of shot"));
  const ratio = useMeasurementText((m) => m, (m) => `${m.apparentHeightRatio.toFixed(2)}× Bram (true 0.63×)`);
  const door = useMeasurementText((m) => m, (m) => `${Math.round(m.doorwayWidthFraction * 100)}% of width`);
  if (!on) return null;
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 w-[248px] whitespace-nowrap rounded-lg bg-black/60 px-2.5 py-2 text-[10.5px] leading-[1.6]" data-testid="perspective-guide">
      <div className="micro mb-0.5 text-[8.5px]">Perspective · set by camera position</div>
      <Row label="Nose vs ears" refEl={face} />
      <Row label={`${cap(scene.labels.foreground)} vs ${scene.labels.midground.replace(/^the /, "")}`} refEl={fg} />
      <Row label="Pip appears" refEl={ratio} />
      <Row label={`${cap(scene.labels.midground)} spans`} refEl={door} />
    </div>
  );
}

function Row({ label, refEl }: { label: string; refEl: React.RefObject<HTMLElement | null> }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      <span ref={refEl as React.RefObject<HTMLSpanElement>} className="mono text-ink-0" />
    </div>
  );
}
