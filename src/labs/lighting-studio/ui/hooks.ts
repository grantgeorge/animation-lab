"use client";

import { useMemo } from "react";
import { analyze, effectiveRig } from "../engine/ratio";
import { buildPrompt } from "../engine/prompt";
import { getPreset } from "../engine/presets";
import { describeAzimuth } from "../engine/spherical";
import { channelMask, useStudio } from "../store";
import type { ChannelId } from "../engine/types";

export const CHANNEL_NAMES: Record<ChannelId, string> = { key: "Key", fill: "Fill", rim: "Rim", ambient: "Ambient & set" };

/** What is actually on screen: the rig after solo / take-apart, its analysis and prompt phrase. */
export function useEffective() {
  const rig = useStudio((s) => s.rig);
  const solo = useStudio((s) => s.solo);
  const step = useStudio((s) => s.takeApart);
  const presetId = useStudio((s) => s.presetId);
  const modified = useStudio((s) => s.modified);
  return useMemo(() => {
    const mask = channelMask({ solo, takeApart: step });
    const eff = effectiveRig(rig, mask);
    const full = mask.key === 1 && mask.fill === 1 && mask.rim === 1 && mask.ambient === 1;
    const lead = full && !modified ? getPreset(presetId)?.promptLead : undefined;
    return { mask, rig: eff, analysis: analyze(eff), fullAnalysis: analyze(rig), prompt: buildPrompt(eff, { lead }) };
  }, [rig, solo, step, presetId, modified]);
}

/** "L 40°", "R 115°", "0°", "180°". */
export function formatAzimuth(az: number): string {
  const { screen, abs } = describeAzimuth(az);
  if (abs === 0 || abs === 180) return `${abs}°`;
  return `${screen === "left" ? "L" : screen === "right" ? "R" : ""} ${abs}°`.trim();
}

export function formatElevation(el: number): string {
  const v = Math.round(el);
  return `${v > 0 ? "↑" : v < 0 ? "↓" : ""}${Math.abs(v)}°`;
}

export function placementText(az: number, el: number, d: number): string {
  const { screen, abs } = describeAzimuth(az);
  const side = screen === "centre" ? (abs > 90 ? "directly behind" : "from the camera") : `camera ${screen} ${abs}°`;
  const up = Math.round(el);
  return `${side} · ${up >= 0 ? `${up}° up` : `${-up}° below`} · ${d.toFixed(1)} m`;
}
