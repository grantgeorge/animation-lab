"use client";

import { useEffect, useState } from "react";
import { invalidate } from "@react-three/fiber";
import { studio, type ShotSize } from "./config";
import { getPreset, type PresetId } from "./engine/presets";
import { studioClock } from "./scene/bus";
import { StudioCanvas } from "./scene/StudioCanvas";
import { initializeStudio, studioStore, useStudio } from "./store";
import { installLightingTestHook } from "./testHook";
import { Header, Readouts } from "./ui/Header";
import { LightPanel } from "./ui/LightPanel";
import { LookCard } from "./ui/LookCard";
import { HelpDialog, Toasts } from "./ui/Overlays";
import { PresetBar } from "./ui/PresetBar";
import { PromptBar } from "./ui/PromptBar";
import { Pip, ViewBar } from "./ui/ViewBar";
import { useStudioShortcuts } from "./ui/shortcuts";
import "./ui/lighting-studio.css";

interface Boot {
  e2e: boolean;
  dpr: number | [number, number];
  shadowMapSize: number;
}

/**
 * Read URL params once: e2e=1 (test hook, low quality), quality=high|low, nomotion=1, freeze=<s>,
 * preset=<id>, view=shot|inspect, shot=close|medium|wide.
 */
function boot(): Boot {
  const p = new URLSearchParams(window.location.search);
  const e2e = p.get("e2e") === "1";
  const reduced = p.get("nomotion") === "1" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const freezeRaw = p.get("freeze");
  const freeze = freezeRaw !== null && Number.isFinite(Number(freezeRaw)) ? Number(freezeRaw) : null;
  const q = p.get("quality");
  const high = q === "high" || (!e2e && q !== "low");
  const preset = p.get("preset");
  const view = p.get("view");
  const shot = p.get("shot");
  initializeStudio({
    reducedMotion: reduced,
    freeze,
    presetId: preset && getPreset(preset) ? (preset as PresetId) : undefined,
    view: view === "shot" || view === "inspect" ? view : undefined,
    shotSize: shot && Object.hasOwn(studio.shots, shot) ? (shot as ShotSize) : undefined,
  });
  studioClock.seek(freeze ?? 0);
  return {
    e2e,
    dpr: high ? [1, Math.min(2, window.devicePixelRatio || 1)] : 1,
    shadowMapSize: high ? studio.shadowMap.high : studio.shadowMap.low,
  };
}

export default function LightingStudioLab() {
  const [cfg] = useState(boot);
  const presetId = useStudio((s) => s.presetId);
  const selected = useStudio((s) => s.selected);
  const view = useStudio((s) => s.view);
  const playing = useStudio((s) => s.playing);
  const step = useStudio((s) => s.takeApart);
  const solo = useStudio((s) => s.solo);
  const modified = useStudio((s) => s.modified);
  const transitioning = useStudio((s) => s.transition !== null);
  const reduced = useStudio((s) => s.reducedMotion);
  const shot = useStudio((s) => s.shotSize);
  useStudioShortcuts();

  useEffect(() => {
    const uninstall = installLightingTestHook(() => invalidate());
    const syncClock = (p: boolean) => {
      if (p && !document.hidden) studioClock.play();
      else studioClock.pause();
      invalidate();
    };
    syncClock(studioStore.getState().playing);
    const unsub = studioStore.subscribe((s) => s.playing, syncClock);
    const onVis = () => syncClock(studioStore.getState().playing);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      uninstall();
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      studioClock.pause();
    };
  }, []);

  return (
    <main
      className={`lab-root fixed inset-0 overflow-hidden bg-void ls-root`}
      data-testid="lab-root"
      data-lab="lighting-studio"
      data-preset={presetId}
      data-modified={modified ? "1" : "0"}
      data-selected-light={selected}
      data-view={view}
      data-shot={shot}
      data-playing={String(playing)}
      data-step={step === null ? "" : String(step)}
      data-solo={solo ?? ""}
      data-transitioning={transitioning ? "1" : "0"}
      data-nomotion={reduced ? "1" : "0"}
    >
      <Header />
      <div className="ls-workspace">
        <div className="ls-workbench">
          <ViewBar />
          <div className="ls-picture" data-testid="studio-picture">
            <StudioCanvas dpr={cfg.dpr} shadowMapSize={cfg.shadowMapSize} e2e={cfg.e2e} />
            <div className="ls-picture-caption" aria-hidden="true">{view === "shot" ? "CAMERA 01 / 16:9" : "STUDIO OVERVIEW"}<span>BRAM / LIGHT STUDY</span></div>
            <Pip />
          </div>
          <Readouts />
          <LookCard />
          <div className="ls-bottom" data-ui>
            <PresetBar />
            <PromptBar />
          </div>
        </div>
        <LightPanel />
      </div>
      <Toasts />
      <HelpDialog />
    </main>
  );
}
