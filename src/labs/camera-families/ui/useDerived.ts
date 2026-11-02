"use client";

import { useMemo } from "react";
import { deriveShot } from "../engine/derive";
import { cfStore, useCF } from "../store";

/** Everything the panels show, recomputed only when the store's version changes. */
export function useDerived() {
  const version = useCF((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => deriveShot(cfStore.getState()), [version]);
}
