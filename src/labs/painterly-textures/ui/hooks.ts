"use client";

import { useEffect, useState } from "react";
import { live } from "../live";

/** Re-render on a timer so DOM readouts follow `live` without a React update per frame. */
export function useLiveTick(ms = 180) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => (n + 1) % 1e6), ms);
    const l = () => setN((n) => (n + 1) % 1e6);
    live.listeners.add(l);
    return () => {
      window.clearInterval(id);
      live.listeners.delete(l);
    };
  }, [ms]);
}

/** Copy text with a short "Copied" acknowledgement. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
  };
  return { copied, copy };
}
