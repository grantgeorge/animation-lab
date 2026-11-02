"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/ui/primitives";
import { SCENE } from "../content/scene";
import { FPS } from "../rig2d/pose";
import { bodyYaw, scarfAnglesAt, simulatedAngles } from "../rig2d/scarf";
import { Scene2D, SceneDefs } from "../rig2d/Scene2D";
import { DemoControls, StageSvg, Transport, type DemoProps } from "./controls";
import { useDemoClock } from "./useDemoClock";

const ID = "sim";

export default function SecondaryMotionDemo({ reducedMotion, note }: DemoProps) {
  const clock = useDemoClock({ autoplay: !reducedMotion, startFrame: 60 });
  const [mode, setMode] = useState<"body" | "sim">("sim");
  const angles = scarfAnglesAt(clock.t, mode === "sim");
  const trace = useMemo(() => {
    const tab = simulatedAngles();
    const n = tab.length;
    const last = tab[0].length - 1;
    const rest = tab[0][last];
    const W = 600;
    const H = 90;
    const y = (v: number) => H / 2 - v * 70;
    const path = (f: (i: number) => number) => tab.map((_, i) => `${i ? "L" : "M"}${((i / (n - 1)) * W).toFixed(1)},${y(f(i)).toFixed(1)}`).join(" ");
    return {
      W,
      H,
      body: path((i) => bodyYaw(i / FPS) * 0.3),
      scarf: path((i) => tab[i][last] - rest),
      rigid: path(() => 0),
    };
  }, []);
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden bg-[#151d33]">
        <StageSvg label={`Close-up of ${SCENE.lead.name}: ${mode === "sim" ? "scarf follow-through simulated" : "body animation only"}`} viewBox="610 360 700 394" testId="sim-svg">
          <SceneDefs id={ID} />
          <Scene2D id={ID} t={clock.t} look="digital" scarfAngles={angles} scarfColor={note ? SCENE.target.to : undefined} show="all" />
        </StageSvg>
        <svg viewBox={`0 0 ${trace.W} ${trace.H}`} className="absolute bottom-2 left-2 w-[46%] rounded-md bg-black/60" aria-hidden>
          <path d={trace.body} fill="none" stroke="#7c8796" strokeWidth={1.5} strokeDasharray="4 3" />
          <path d={mode === "sim" ? trace.scarf : trace.rigid} fill="none" stroke="#ffb547" strokeWidth={2} />
          <line x1={(clock.frame / (clock.total - 1)) * trace.W} x2={(clock.frame / (clock.total - 1)) * trace.W} y1={0} y2={trace.H} stroke="#fff" strokeWidth={1} />
          <text x={6} y={12} fontSize={10} fill="#7c8796">body turn (authored)</text>
          <text x={6} y={trace.H - 6} fontSize={10} fill="#ffb547">{mode === "sim" ? "scarf end swing (calculated)" : "scarf: no follow-through"}</text>
        </svg>
      </div>
      <DemoControls>
        <Transport {...clock} />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="w-64">
            <Segmented label="Secondary motion" value={mode} onChange={setMode} options={[{ value: "body", label: "Body only", testId: "mode-body" }, { value: "sim", label: "Scarf response", testId: "mode-sim" }]} />
          </div>
          <p className="flex-1 text-[11.5px] text-ink-2">
            Same authored body animation in both. The scarf end is a damped spring chain that only reads the body&apos;s motion: it lags the turn, overshoots and settles.
          </p>
        </div>
      </DemoControls>
    </div>
  );
}
