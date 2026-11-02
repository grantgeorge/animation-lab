"use client";

import { useState } from "react";
import { Segmented } from "@/ui/primitives";
import { SCENE } from "../content/scene";
import { cadenceTime, FPS } from "../rig2d/pose";
import { scarfAnglesAt } from "../rig2d/scarf";
import { Scene2D, SceneDefs } from "../rig2d/Scene2D";
import { DemoControls, StageSvg, Transport, type DemoProps } from "./controls";
import { useDemoClock } from "./useDemoClock";

const ID = "cad";

/** Camera push-in evaluated on every frame of the 24 fps clock, independent of pose cadence. */
function cameraViewBox(t: number) {
  const u = t / 6;
  const zoom = 1 + 0.16 * (0.5 - 0.5 * Math.cos(Math.PI * u));
  const w = 1920 / zoom;
  const h = 1080 / zoom;
  const cx = 960 + 140 * u;
  const cy = 600;
  return `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
}

export default function CadenceDemo({ reducedMotion, note }: DemoProps) {
  const clock = useDemoClock({ autoplay: !reducedMotion, startFrame: 62 });
  const [mode, setMode] = useState<"ones" | "twos">("twos");
  const poseT = cadenceTime(clock.t, mode);
  const sec = Math.floor(clock.frame / FPS);
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden bg-[#121a2e]">
        <StageSvg label={`Comic-style version, poses ${mode === "twos" ? "held for two frames" : "changing every frame"}`} viewBox={cameraViewBox(clock.t)} testId="cadence-svg">
          <SceneDefs id={ID} />
          <Scene2D id={ID} t={poseT} look="comic" scarfAngles={scarfAnglesAt(poseT, true)} scarfColor={note ? SCENE.target.to : undefined} />
        </StageSvg>
        <div className="mono absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[11px] text-ink-0" data-testid="cadence-readout">
          clock f{String(clock.frame).padStart(3, "0")} · pose f{String(Math.round(poseT * FPS)).padStart(3, "0")} · camera f{String(clock.frame).padStart(3, "0")}
        </div>
      </div>
      <DemoControls>
        <Transport {...clock} />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="w-64">
            <Segmented label="Pose cadence" value={mode} onChange={setMode} options={[{ value: "ones", label: "Every frame", testId: "cadence-ones" }, { value: "twos", label: "Every two frames", testId: "cadence-twos" }]} />
          </div>
          <div className="flex gap-[3px]" aria-label={`Second ${sec + 1}: filled cells are frames where the pose changes`} role="img">
            {Array.from({ length: FPS }, (_, i) => {
              const f = sec * FPS + i;
              const newPose = mode === "ones" || f % 2 === 0;
              const isNow = f === clock.frame;
              return <span key={i} className={`h-4 w-2 rounded-[2px] ${newPose ? "bg-[var(--color-distance)]" : "border border-white/25"} ${isNow ? "outline outline-2 outline-white" : ""}`} />;
            })}
          </div>
        </div>
        <p className="text-[11.5px] text-ink-2">
          The clock and the camera push run at 24 fps either way. On twos, each character pose is held for two frames: snappier, more graphic motion without slowing the film.
        </p>
      </DemoControls>
    </div>
  );
}
