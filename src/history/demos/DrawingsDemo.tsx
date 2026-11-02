"use client";

import { useState } from "react";
import { SCENE } from "../content/scene";
import { FPS } from "../rig2d/pose";
import { scarfAnglesAt } from "../rig2d/scarf";
import { Scene2D, SceneDefs } from "../rig2d/Scene2D";
import { DemoControls, StageSvg, Toggle, Transport, type DemoProps } from "./controls";
import { useDemoClock } from "./useDemoClock";

const ID = "drw";
const HOLD = 2; // drawings on twos

export default function DrawingsDemo({ reducedMotion, note }: DemoProps) {
  const clock = useDemoClock({ autoplay: false, startFrame: 66 });
  const [onion, setOnion] = useState(true);
  const [lift, setLift] = useState(false);
  const k = Math.floor(clock.frame / HOLD);
  const drawingT = (n: number) => ((n * HOLD) % clock.total) / FPS;
  const angles = (t: number) => scarfAnglesAt(t, false);
  const total = Math.ceil(clock.total / HOLD);
  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video w-full overflow-hidden bg-[#efe9dc]">
        <StageSvg label={`Pencil drawing ${k + 1} of ${total}${lift ? ", lifted off its background" : ""}`} testId="drawings-svg">
          <SceneDefs id={ID} />
          <defs>
            <pattern id="note-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="10" height="10" fill="rgb(47 111 208 / 0.18)" />
              <line x1="0" y1="0" x2="0" y2="10" stroke="#2F6FD0" strokeWidth="3" />
            </pattern>
          </defs>
          <rect width="1920" height="1080" fill="#f3eee3" />
          <g
            style={{ transition: reducedMotion ? undefined : "transform 400ms var(--ease-ui)" }}
            transform={lift ? "translate(-150 120) scale(0.86)" : undefined}
            opacity={lift ? 0.9 : 1}
          >
            {lift && <rect x={-10} y={-10} width={1940} height={1100} fill="#f6f1e6" stroke="#b8ae9a" strokeWidth={3} />}
            <Scene2D t={drawingT(k)} look="pencil" id={ID} show="background" scarfAngles={angles(0)} drawing={0} />
            {lift && (
              <text x={40} y={1060} fontSize={34} fill="#7a7266" fontFamily="var(--font-mono-face)">
                Background · drawn once, held for all {clock.total} frames
              </text>
            )}
          </g>
          <g transform={lift ? "translate(120 -60)" : undefined} style={{ transition: reducedMotion ? undefined : "transform 400ms var(--ease-ui)" }}>
            {lift && <rect x={560} y={260} width={900} height={860} fill="rgb(255 255 255 / 0.28)" stroke="#9fb6c9" strokeWidth={3} strokeDasharray="12 8" rx={6} />}
            {onion && k > 0 && <Scene2D t={drawingT(k - 1)} look="pencil" id={ID} show="characters" scarfAngles={angles(0)} tint="#d6493a" drawing={k - 1} />}
            {onion && k < total - 1 && <Scene2D t={drawingT(k + 1)} look="pencil" id={ID} show="characters" scarfAngles={angles(0)} tint="#2d8a62" drawing={k + 1} />}
            <g className={note ? "note-scarf" : undefined}>
              <Scene2D t={drawingT(k)} look="pencil" id={ID} show="characters" scarfAngles={angles(0)} drawing={k} />
            </g>
            {lift && (
              <text x={580} y={300} fontSize={34} fill="#5e7d96" fontFamily="var(--font-mono-face)">
                Drawing #{k + 1} of {total}
              </text>
            )}
          </g>
          {[560, 960, 1360].map((x) => (
            <circle key={x} cx={x} cy={1050} r={14} fill="#d9d2c3" stroke="#b8ae9a" />
          ))}
          {note && (
            <g>
              <rect x={40} y={36} width={860} height={92} rx={10} fill="#ffffff" stroke="#2F6FD0" strokeWidth={3} />
              <text x={64} y={78} fontSize={30} fill="#1d3f78" fontFamily="var(--font-ui)" fontWeight={600}>
                Paint note: {SCENE.lead.name}&apos;s {SCENE.target.label} → {SCENE.target.toLabel}
              </text>
              <text x={64} y={112} fontSize={24} fill="#4b5f80" fontFamily="var(--font-ui)">
                Pencil drawings unchanged. The ink-and-paint pass colors the marked region.
              </text>
            </g>
          )}
        </StageSvg>
      </div>
      <DemoControls>
        <Transport {...clock} label="Drawing" stepSize={HOLD} marks={SCENE.beats.map((b) => ({ at: b.start * FPS, label: b.label }))} />
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Toggle on={onion} onChange={setOnion} testId="toggle-onion">
            Onion skins
          </Toggle>
          <Toggle on={lift} onChange={setLift} testId="toggle-lift">
            Lift drawing off background
          </Toggle>
          <span className="text-[11px] text-ink-2">
            <span className="text-[#e46a5c]">Red</span> = previous drawing, <span className="text-[#4cc08f]">green</span> = next. Each drawing is held for 2 frames ({FPS / HOLD} drawings a second).
          </span>
        </div>
      </DemoControls>
    </div>
  );
}
