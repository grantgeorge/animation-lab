"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { invalidate } from "@react-three/fiber";
import { StageCanvas } from "@/renderer/stage/StageCanvas";
import { ShotMonitor, ShotPromptBar, useSlot } from "@/live/ShotMonitor";
import { Filmstrip } from "@/live/Filmstrip";
import { ControlPanel } from "@/ui/controls/ControlPanel";
import { ConceptPanel, ReadoutChips } from "@/ui/readouts/ReadoutChips";
import { TimelineBar } from "@/ui/timeline/TimelineBar";
import { Toasts } from "@/ui/overlays/Toasts";
import { HelpModal } from "@/ui/overlays/HelpModal";
import { DevStats } from "@/ui/dev/DevStats";
import { ExportDrawer } from "@/ui/export/ExportDrawer";
import { LessonCard } from "@/lessons/components/LessonCard";
import { attachLessonEngine } from "@/lessons/LessonEngine";
import { lessonStore } from "@/lessons/lessonStore";
import { useShortcuts } from "@/ui/shortcuts/useShortcuts";
import { initializeLabSession, labStore, useLab } from "@/ui/store/labStore";
import { installTestHook } from "@/ui/store/testHook";
import { session } from "@/renderer/runtime/session";
import { labClock } from "@/renderer/runtime/clock";
import { viewports } from "@/renderer/runtime/viewports";
import { measurementStore } from "@/renderer/runtime/measurementStore";
import { advancePresentation } from "@/renderer/runtime/presentation";
import { htmlLayer, updateHtmlLayerClip } from "@/renderer/runtime/htmlLayer";
import { ScenePicker } from "@/ui/controls/ScenePicker";
import { isSceneId } from "./config";
import "./lens-framing.css";

function bootSession() {
  session.init();
  session.frames = [];
  session.frameId = 0;
  session.controlsActive = false;
  // localStorage hydrates synchronously; do this before any state writes can persist defaults.
  void labStore.persist.rehydrate();
  void lessonStore.persist.rehydrate();
  const p = session.params;
  const scene = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("scene");
  const observer = p.observer;
  initializeLabSession({
    sceneId: isSceneId(scene) ? scene : undefined,
    reducedMotion: session.reducedMotion,
    freeze: p.freeze,
    observerPreset: observer === "throughLens" || observer === "profile" || observer === "topdown" || observer === "overview" ? observer : undefined,
    uiHidden: !p.ui,
  });
  lessonStore.setState({ active: null, objective: null, cardOpen: false });
  advancePresentation(labStore.getState().camera, 0, { dragging: false, reducedMotion: true, travel: false });
  return true;
}

