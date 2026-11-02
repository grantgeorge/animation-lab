import type { Camera, Group, Mesh, Object3D } from "three";

/** Scene objects the Orchestrator needs to reach (set by the components that own them). */
export const scene3d = {
  overlays: null as Group | null,
  cards: [] as Mesh[],
  projectorRig: null as Object3D | null,
  observer: null as Camera | null,
  /** Bram's rest-space scale (metres per position unit), for the coordinate pass. */
  bramRestScale: 1,
};
