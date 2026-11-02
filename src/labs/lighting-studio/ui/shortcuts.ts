"use client";

import { useEffect } from "react";
import { PRESETS, TAKE_APART_STEPS, getPreset } from "../engine/presets";
import { analyze, effectiveRig } from "../engine/ratio";
import { buildPrompt } from "../engine/prompt";
import type { ChannelId } from "../engine/types";
import { channelMask, studioStore } from "../store";
import { CHANNEL_NAMES } from "./hooks";
import { copyPrompt } from "./PromptBar";

const SELECT: Record<string, ChannelId> = { KeyK: "key", KeyF: "fill", KeyR: "rim", KeyA: "ambient" };

/** Prompt text for the current state (same rule as the prompt bar). */
export function currentPrompt(): string {
  const s = studioStore.getState();
  const mask = channelMask(s);
  const full = mask.key === 1 && mask.fill === 1 && mask.rim === 1 && mask.ambient === 1;
  const eff = effectiveRig(s.rig, mask);
  return buildPrompt(eff, { lead: full && !s.modified ? getPreset(s.presetId)?.promptLead : undefined });
}

export function currentAnalysis() {
  const s = studioStore.getState();
  return analyze(effectiveRig(s.rig, channelMask(s)));
}

export function useStudioShortcuts() {
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === "TEXTAREA") return true;
      if (el.tagName === "SELECT") return true;
      return el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range";
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const s = studioStore.getState();
      if (s.helpOpen && e.key !== "Escape") return;
      const focused = e.target instanceof HTMLElement ? e.target : null;
      const onControl = Boolean(focused?.closest("button, a, summary, input, [role='button'], [role='tab'], [role='radio'], [role='option']"));
      const preset = PRESETS.find((p) => e.code === `Digit${p.key}` || e.code === `Numpad${p.key}`);
      if (preset && !e.shiftKey) {
        s.applyPreset(preset.id);
        s.toast(preset.name, preset.key);
        e.preventDefault();
        return;
      }
      if (SELECT[e.code] && !e.shiftKey) {
        s.select(SELECT[e.code]);
        s.toast(`${CHANNEL_NAMES[SELECT[e.code]]} selected`, e.code.slice(3));
        return;
      }
      const target = s.selected === "ambient" ? null : s.selected;
      switch (e.code) {
        case "Space": {
          if (onControl) return;
          e.preventDefault();
          s.setPlaying(!s.playing);
          s.toast(s.playing ? "Paused" : "Playing", "Space");
          return;
        }
        case "KeyV":
          s.setView(s.view === "shot" ? "inspect" : "shot");
          s.toast(s.view === "shot" ? "Inspect view" : "Shot view", "V");
          return;
        case "KeyS":
          s.toggleSolo(s.selected);
          s.toast(s.solo === s.selected ? "Solo off" : `Solo ${CHANNEL_NAMES[s.selected].toLowerCase()}`, "S");
          return;
        case "KeyT":
          s.setTakeApart(s.takeApart === null ? 0 : null);
          s.toast(s.takeApart === null ? "Take apart: key only" : "Full look", "T");
          return;
        case "BracketLeft":
        case "BracketRight": {
          const d = e.code === "BracketLeft" ? -1 : 1;
          const cur = s.takeApart ?? (d > 0 ? -1 : TAKE_APART_STEPS.length);
          const next = Math.max(0, Math.min(TAKE_APART_STEPS.length - 1, cur + d));
          s.setTakeApart(next);
          s.toast(TAKE_APART_STEPS[next].label, d < 0 ? "[" : "]");
          return;
        }
        case "KeyC":
          void copyPrompt(currentPrompt());
          return;
        case "Escape":
          if (s.helpOpen) s.setHelpOpen(false);
          else if (s.solo) s.toggleSolo(s.solo);
          else if (s.takeApart !== null) s.setTakeApart(null);
          return;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          if (onControl || !target) return;
          e.preventDefault();
          const step = e.shiftKey ? 15 : 5;
          const l = s.rig.lights[target];
          if (e.code === "ArrowLeft") s.setLight(target, { azimuthDeg: l.azimuthDeg - step });
          if (e.code === "ArrowRight") s.setLight(target, { azimuthDeg: l.azimuthDeg + step });
          if (e.code === "ArrowUp") s.setLight(target, { elevationDeg: l.elevationDeg + step });
          if (e.code === "ArrowDown") s.setLight(target, { elevationDeg: l.elevationDeg - step });
          return;
        }
      }
      if (e.key === "?" || (e.code === "Slash" && e.shiftKey)) {
        s.setHelpOpen(!s.helpOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
