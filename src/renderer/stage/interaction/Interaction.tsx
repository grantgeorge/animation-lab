"use client";

import { useRef, useState } from "react";
import { Vector3, type Camera, type Group, type Object3D } from "three";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { distanceToPrimaryAlongRail } from "@/engine/rig";
import { formatMeters } from "@/engine/export/prompt";
import { labStore, useLab } from "@/ui/store/labStore";
import { presentation } from "@/renderer/runtime/presentation";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { useMeasurementText } from "@/renderer/runtime/measurementStore";
import { viewports } from "@/renderer/runtime/viewports";
import { TechLayer } from "@/scene/TechLayer";
import { htmlLayer } from "@/renderer/runtime/htmlLayer";
import { closestParamOnLine } from "./rail";

const RAIL_O = new Vector3(d.rail.x, d.rail.y, 0);
const RAIL_D = new Vector3(0, 0, -1); // +s moves toward the set (camera z = −railS)
const labelPoint = new Vector3();

/** Html portals use canvas coordinates; the observer is rendered into the smaller studio slot. */
function stageLabelPosition(object: Object3D, camera: Camera): [number, number] {
  const rect = viewports.get("stage")?.css;
  if (!rect) return [-10000, -10000];
  labelPoint.setFromMatrixPosition(object.matrixWorld).project(camera);
  return [rect.left + (labelPoint.x + 1) * rect.width / 2, rect.top + (1 - labelPoint.y) * rect.height / 2];
}

const setCursor = (c: string) => {
  const el = viewports.get("stage")?.el;
  if (el) el.style.cursor = c;
};

function Pill({ children, tone = "focal", testId }: { children: React.ReactNode; tone?: "focal" | "distance" | "subject" | "plain"; testId?: string }) {
  const color = tone === "focal" ? "var(--color-focal)" : tone === "distance" ? "var(--color-distance)" : tone === "subject" ? "var(--color-subject)" : "var(--color-ink-2)";
  return (
    <div
      data-testid={testId}
      className="mono pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-[rgb(11_16_32/0.82)] px-2 py-0.5 text-[10.5px] text-ink-0 shadow-[0_4px_14px_#0007]"
      style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </div>
  );
}

/** A grab handle around the camera and dolly: drag along the rail to dolly, click to select. */
export function CameraHandle() {
  const group = useRef<Group>(null);
  const grab = useRef<number | null>(null);
  const moved = useRef(0);
  const [hover, setHover] = useState(false);
  const selected = useLab((s) => s.interaction.selected === "camera");
  const dragging = useLab((s) => s.interaction.dragging === "dolly");
  const pillsVisible = useLab((s) => s.viz.labels && s.ui.primaryView === "stage" && !s.ui.fullscreenShot && !s.ui.uiHidden);
  const camText = useMeasurementText((m) => m, (m) => `${Math.round(m.focalMm)} mm · ${m.hfovDeg.toFixed(1)}°`);

  useFrameUpdater(() => {
    const p = presentation.pose.position;
    group.current?.position.set(p.x, 0, p.z);
  }, ORDER.TECH);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = closestParamOnLine(RAIL_O, RAIL_D, e.ray);
    if (s === null) return;
    grab.current = s - labStore.getState().camera.rig.railS;
    moved.current = 0;
    labStore.getState().setInteraction({ dragging: "dolly" });
    setCursor("grabbing");
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (grab.current === null) return;
    const s = closestParamOnLine(RAIL_O, RAIL_D, e.ray);
    if (s === null) return;
    const next = s - grab.current;
    moved.current += Math.abs(next - labStore.getState().camera.rig.railS);
    labStore.getState().setRailS(next, "drag");
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (grab.current === null) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    grab.current = null;
    const st = labStore.getState();
    st.setInteraction({ dragging: null, selected: moved.current < 0.01 ? (st.interaction.selected === "camera" ? null : "camera") : "camera" });
    setCursor(hover ? "grab" : "");
  };

  return (
    <group ref={group}>
      <TechLayer>
        <mesh
          position={[0, d.rail.y / 2 + 0.1, 0.12]}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            setCursor(grab.current === null ? "grab" : "grabbing");
          }}
          onPointerOut={() => {
            setHover(false);
            if (grab.current === null) setCursor("");
          }}
          data-testid="camera-handle"
        >
          <boxGeometry args={[0.8, d.rail.y + 0.35, 1.0]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {(selected || hover || dragging) && (
          <mesh position={[0, 0.012, 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.6, 48]} />
            <meshBasicMaterial color="#FFB547" transparent opacity={dragging ? 0.95 : selected ? 0.8 : 0.45} />
          </mesh>
        )}
      </TechLayer>
      <Html position={[0, d.rail.y + 0.42, 0.2]} center zIndexRange={[4, 0]} portal={htmlLayer as React.RefObject<HTMLElement>} calculatePosition={stageLabelPosition}>
          <div className="flex flex-col items-center gap-1" style={{ visibility: pillsVisible ? "visible" : "hidden" }}>
            <Pill testId="pill-camera">
              <span ref={camText as React.RefObject<HTMLSpanElement>} />
            </Pill>
            <div style={{ visibility: pillsVisible && (hover || selected) && !dragging ? "visible" : "hidden" }}>
              <Pill tone="plain">Drag along the rail to dolly</Pill>
            </div>
          </div>
        </Html>
    </group>
  );
}

