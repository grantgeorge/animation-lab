# Shot Coverage & Editing lab

`/labs/shot-coverage`. It uses the same scenes, cast and performances as Lens & Framing and Camera Movement. Three locked-off cameras (A, B, C) cover Bram and Pip, and a miniature editor cuts between them. The lab teaches how a scene is built from separate shots, not found in one beautiful frame.

## What it teaches

- **Coverage.** The default set is A = wide master, B = over-the-shoulder on Bram (past Pip) and C = over-the-shoulder on Pip (past Bram), all on the front side of the line. Each camera also has five presets: wide master, OTS on Bram, OTS on Pip, medium single and close-up reaction.
- **The 180° rule (signature interaction).** The axis of action runs through both characters' feet. It is drawn on the stage floor and in the plan view, and it moves with them: in the alley it swings as Pip sprints in. Press **Cross the line** (`X`) to mirror the selected camera across the axis. The monitors' L/R chips swap, the eyeline arrows reverse, the side badge turns red ("ACROSS"), and the continuity checker flags every cut into or out of that camera.
- **Reaction shots and rhythm.** There are five edit presets: Classic coverage (master → OTS → reaction → master, cut on the scene's story beats), Crossing the line (the same edit with C mirrored), Reaction-heavy, Fast cutting (0.6 s shots) and Slow cutting. The timeline shows the average shot length and cuts per minute.
- **Continuity.** `checkContinuity` checks every cut at the instant it happens, against the axis where the characters are at that moment. It looks for three problems:
  - crossing the line: the two cameras are on opposite sides, so screen direction flips;
  - jump cuts: the same subject, less than 30° of camera change, and a height-fraction ratio below 1.5;
  - cuts to the same camera.
  Each flag appears as a marker on the timeline ruler, with a one-line explanation below the track.
- **AI multi-shot prompt.** `buildMultiShotPrompt` writes the edit as a deterministic Seedance-style prompt. Each line gives a time range, shot type and size (body fraction → `classifyShotSize`), angle, lens, and either screen positions or eyeline. It closes with a continuity note that states the screen geography and names any shot that breaks it. Example line: "Shot 3 (3.3–4.7 s): Over-the-shoulder medium shot on Pip, past Bram's shoulder frame-left, high angle, 88 mm portrait telephoto; Pip looks screen-left toward Bram."

## Modes

- **Watch (`W`):** the cut plays full-frame (16:9), with a read-only timeline, the prompt line of the shot on screen, and a copy button.
- **Inspect (`I`):** the stage shows camera bodies, frustums, the axis with the front and across half-planes tinted, and character rings. A live table gives each camera's side and each character's screen x, L/R and eyeline. The inspector holds the plan view and 180° concept card; the three ISO monitors stay beneath the picture.
- **Experiment (`E`):** the camera editor (presets, aim, lens, height, cross the line), the Program monitor, ISO monitors, the plan view, the editable timeline and the prompt.

## Interaction

- **Cameras:** drag them on the stage (Shift-drag changes height) or in the plan view. Positions are clamped to the set's camera zone (`COVERAGE_SCENES`).
- **Timeline:**
  - `1` / `2` / `3` cut live to A / B / C while playing in Experiment. When paused, they select a camera instead.
  - Drag a cut point to trim, click a shot to change its camera or remove the cut, and `Z` or Undo reverts the last edit.
  - Clear leaves one shot, ready for a live-switching pass.
- **Keys:** `Space` play/pause, `,` `.` step a frame, `X` cross the line, `W` / `I` / `E` modes, `Home` restart, `?` help.

## Architecture

- `engine/` is pure TypeScript (three math classes only), with Vitest tests in `engine.test.ts`:
  - `axis.ts`: the axis of action, signed side, mirror and crossing test.
  - `shots.ts`: aim points, poses, and `screenInfo`. That function gives projected x, L/R order and the eyeline toward the other character. "Toward" and "away from the lens" apply only when the line is within about 2° of the lens axis. `describeShot` classifies a shot as master, two-shot, OTS or single, with size, angle and lens.
  - `presets.ts`: presets solved against the axis at each scene's reference time.
    - Focal length comes from the target body fraction.
    - The OTS lateral offset is solved so the foreground head sits on the frame edge. If there is no room behind the foreground character, the preset falls back to an eye-level single.
    - Singles prefer angles that look into the set.
    - The file also holds `crossLine`, `camSides` and `isCrossed`.
  - `edit.ts`: edit list operations (insert or live cut, trim, swap, remove, normalize, undo history), stats and edit presets.
  - `continuity.ts`: the checker.
  - `prompt.ts`: the multi-shot prompt.
- `runtime/Orchestrator.tsx` is the lab's only positive-priority `useFrame`. Each frame it:
  1. ticks the lab clock;
  2. solves A, B and C plus the program camera (the edit at the playhead);
  3. runs the frame-bus updaters;
  4. updates shadows once;
  5. clears the full canvas, then renders the bounded stage window (skipped in Watch);
  6. renders each 16:9 DOM window (W, P, A, B, C) with a scissor, drawing the small stage last in Experiment.
- Shot cameras see layer 0 only. Technical viz sits on layer 1 through `TechLayer`.
- Camera ID tags over the stage are plain DOM, projected through the observer camera and hidden under the monitor windows and panels. drei `<Html>` caused a React "synchronous unmount" error here.
- The observer aspect and pointer projection use the actual stage DOM rectangle, so the stage remains centered in both the main workspace and its small inset.
- No ancestor of a monitor window has a background or `glass`.
- `store.ts` is a zustand store with its own `MasterClock` and a `version` memo key. `ui/derived.ts` memoizes flags, stats, the prompt and sides.
- The test hook `window.__coverageLab` exists only with `?e2e=1`. It provides `getState`, `setCamera`, `setEdit`, `seek`, `pause`, `live()` (per-camera screen x, L/R, looks, axis side and fraction, plus program and crossed) and `frames`. The `lab-root` element mirrors `data-mode`, `data-scene`, `data-crossed`, `data-program-camera` and `data-duration`.
- The URL accepts `?scene=`, `?mode=watch|inspect|experiment` and `?freeze=`.
- E2E: `e2e/26-shot-coverage.spec.ts`. Screenshots: `node scripts/shots-coverage.mjs` against the dev server on port 3123, output to `docs/screenshots/shot-coverage/`.

## Limitations

- Cameras are locked off: no moves within a shot, so you cannot cross the line on camera, only discuss it. Cuts are hard cuts, with no transitions and no time remapping. The edit is a live switch of synchronous cameras.
- Eyeline means the line of looking toward the other character (the relationship the rule protects). It is not the head's actual gaze, so a character facing the lens can still be tagged "looks screen-right toward Pip". The doorway staging has Bram's back to Pip until he turns at about 2.5 s.
- The doorway set is only dressed for views down −z. Reverse and side angles see a dark backdrop, and B's OTS on Bram falls back to a single because Pip stands against the wall.
- Camera zones are rectangles: walls are respected, but props (the lantern, the bench) are not.
- The jump-cut test compares camera angle and subject size only. It ignores the background and action continuity.

## Focused workspace review

Experiment opens with the Program picture prominent, a Studio inset, three persistent ISO previews and the edit timeline below. Inspect swaps Studio into the main picture. A compact inspector contains camera selection, lens, plan and continuity guidance; camera height and generated shot notes are disclosures. Watch gives the cut the full workspace. Phone controls follow the picture and timeline in a scrollable page.

The field guide traps focus through the native dialog, restores focus on Escape, and respects keyboard interaction. Native Space on a camera button selects it without toggling playback; ISO previews can be selected with Enter or Space. Reduced motion starts paused.

Reviewed 1440×900, 1280×800 and 390×844 captures are in `docs/screenshots/shot-coverage-refined/`, including Watch, Inspect and scrolled phone controls. Browser coverage verifies frame containment, adjacent panels, no horizontal overflow, editing, keyboard behavior and disclosure access.
