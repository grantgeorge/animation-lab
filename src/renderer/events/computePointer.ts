import { Vector3 } from "three";
import type { RootState } from "@react-three/fiber";
import { viewports } from "@/renderer/runtime/viewports";

const FAR_ORIGIN = new Vector3(0, -1e6, 0);
const DOWN = new Vector3(0, -1, 0);

/**
 * R3F pointer compute: only events whose target is inside the stage slot raycast the scene,
 * mapped through the slot's own rectangle (so it works full-bleed and as the picture-in-picture).
 * Everything else (panels, the monitor) casts a ray into the void so nothing is hit.
 */
export function computePointer(event: { clientX: number; clientY: number; target: EventTarget | null }, state: RootState) {
  const stage = viewports.get("stage");
  const target = event.target as Node | null;
  if (!stage || !target || !(target instanceof Node) || !stage.el.contains(target) || stage.css.width < 2) {
    state.pointer.set(-10, -10);
    state.raycaster.set(FAR_ORIGIN, DOWN);
    return;
  }
  const c = state.gl.domElement.getBoundingClientRect();
  const x = event.clientX - c.left - stage.css.left;
  const y = event.clientY - c.top - stage.css.top;
  state.pointer.set((x / stage.css.width) * 2 - 1, -(y / stage.css.height) * 2 + 1);
  state.raycaster.setFromCamera(state.pointer, state.camera);
}
