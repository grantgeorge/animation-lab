"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { HistoryView } from "./HistoryView";
import { parseState, serializeState } from "./state";
import type { HistoryState } from "./types";

/** Binds view state to the URL. pushState integrates with the Next router, so back/forward restore it. */
export function HistoryExperience() {
  const params = useSearchParams();
  const state = parseState(params);
  const onChange = useCallback(
    (patch: Partial<HistoryState>, opts?: { replace?: boolean }) => {
      const next = { ...parseState(window.location.search), ...patch };
      const url = `${window.location.pathname}${serializeState(next)}`;
      if (opts?.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [],
  );
  return <HistoryView state={state} onChange={onChange} />;
}
