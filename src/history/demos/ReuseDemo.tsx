"use client";

import { useState } from "react";
import { SCENE } from "../content/scene";
import { FPS, movingParts } from "../rig2d/pose";
import { scarfAnglesAt } from "../rig2d/scarf";
import { Scene2D, SceneDefs } from "../rig2d/Scene2D";
import { DemoControls, Legend, StageSvg, Toggle, Transport, type DemoProps } from "./controls";
import { useDemoClock } from "./useDemoClock";

const ID = "tv";
const NAMES: Record<string, string> = {
  root: "whole body", head: "head", eyes: "eyes", brow: "brow", torso: "torso", pelvis: "hips", cap: "cap", hat: "hat",
  upperArmL: "left arm", upperArmR: "right arm", forearmL: "left forearm", forearmR: "right forearm",
  thighL: "left leg", thighR: "right leg", footR: "right foot", footL: "left foot", leaf: "door",
};
/** One period of Pip's authored wave (forearm −35° → +35° → −35°, 0.56 s), as 14 reusable frames. */
const CYCLE = { start: 3.14, period: 0.56, frames: 14 };
const BRAM_HOLD = 4.0;

export default function ReuseDemo({ reducedMotion, note }: DemoProps) {
  const clock = useDemoClock({ autoplay: !reducedMotion, startFrame: 80 });
  const [showMoving, setShowMoving] = useState(true);
  const [cycle, setCycle] = useState(false);
  const cycleIdx = clock.frame % CYCLE.frames;
  const repeats = Math.floor(clock.frame / CYCLE.frames) + 1;
  const tPip = cycle ? CYCLE.start + (cycleIdx * CYCLE.period) / CYCLE.frames : undefined;
  const tBram = cycle ? BRAM_HOLD : undefined;
  const t = clock.t;
  const hl = showMoving
    ? {
        bram: cycle ? new Set<string>() : movingParts("bram", t),
        pip: cycle ? new Set(["forearmL"]) : movingParts("pip", t),
        door: cycle ? new Set<string>() : movingParts("door", t),
      }
    : null;
  const list = (s: Set<string>) => [...s].map((p) => NAMES[p] ?? p).join(", ") || "nothing (held)";
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden">
        <StageSvg label={`Limited-animation version of the scene${showMoving ? ", moving parts highlighted" : ""}`} testId="reuse-svg">
          <SceneDefs id={ID} />
          <Scene2D id={ID} t={t} tBram={tBram} tPip={tPip} look="flat" scarfAngles={scarfAnglesAt(0, false)} highlight={hl} scarfColor={note ? SCENE.target.to : undefined} />
        </StageSvg>
        {cycle && (
          <div className="mono absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[11px] text-ink-0" data-testid="cycle-badge">
            Wave cycle · frame {cycleIdx + 1}/{CYCLE.frames} · repeat ×{repeats}
          </div>
        )}
      </div>
      <DemoControls>
        {!cycle && <Transport {...clock} marks={SCENE.beats.map((b) => ({ at: b.start * FPS, label: b.label }))} />}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Toggle on={showMoving} onChange={setShowMoving} testId="toggle-moving">
            Show moving parts
          </Toggle>
          <Toggle
            on={cycle}
            onChange={(v) => {
              setCycle(v);
              clock.seek(0);
              clock.setPlaying(true);
            }}
            testId="toggle-cycle"
          >
            Replay the wave cycle
          </Toggle>
          {cycle && (
            <button type="button" className="ctl-btn" onClick={() => clock.setPlaying(!clock.playing)}>
              {clock.playing ? "Pause" : "Play"}
            </button>
          )}
          {showMoving && <Legend items={[{ color: "#ffb547", label: "Moving this frame" }, { color: "rgb(255 255 255 / 0.3)", label: "Held" }]} />}
        </div>
        {showMoving && (
          <p className="text-[11.5px] text-ink-1" data-testid="moving-list" aria-live="off">
            <strong className="text-ink-0">{SCENE.lead.name}:</strong> {list(hl!.bram)}. <strong className="text-ink-0">{SCENE.companion.name}:</strong> {list(hl!.pip)}.
          </p>
        )}
        <p className="text-[11.5px] text-ink-2">
          {cycle
            ? `The same ${CYCLE.frames} frames repeat while ${SCENE.lead.name} and the background stay held. Draw once, reuse for as long as the shot needs.`
            : "Measured from the performance data each frame: most of the picture is held while a few parts carry the action. The timing, voices and writing do the rest."}
        </p>
      </DemoControls>
    </div>
  );
}
