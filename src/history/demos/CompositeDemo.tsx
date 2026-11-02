"use client";

import { useState } from "react";
import { tokens } from "@/lib/tokens";
import { SCENE } from "../content/scene";
import { scarfAnglesAt } from "../rig2d/scarf";
import { Scene2D, SceneDefs, type Layers } from "../rig2d/Scene2D";
import { DemoControls, StageSvg, Toggle, Transport, type DemoProps } from "./controls";
import { useDemoClock } from "./useDemoClock";

const ID = "cmp";
const SWATCHES = [
  { label: "Original cream", color: tokens.bramScarf },
  { label: "Blue", color: SCENE.target.to },
  { label: "Green", color: "#3E9A5A" },
  { label: "Plum", color: "#7A3B6E" },
];

export default function CompositeDemo({ reducedMotion, note }: DemoProps) {
  const clock = useDemoClock({ autoplay: !reducedMotion, startFrame: 80 });
  const [layers, setLayers] = useState<Layers>({ line: true, color: true, shadow: true, background: true });
  const [picked, setPicked] = useState<string | null>(null);
  const scarf = picked ?? (note ? SCENE.target.to : tokens.bramScarf);
  const set = (k: keyof Layers) => (v: boolean) => setLayers((l) => ({ ...l, [k]: v }));
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden" style={{ background: "repeating-conic-gradient(#1b2130 0 25%, #151a26 0 50%) 0 0/32px 32px" }}>
        <StageSvg label="Digital ink-and-paint composite with separate layers" testId="composite-svg">
          <SceneDefs id={ID} />
          <Scene2D id={ID} t={clock.t} look="digital" layers={layers} scarfColor={scarf} scarfAngles={scarfAnglesAt(0, false)} />
        </StageSvg>
      </div>
      <DemoControls>
        <Transport {...clock} />
        <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Layers">
          <span className="micro mr-1">Layers</span>
          <Toggle on={layers.line} onChange={set("line")} testId="layer-line">Linework</Toggle>
          <Toggle on={layers.color} onChange={set("color")} testId="layer-color">Color</Toggle>
          <Toggle on={layers.shadow} onChange={set("shadow")} testId="layer-shadow">Shadow</Toggle>
          <Toggle on={layers.background} onChange={set("background")} testId="layer-bg">Background</Toggle>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`${SCENE.lead.name}'s scarf fill`}>
          <span className="micro mr-1">Scarf fill</span>
          {SWATCHES.map((s) => (
            <button
              key={s.label}
              type="button"
              role="radio"
              aria-checked={scarf === s.color}
              aria-label={s.label}
              title={s.label}
              onClick={() => setPicked(s.color)}
              className={`h-7 w-7 rounded-full border-2 ${scarf === s.color ? "border-white" : "border-white/20"}`}
              style={{ background: s.color }}
              data-testid={`swatch-${s.label.split(" ")[0].toLowerCase()}`}
            />
          ))}
          <span className="text-[11.5px] text-ink-2">Only the scarf&apos;s fill changes. The linework, the animation and the other layers are untouched.</span>
        </div>
      </DemoControls>
    </div>
  );
}