export default function LensFramingLab() {
  const root = useRef<HTMLElement>(null);
  const [booted] = useState(bootSession);
  const stageSlot = useSlot("stage");
  const primary = useLab((s) => s.ui.primaryView);
  const fullscreen = useLab((s) => s.ui.fullscreenShot);
  const uiHidden = useLab((s) => s.ui.uiHidden);
  const sceneId = useLab((s) => s.ui.sceneId);
  const observer = useLab((s) => s.ui.observerPresetId);
  useShortcuts();

  useEffect(() => {
    const detachLessons = attachLessonEngine();
    const uninstallTestHook = installTestHook(() => invalidate());
    const unsubStore = labStore.subscribe(() => invalidate());
    const unsubClip = viewports.subscribe(() => { updateHtmlLayerClip(); invalidate(); });
    updateHtmlLayerClip();
    const unsubLayout = labStore.subscribe(
      (s) => [s.ui.primaryView, s.ui.fullscreenShot] as const,
      () => {
        viewports.markTransition(340);
        invalidate();
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] },
    );
    // Mirror key state onto the root for tests and screenshots.
    const mirror = () => {
      const el = root.current;
      if (!el) return;
      const s = labStore.getState();
      const m = measurementStore.getState().m;
      el.dataset.focalMm = String(Math.round(s.camera.rig.focalMm));
      el.dataset.mode = s.camera.mode;
      el.dataset.target = s.camera.targetId;
      el.dataset.railS = s.camera.rig.railS.toFixed(4);
      el.dataset.playing = String(s.timeline.playing);
      el.dataset.shotSize = m.shotSize;
      el.dataset.timeS = m.timeS.toFixed(3);
      el.dataset.scene = s.ui.sceneId;
    };
    mirror();
    const unsubMirror = labStore.subscribe(mirror);
    const unsubM = measurementStore.subscribe(mirror);
    const onVis = () => {
      if (document.hidden) labClock.pause();
      else if (labStore.getState().timeline.playing) labClock.play();
      invalidate();
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      unsubStore();
      detachLessons();
      uninstallTestHook();
      unsubClip();
      unsubLayout();
      unsubMirror();
      unsubM();
      document.removeEventListener("visibilitychange", onVis);
      labClock.pause();
      session.controlsActive = false;
    };
  }, []);

  return (
    <main
      ref={root}
      className="lab-root lf-root fixed inset-0 overflow-hidden bg-void"
      data-testid="lab-root"
      data-primary={primary}
      data-fullscreen-shot={fullscreen ? "1" : "0"}
      data-ui-hidden={uiHidden ? "1" : "0"}
      data-nomotion={session.reducedMotion ? "1" : "0"}
      data-booted={booted ? "1" : "0"}
    >
      {/* Keyed by scene: a switch remounts the canvas, set, cast and scene-dependent UI. */}
      <Fragment key={sceneId}>
      <StageCanvas eventSource={root} />
      <div
        ref={(el) => {
          htmlLayer.current = el;
          updateHtmlLayerClip();
        }}
        className="pointer-events-none fixed inset-0 z-[3] overflow-hidden"
        data-testid="label-layer"
      />
      <header className="lf-header" data-ui>
        <div className="lf-brand">
          <Link href="/" className="lf-home" data-testid="home-link" aria-label="Back to Animation Lab"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Animation Lab</span></Link>
          <span className="lf-brand-divider" aria-hidden="true" />
          <h1>Lens &amp; Framing</h1>
        </div>
        <p>Choose a lens. Find the perspective.</p>
        <button type="button" className="lf-help" data-testid="help-button" onClick={() => labStore.getState().setHelpOpen(true)}>Field guide <span>?</span></button>
      </header>
      <div className="lf-workspace">
        <div className="lf-workbench">
          <div className="lf-toolbar" data-ui>
            <div className="lf-view-modes" role="group" aria-label="Main view">
              <button type="button" aria-pressed={primary === "shot"} onClick={() => labStore.getState().setPrimaryView("shot")} data-testid="view-shot">Camera</button>
              <button type="button" aria-pressed={primary === "stage"} onClick={() => labStore.getState().setPrimaryView("stage")} data-testid="view-stage">Studio</button>
            </div>
            {primary === "stage" && <select aria-label="Studio viewpoint" className="lf-observer" value={observer} onChange={(e) => labStore.getState().setObserverPreset(e.target.value as typeof observer)}>
              <option value="overview">Overview</option><option value="profile">Side view</option><option value="topdown">Top view</option><option value="throughLens">Through the lens</option>
            </select>}
            <ScenePicker />
          </div>
          <div className="lf-picture" data-testid="lens-picture">
            <div ref={stageSlot} className="stage-slot" data-testid="stage-slot" aria-label="3D stage: drag to orbit, scroll to zoom" tabIndex={0} />
            <ShotMonitor />
            <span className="lf-picture-label" aria-hidden="true">{primary === "shot" ? "CAMERA 01 / 16:9" : "STUDIO / DRAG TO ORBIT"}</span>
            <button type="button" className="lf-peek-label" data-ui data-testid="swap-view" onClick={() => labStore.getState().swapViews()} title="Swap main view (V)">{primary === "shot" ? "Studio view" : "Camera view"}<span>↗</span></button>
            <button type="button" className="lf-expand" data-ui data-testid="expand-shot" onClick={() => labStore.getState().toggleFullscreenShot()} aria-label={fullscreen ? "Exit full screen" : "Show camera full screen"}>{fullscreen ? "Close ×" : "⛶"}</button>
          </div>
          <ReadoutChips />
          <TimelineBar />
          <ConceptPanel />
          <div className="lf-compare-label" data-ui><span className="lf-eyebrow">LIVE LENS COMPARISON</span><span>Same performance · choose a frame</span></div>
          <Filmstrip />
          <ShotPromptBar />
        </div>
        <aside className="lf-inspector" data-ui aria-label="Compose and learn">
          <ControlPanel />
          <LessonCard />
        </aside>
      </div>
      <Toasts />
      <HelpModal />
      <ExportDrawer />
      {session.params.debug && <DevStats />}
      </Fragment>
    </main>
  );
}
