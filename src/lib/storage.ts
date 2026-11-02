import type { StateStorage } from "zustand/middleware";

/** In-memory storage used when there is no window (Node tests, SSR). */
export function memoryStorage(): StateStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}
