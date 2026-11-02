"use client";

import { useEffect } from "react";
import { sceneDescriptor as d } from "@/labs/lens-and-framing/config";
import { labStore } from "@/ui/store/labStore";
import { copyShotJson, copyShotPhrase } from "@/ui/export/exportShot";
import { saveShot } from "@/lessons/LessonEngine";
import { lessonStore } from "@/lessons/lessonStore";

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== "range");

/** One window-level keyboard map. Ignored with ⌘/Ctrl/Alt or while typing. Every action toasts. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = labStore.getState();
      if (e.key === "Escape") {
        if (s.ui.helpOpen) s.setHelpOpen(false);
        else if (s.ui.exportOpen) s.setExportOpen(false);
        else if (s.ui.fullscreenShot) s.toggleFullscreenShot();
        else if (s.ui.uiHidden) s.setUiHidden(false);
        return;
      }
      if (isEditable(e.target) || s.ui.helpOpen || s.ui.exportOpen) return;
      const focused = e.target instanceof HTMLElement ? e.target : null;
      const onControl = Boolean(focused?.closest("button, a, summary, input, [role='button'], [role='tab'], [role='radio']"));
      const digit = /^Digit([1-6])$/.exec(e.code);
      if (digit && !e.shiftKey) {
        const f = d.focal.presets[Number(digit[1]) - 1];
        s.setFocal(f, "key");
        s.toast(`${f} mm`, digit[1]);
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case "BracketLeft":
        case "BracketRight": {
          const dir = e.code === "BracketLeft" ? -1 : 1;
          s.nudgeFocal(dir * (e.shiftKey ? 5 : 1));
          e.preventDefault();
          return;
        }
        case "ArrowLeft":
        case "ArrowRight": {
          if (onControl) return; // native controls retain their own keyboard interaction
          const closer = e.code === "ArrowRight";
          if (s.camera.mode === "match") s.nudgeFraming(closer ? 1.05 : 1 / 1.05);
          else s.nudgeDistance((closer ? -1 : 1) * (e.shiftKey ? 0.5 : 0.1));
          e.preventDefault();
          return;
        }
        case "Space":
          if (onControl) return;
          s.togglePlay();
          e.preventDefault();
          return;
        case "Home":
          if (onControl) return;
          s.restart();
          return;
        case "Comma":
          s.step(-1);
          return;
        case "Period":
          s.step(1);
          return;
      }
      const k = e.key.toLowerCase();
      if (e.shiftKey) {
        if (k === "f") {
          s.toggleFullscreenShot();
          s.toast(labStore.getState().ui.fullscreenShot ? "Shot fullscreen · Esc to return" : "Fullscreen off", "⇧F");
        } else if (k === "u") {
          s.setUiHidden(!s.ui.uiHidden);
          if (!labStore.getState().ui.uiHidden) s.toast("Interface shown", "⇧U");
        } else if (k === "v") {
          const order = ["overview", "profile", "topdown"] as const;
          const cur = order.indexOf(s.ui.observerPresetId as (typeof order)[number]);
          const next = order[(cur + 1) % order.length];
          s.setObserverPreset(next);
          s.toast(`Stage view: ${next}`, "⇧V");
        } else if (k === "r") {
          s.resetCamera();
          s.toast("Film camera reset", "⇧R");
        } else if (k === "c") {
          void copyShotJson();
        } else if (e.key === "?") {
          s.setHelpOpen(true);
        }
        return;
      }
      switch (k) {
        case "m":
          s.setMode(s.camera.mode === "fixed" ? "match" : "fixed");
          s.toast(labStore.getState().camera.mode === "match" ? "Match framing: the camera moves to keep the size" : "Fixed camera", "M");
          break;
        case "t": {
          s.cycleTarget();
          const t = labStore.getState().camera.targetId;
          s.toast(`Target: ${t === "primary" ? "Bram" : t === "secondary" ? "Pip" : "Both"}`, "T");
          break;
        }
        case "v":
          s.swapViews();
          s.toast(labStore.getState().ui.primaryView === "shot" ? "Monitor is the main view" : "Stage is the main view", "V");
          break;
        case "f":
          s.toggleViz("frustum");
          break;
        case "g":
          s.toggleViz("grid");
          s.toggleViz("rulers");
          break;
        case "o": {
          const { thirds, safeAreas } = s.viz;
          if (!thirds) s.toggleViz("thirds");
          else if (!safeAreas) s.toggleViz("safeAreas");
          else {
            s.toggleViz("thirds");
            s.toggleViz("safeAreas");
          }
          break;
        }
        case "r":
          s.setObserverPreset("overview");
          s.toast("Stage view reset", "R");
          break;
        case "h":
          s.setHelpOpen(true);
          break;
        case "c":
          void copyShotPhrase();
          break;
        case "s":
          saveShot();
          break;
        case "x":
          s.setExportOpen(!s.ui.exportOpen);
          break;
        case "p":
          s.toggleViz("perspectiveGuide");
          s.toast(labStore.getState().viz.perspectiveGuide ? "Perspective guide on" : "Perspective guide off", "P");
          break;
        case "l":
          lessonStore.setState({ cardOpen: !lessonStore.getState().cardOpen });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