/** Invisible click volumes on the characters: click to make them the framing target. */
export function TargetHitVolumes() {
  const target = useLab((s) => s.camera.targetId);
  const pills = useLab((s) => s.viz.labels && s.ui.primaryView === "stage" && !s.ui.fullscreenShot && !s.ui.uiHidden);
  const subj = useMeasurementText((m) => m, (m) => `${m.targetName} · ${Math.round(m.subjectFraction * 100)}% of frame height`);
  return (
    <TechLayer>
      {(["primary", "secondary"] as const).map((id) => {
        const c = d.characters[id];
        const h = c.framingBox.top;
        return (
          <group key={id} position={[c.anchor[0], 0, c.anchor[2]]}>
            <mesh
              position={[0, h / 2, 0]}
              onClick={(e) => {
                if (e.delta > 4) return;
                e.stopPropagation();
                labStore.getState().setTarget(id);
                labStore.getState().toast(`Target: ${c.name}`, "T");
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setCursor("pointer");
              }}
              onPointerOut={() => setCursor("")}
            >
              <cylinderGeometry args={[0.3, 0.3, h, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {(target === id || target === "both") && (
              <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.34, 0.37, 48]} />
                <meshBasicMaterial color="#8EF0C3" transparent opacity={0.7} />
              </mesh>
            )}
          </group>
        );
      })}
      {(
        <Html
          position={target === "secondary" ? [d.characters.secondary.anchor[0], 1.35, d.characters.secondary.anchor[2]] : target === "both" ? [d.anchors.both[0], 2.15, d.anchors.both[2]] : [d.characters.primary.anchor[0], 2.12, d.characters.primary.anchor[2]]}
          center
          zIndexRange={[3, 0]}
          portal={htmlLayer as React.RefObject<HTMLElement>}
          calculatePosition={stageLabelPosition}
        >
          <div style={{ visibility: pills ? "visible" : "hidden" }}>
            <Pill tone="subject" testId="pill-target">
              <span ref={subj as React.RefObject<HTMLSpanElement>} />
            </Pill>
          </div>
        </Html>
      )}
    </TechLayer>
  );
}

/** Numerals along the rail ruler: distance to Bram's mark, the same number the dolly slider shows. */
export function RailLabels() {
  const show = useLab((s) => s.viz.rulers && s.ui.primaryView === "stage" && !s.ui.fullscreenShot && !s.ui.uiHidden);
  const railS = useLab((s) => s.camera.rig.railS);
  const vis = { visibility: show ? ("visible" as const) : ("hidden" as const) };
  const x = d.rail.x + 0.95;
  const zBram = d.characters.primary.anchor[2];
  const current = distanceToPrimaryAlongRail(d, railS);
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => (
        <Html key={m} position={[x, 0.02, zBram + m]} center zIndexRange={[2, 0]} portal={htmlLayer as React.RefObject<HTMLElement>} calculatePosition={stageLabelPosition}>
          <span style={{ visibility: show && Math.abs(current - m) > 0.4 ? "visible" : "hidden" }} className="mono pointer-events-none whitespace-nowrap text-[10px] text-ink-3">{m} m</span>
        </Html>
      ))}
      <Html position={[x + 0.35, 0.02, zBram]} center zIndexRange={[2, 0]} portal={htmlLayer as React.RefObject<HTMLElement>} calculatePosition={stageLabelPosition}>
        <span style={vis} className="mono pointer-events-none whitespace-nowrap text-[10px] text-subject">Bram&apos;s mark</span>
      </Html>
      <Html position={[x, 0.02, zBram + current]} center zIndexRange={[2, 0]} portal={htmlLayer as React.RefObject<HTMLElement>} calculatePosition={stageLabelPosition}>
        <span style={vis} className="mono pointer-events-none -translate-y-4 whitespace-nowrap rounded bg-black/50 px-1 text-[10px] text-distance">{formatMeters(current)} m</span>
      </Html>
    </>
  );
}
