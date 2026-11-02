"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import { LAYER_TECH } from "./layers";

/** Puts every descendant on the technical layer (seen by the observer, never by the film camera). */
export function TechLayer({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      o.layers.set(LAYER_TECH);
      o.castShadow = false;
    });
  });
  return <group ref={ref}>{children}</group>;
}
