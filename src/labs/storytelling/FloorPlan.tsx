'use client';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { blockingConfig as config } from '@/labs/lens-and-framing/config';
import { cameraFloor, horizontalFov, yawToward } from './blockingMath';
import type { Mark } from './engine';

type Actor = 'Bram' | 'Pip';
const COLOR: Record<Actor, string> = { Bram: '#d08a70', Pip: '#e3c76d' };
// True-scale overhead plan: 56 px per metre, x −3.1…3.1 m, z −5.5…−1.05 m.
const S = 56, X0 = -3.1, Z0 = -5.5, W = 6.2 * S, H = 4.45 * S;
const px = (x: number) => (x - X0) * S;
const py = (z: number) => (z - Z0) * S;
const dir = (yaw: number) => [Math.sin(yaw * Math.PI / 180), Math.cos(yaw * Math.PI / 180)] as const;

/**
 * Overhead floor plan, drawn to scale: the doorway flat, the usable floor, the filming camera's real
 * horizontal field of view, each actor's mark and facing, and the line between them. Marks drag with a
 * pointer and move with the arrow keys (Shift for bigger steps).
 */
export function FloorPlan({ bram, pip, yaw, angle, focal, onMove }: { bram: Mark; pip: Mark; yaw: { bram: number; pip: number }; angle: number; focal: number; onMove: (actor: Actor, mark: Mark) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Actor | null>(null);
  const cam = cameraFloor(angle);
  const look = yawToward(cam, { x: config.target[0], z: config.target[2] });
  const half = horizontalFov(focal) / 2;
  const far = 16;
  const ray = (offset: number) => { const [dx, dz] = dir(look + offset); return `${px(cam.x + dx * far)} ${py(cam.z + dz * far)}`; };
  // Where the camera's sightline crosses the bottom edge of the plan: the camera glyph sits there.
  const [lx, lz] = dir(look);
  const edgeZ = Z0 + (H + 14) / S;
  const glyphX = Math.max(14, Math.min(W - 14, px(cam.x + lx * ((edgeZ - cam.z) / lz))));

  const toWorld = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = svg.current?.getScreenCTM(); if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: X0 + p.x / S, z: Z0 + p.y / S };
  };
  const move = (event: PointerEvent<SVGSVGElement>) => { if (!drag.current) return; const at = toWorld(event); if (at) onMove(drag.current, at); };
  const key = (actor: Actor, mark: Mark) => (event: KeyboardEvent) => {
    const step = event.shiftKey ? .5 : .1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    onMove(actor, { x: +(mark.x + delta[0]).toFixed(2), z: +(mark.z + delta[1]).toFixed(2) });
  };
  const b = config.bounds, f = config.flat;
  return <svg ref={svg} className="bk-plan" viewBox={`0 0 ${W} ${H + 30}`} role="group" aria-label="Overhead floor plan. Drag Bram or Pip, or focus a mark and use the arrow keys." onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    <defs>
      <clipPath id="bk-plan-floor"><rect width={W} height={H} /></clipPath>
      <pattern id="bk-plan-grid" width={S / 2} height={S / 2} patternUnits="userSpaceOnUse" x={px(0)} y={py(-5)}><path d={`M${S / 2} 0H0V${S / 2}`} fill="none" stroke="#ffffff0d" strokeWidth="1" /></pattern>
    </defs>
    <rect width={W} height={H} fill="url(#bk-plan-grid)" />
    <g clipPath="url(#bk-plan-floor)">
      <path className="bk-plan-fov" d={`M${px(cam.x)} ${py(cam.z)}L${ray(-half)}L${ray(half)}Z`} />
      <path className="bk-plan-fov-edge" d={`M${px(cam.x)} ${py(cam.z)}L${ray(-half)}M${px(cam.x)} ${py(cam.z)}L${ray(half)}`} />
    </g>
    <rect className="bk-plan-floor" x={px(b.x[0])} y={py(b.z[0])} width={(b.x[1] - b.x[0]) * S} height={(b.z[1] - b.z[0]) * S} rx="3" />
    <path className="bk-plan-flat" d={`M${px(f.x[0])} ${py(f.z)}H${px(f.door[0])}M${px(f.door[1])} ${py(f.z)}H${px(f.x[1])}`} />
    <path className="bk-plan-door" d={`M${px(f.door[0])} ${py(f.z)}H${px(f.door[1])}`} />
    <text className="bk-plan-label" x={px(f.x[0])} y={py(f.z) - 7}>DOORWAY</text>
    <text className="bk-plan-label" x={W - 8} y={py(f.z) - 7} textAnchor="end">UPSTAGE ↑</text>
    <text className="bk-plan-label" x={W - 8} y={H - 8} textAnchor="end">DOWNSTAGE ↓</text>
    <line className="bk-plan-line" x1={px(bram.x)} y1={py(bram.z)} x2={px(pip.x)} y2={py(pip.z)} />
    {([['Bram', bram, yaw.bram], ['Pip', pip, yaw.pip]] as const).map(([name, mark, y]) => {
      const [dx, dz] = dir(y), r = config.actorRadius * S;
      return <g key={name} className="bk-plan-mark" transform={`translate(${px(mark.x)} ${py(mark.z)})`} tabIndex={0} role="button" aria-roledescription="floor mark" aria-label={`${name}: ${mark.x.toFixed(1)} m across, ${(-mark.z).toFixed(1)} m deep. Arrow keys move; up is upstage.`} data-testid={`mark-${name.toLowerCase()}`} onKeyDown={key(name, mark)}
        onPointerDown={e => { e.preventDefault(); (e.currentTarget as SVGGElement).focus(); drag.current = name; svg.current?.setPointerCapture(e.pointerId); }}>
        <line className="bk-plan-gaze" x1={dx * (r + 9)} y1={dz * (r + 9)} x2={dx * (r + 1.1 * S)} y2={dz * (r + 1.1 * S)} stroke={COLOR[name]} />
        <circle className="bk-plan-ring" r={r} fill="#10161a" stroke={COLOR[name]} />
        <path d={`M${dx * (r + 7)} ${dz * (r + 7)}L${-dz * 5 + dx * r} ${dx * 5 + dz * r}L${dz * 5 + dx * r} ${-dx * 5 + dz * r}Z`} fill={COLOR[name]} />
        <text y="4" textAnchor="middle" fill={COLOR[name]}>{name[0]}</text>
      </g>;
    })}
    <g transform={`translate(${glyphX} ${H + 15}) rotate(${180 - look})`} className="bk-plan-cam"><rect x="-8" y="-3" width="16" height="10" rx="2" /><path d="M-3.5 -3L-7 -10H7L3.5 -3Z" /></g>
    <text className="bk-plan-label" x={glyphX + (glyphX > W - 110 ? -18 : 18)} y={H + 19} textAnchor={glyphX > W - 110 ? 'end' : 'start'}>CAMERA · {focal} MM · {Math.round(horizontalFov(focal))}° VIEW</text>
  </svg>;
}
