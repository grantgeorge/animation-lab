# Architecture

```
src/
  engine/      pure simulation (three math only; ESLint forbids React/R3F/Next/zustand imports)
    optics · projection · rig · matchFraming · measure · classify · export/ · timeline/clock
  labs/        registry, loaders, and the Lens & Framing lab (config.ts = the scene descriptor)
  scene/       the animated world: set pieces, puppets (Bram, Pip), keyframe DSL, performance data
  renderer/    runtime (FrameOrchestrator, frame bus, presentation, film camera, viewports, quality)
               stage/ (canvas, observer controls, camera rig, frustum, interaction)
  live/        the director's monitor, filmstrip thumbnails, perspective guide
  lessons/     lesson store, exercises, lesson engine, copy, lesson card
  ui/          zustand store + events, controls, readouts, timeline, export, overlays, shortcuts
```

## Data flow
1. **Canonical state** lives in one zustand store (`ui/store/labStore.ts`): camera rig (rail position, yaw, pitch, focal), mode, target, Match reference, timeline, view toggles, UI. Actions call the engine (`solveMatchedFraming`, `captureMatchRef`, `clampRailS`) and emit typed events (`ui/store/events.ts`).
2. **The frame** (`renderer/runtime/FrameOrchestrator.tsx`, the only `useFrame` with a positive priority): tick the master clock once → ease the presentation camera in log space → sync the film camera → run updaters (puppet poses, door, rig, frustum) → publish measurements → render the stage pass, the shot pass (scissored into the monitor's DOM window) and the filmstrip thumbnails → keep the demand loop alive only while something moves.
3. **Readouts** bind to a vanilla measurement store with `subscribe → textContent`; nothing re-renders React per frame.
4. **Lessons** listen to events (hold timer for presets, camera travel, saved shots) and persist progress in localStorage.

## Same world, same time
Every pass renders the one scene with one clock value. The film camera sees layer 0 only; the observer camera also sees layer 1 (rig, rail, frustum, rulers, studio gear). The cross-view e2e test renders the stage through the lens and compares it with the monitor.

## Adding a lab
Add a folder under `src/labs/<id>/` exporting a default component, add a loader entry in `labs/loaders.ts`, and flip the registry entry to `status: "available"` with `entry` set. Reuse `scene/`, `engine/`, the clock and the UI primitives.
