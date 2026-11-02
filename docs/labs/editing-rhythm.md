# Editing & Rhythm lab

`/labs/editing-rhythm`. One continuous animated performance, covered by six cameras, cut four ways. The central lesson: **editing decides what the audience sees, when they see it, and how long they have to react**, even when the footage is identical. Every edit is explained in plain words, and can be handed off as a TrueStudio cut list, a CMX3600 EDL or a Seedance multi-shot prompt.

How it relates to the neighbouring labs:

- **Storyboards & Animatics** (`/labs/storyboards-animatics`) re-times static SVG panels. That is the "boards first" step, and the header links to it.
- **Shot Coverage** (`/labs/shot-coverage`) builds the coverage and checks the 180° line.
- **This lab** cuts *live animated 3D footage with handles and sound*, and teaches six editing concepts. It reuses Shot Coverage's axis maths (`axisFrom`, `sideOf`, `reflectAcross`, `crossesAxis`) by import.

## The scene and the footage

The scene is a night square (the doorway set), with Pip, Bram, a carved box on a crate, and a 22 s take on the `main` reel:

| Time (s) | What happens |
| --- | --- |
| 0–4.5 | Pip studies the faintly pulsing box and steps closer. Bram gazes off down the street. |
| 4.5–7.5 | Pip slowly reaches. At 6.0 Bram's head snaps round. At 6.5 his face turns to worry. At 7.2 his hand goes up: *wait*. |
| 9.3 | The lid creaks open a crack. |
| 10–13 | Pip hesitates, pulls back and looks to Bram, who shakes his head. |
| 13–14.2 | Pip lunges and touches the lid. |
| 14.6 | The lid flies open in a burst of light, and Bram jumps. |
| 14.8–22 | Glowing moths spiral up. Pip shows wonder, Bram relief. |

How the footage works:

- **The six shots** are cameras on that one performance: 1 Establish (WS), 2 Reach (MCU), 3 Reaction (CU on Bram), 4 Glowing box (insert), 5 Hesitation (CU on Pip), 6 Reveal (low WS). Every shot has natural handles: any clip can be trimmed or slipped anywhere in the 22 s take without re-rendering.
- **A clip** is `{ shot, sourceIn, duration }`, plus optional `audioLead` (J/L) and `dissolve`.
- **The clock** is deterministic. The program monitor poses the whole stage at the clip's *source* time, so comparisons are exactly reproducible.
- **One master source timeline** holds four reels: `main` (22 s), `kule` (Kuleshov plates, 8 s), `slip` (banana peel, 16 s) and `mont` (lamplighter, 60 s). Props show themselves only in their own reel.
- **The cast** is the shared Bram and Pip rigs, driven through `RiggedCharacter` with this lab's clips. The performance is authored with the DSL, `restArms`, a walk-cycle generator and face tracks (brows, eyes, mouth).

## The Editing Timeline Playground (Experiment → Timeline)

- **Program monitor** on top, timeline below.
- **Preset tabs:** Suspense, Comedy, Action, Emotion.
- **Shot blocks:** proportional, coloured, with names and durations.
- **Selecting a block** gives you:
  - the duration slider (limited by the tail handle);
  - **Move earlier / Move later**;
  - drag the block to reorder it;
  - drag its edge grips to trim head or tail. The selected clip's available handles are drawn as a bracket under the track.
- **Stat cards:** Runtime, Average shot length, Cuts.
- **Sound lane:** each clip's sound segment, the box's hum envelope and every sound-effect marker. Click a marker to audition it.
- **Knows lane:** when the danger is visible, when Bram reacts, when the box opens. It also draws a bracket for the gap the lesson is about ("6.5 s fear before cause" or "audience ahead of Bram").
- **Compare side by side** plays your edit (A) and another treatment (B) in two scissored viewports on one canvas, from the same head, on a shared time scale.

### How the presets differ (structure, not just durations)

All times are main-reel source seconds.

| Preset | Order | What makes it that genre |
| --- | --- | --- |
| Suspense (19.0 s, ASL 3.2) | 1 → 2 → 3 → 5 → 4 → 6 | Bram's reaction comes **before** the audience sees the danger. The insert is held back and overlaps time (11.8 s, while the hesitation ends at 13.4 s): the moment stretches. |
| Comedy (10.8 s, ASL 1.8) | 1 → 2 → 4 → 5 → 6 → 3 | Quick setup, then an ellipsis straight to the creak. A 2.6 s hesitation is the timed pause before a sudden reveal. Bram's startle comes **after** the reveal, as the punchline, rewinding 1.3 s of action. |
| Action (7.6 s, ASL 1.1) | 2 → 3 → 4 → 5 → 2 → 4 → 6 | **No establishing shot.** In-points are tight, and five of six cuts land on movement (reach, head snap, pull-back, lunge, lid). Shots 2 and 4 are used twice. |
| Emotion (20.0 s, ASL 4.0) | 1 → 2 → 3 → 6 → 3 | Long close-ups, **no insert**, four cuts. A second reaction after the reveal (Bram's relief, 3.5 s) is the payoff. |

## The explanation layer (rule-based, deterministic)

`engine/explain.ts` analyses the edit's structure. **It is not an AI model**: the same edit always gets the same words. It samples the edit frame by frame and records what the audience can see:

- **Danger visible:** a box-scene shot with box salience × `boxGlow(source t)` ≥ 0.4, before the lid opens.
- **Reaction on screen:** a shot whose subject is Bram's face (salience ≥ 0.9) from 6.3 s of source time. It is classed as worry, startle or relief.
- **Reveal:** the box in frame with the lid open.

From those it fires rules:

| Rule | Fires when |
| --- | --- |
| `order.reaction-first` | Bram reacts before the cause is visible ("Bram's fear arrives 6.5 s before its cause… that gap is suspense") |
| `order.danger-first` | The danger is seen before he reacts (anticipation, dramatic irony) |
| `order.surprise` | The box is never shown glowing before it opens (Hitchcock's bomb) |
| `order.no-reaction` | Nobody reacts on screen |
| `reaction.punchline` / `reaction.payoff` | A reaction follows the reveal (short and immediate, or long and lingering) |
| `tempo.fast` / `brisk` / `measured` / `slow` | ASL below 1.4, 2.5 and 3.6 s, or above |
| `cuts.movement` / `cuts.still` | The share of cuts whose in- or out-point falls inside a visible movement window |
| `time.stretch` / `time.ellipsis` | Overlapping source ranges, or skipped action (> 0.6 s per cut, > 1 s total) |
| `coverage.no-establish` / `coverage.repeat` | Coverage choices |
| `hold.longer` / `hold.shorter` | A clip ≥ 0.3 s longer or shorter than the treatment's own cut |
| `audio.j` / `audio.l` | Split edits |

The **headline** describes the latest change. Store actions record it for presets and tempo; otherwise it comes from diffing the previous edit against this one: duration, move, trim or slip, tempo, split. It is phrased from the clip involved and the information order. Example: hold the reaction from 3.5 to 4.5 s and it reads "You held the reaction shot longer before revealing the box. The audience now experiences Bram's fear for 4.5 s before discovering its cause." A move that flips the order says so explicitly.

**Reads as** scores the structure against each treatment's recipe and names the closest one. Each preset reads as itself; this is unit-tested.

## The six concepts (one technique each)

- **a. Pacing (tempo).** One slider scales every shot's duration from ×0.5 to ×1.6, keeping in-points. Same shots, same order; only rhythm changes.
- **b. Kuleshov.** Bram's neutral close-up, held on the `kule` reel (no brow, no smile, eyes off-screen right), sits either side of one insert: the glowing box, Pip shyly offering a gift, or a fallen lantern guttering on the cobbles. Both close-ups are the **identical frames** (asserted in tests). The lab asks "what do you read on his face?" and records your answers.
- **c. Reaction shots.** The same three shots: Establish, then Bram's reaction, then the reveal; or Establish, then the reveal, then the reaction.
- **d. Continuity.** Pip's close-up, then Bram's close-up during their exchange of looks. **Flip camera 3 across the line** mirrors it with the coverage lab's `reflectAcross`. Eyelines are computed for both shots: matched means Pip looks ←, Bram looks →. Once crossed, both look the same way. The cut gets a ⚠ flag, and the plan diagram draws camera 3 in red on the far side.
- **e. J/L cuts.** Bram's worried close-up cuts to the reveal. A slider (−1.6…+1.6 s) slides the **sound edit** while the picture cut stays at 3.2 s:
  - J-cut: the burst of light (from the reveal's head handle) is heard over Bram's face;
  - L-cut: Bram's pleading breath (from his tail handle) carries over the reveal.
  The Sound lane shows the segment boundary moving; markers that play over the other shot's picture turn amber.
- **f. Montage & compression.** The lamplighter reel has four lamps, dusk deepening into night, over 60 s:
  - **Real time:** one 59.8 s clip (1×);
  - **Jump cuts:** five 2 s clips on the moments that matter (5.9×: 58.8 s of story in 10 s);
  - **Dissolves:** the same clips with 0.6 s cross-dissolves, rendered by drawing the incoming clip into a render target and laying it over the outgoing one.

## Comedy Timing exercise

Bram struts across the square and slips on a banana peel. The edit is generated from four gaps: **setup** (strut), **anticipation** (a peel insert *before* the step, so the audience knows first), **hold** (frozen mid-slip, staring into the lens) and **aftermath** (stillness before a tiny embarrassed reaction). There are four presets:

- **Instant slip** (step → fall 0.85 s);
- **Long anticipation** (2.2 s of the peel before the step);
- **Reaction hold** (2.4 s stare);
- **Delayed aftermath** (2.4 s of stillness).

The beat times (step, fall, reaction) are exposed and tested.

The rig takes the skid (root motion, a leg kicked up, arms flung out) and the seated landing (root lowered, thighs forward). A convincing pratfall in between is beyond it, so **the fall happens on a cut-away**: the peel spins through frame while we hear the slide whistle, the thud and a bonk. That is the classic editing answer as well as a workaround, and the panel says so.

## Sound

Sound is procedural WebAudio (`audio/synth.ts`), with no assets:

- the box's hum, which follows `boxGlow` at the *audio* edit's source time;
- a tension drone that rises toward the reveal and releases after it;
- footsteps, creaks, gasps and breaths (filtered noise);
- a sting (bell chord plus shimmer and a low boom), a thud, a slide whistle up and down, a bonk, moth shimmers and lamp ignitions.

Events belong to reels at source times. `audibleEvents` maps them through the audio edit, so J/L cuts change what you hear and when.

Sound never autoplays. The AudioContext is created on the first user gesture, and the header toggle mutes it. Sound suspends when the tab is hidden.

## Modes and links

- **Watch (`W`):** the current edit full frame, preset tabs, a compact timeline and the headline.
- **Inspect (`I`):** the program monitor, the camera plan with the line, the full timeline (picture, knows, sound), the shot-length graph (with the four treatments' ASL for scale) and a chronological "what the audience knows, when" card.
- **Experiment (`E`):** the playground and the seven concept panels.
- **Deep links:** `?mode=watch|inspect|experiment`, `?preset=suspense|comedy|action|emotion`, `?exp=timeline|pacing|kuleshov|reaction|continuity|jl|montage|comedy` and `?compare=<preset>`. The address bar follows the state.
- **Keys:** `Space` play/pause, `W` / `I` / `E`, `Z` undo, `Home` restart, `Alt+←/→` move the focused clip.

## Exports

- **TrueStudio cut list (`.cutlist.json`, `format: "truestudio.cutlist"`, v1).** For each clip it records:
  - shot id, number, size, tape and camera (position, target, lens);
  - reel, source in/out (seconds and timecode) and record in/out (from 01:00:00:00);
  - frames and handles;
  - the audio relation (`straight`, `J` or `L`, with offset and audio record range) and the transition.
  The explanation travels in `notes`. `validateCutList` checks contiguity, durations and reel bounds before download.
- **EDL (`.edl`, CMX3600-style, 24 fps NDF).**
  - One `B` event per straight cut.
  - Split edits become a `V` event plus an `A` event with its own record range and a `* SPLIT EDIT … (J-CUT)` comment.
  - Dissolves use the two-line C → `D 014` form.
  - Tapes are `CAM1`–`CAM6` and the plate names.
  Timecodes are frame-exact (source out = source in + record length in frames). `validateEdl` parses every event.
- **Seedance prompt.** A multi-shot prompt that spells out the rhythm. The header gives runtime, shot count, treatment, tempo word, ASL and information order. Each shot gets a line with its timing, framing and the actions inside its source range, plus the transition (hard cut, cut on movement, J/L, dissolve). Example: "Shot 3 (6.5–10.0 s): hold on close-up of Bram's face 3.5 s before the reveal: Bram's face fills with worry, he raises a hand: wait. Cut on movement."

## Architecture

| Path | What it holds |
| --- | --- |
| `engine/` | Pure TypeScript, Vitest-tested. `types`, `source` (reels, beats, glow and lid curves, movement windows), `marks`, `shots` (cameras), `edit` (model and stats), `presets`, `explain`, `audio` (SFX map, J/L segments), `experiments` (Kuleshov, reactions, continuity, J/L, montage, comedy) and `exports`. |
| `performance/` | DSL clips for both characters, per reel, lifted into master source time (`inReel`) and validated as one closed performance. |
| `stage/` | `EditSet` (the doorway set from shared pieces, door shut, standing lantern struck where needed), `Cast` (rigs driven by the master clips) and `Props` (crate, glowing box with hinged lid and light shaft, moths, gift, fallen lantern, banana peel, street lamps, dusk light). |
| `runtime/Orchestrator.tsx` | The lab's single positive-priority `useFrame`. For each visible monitor (P, W, A, B) it finds the frame of that monitor's edit, runs the frame bus at that clip's source time, aims the shot camera and scissor-renders. Dissolves use one render target plus an overlay quad. |
| `store.ts` | zustand state; the playground keeps history for undo. |

Test hooks: the lab root carries `data-mode`, `data-exp`, `data-preset`, `data-selected`, `data-selected-shot`, `data-runtime`, `data-cuts`, `data-asl`, `data-order`, `data-info-order`, `data-compare`, `data-jl`, `data-flipped`, `data-montage`, `data-compression`, `data-comedy-step`, `data-comedy-fall`, `data-comedy-reaction`, `data-sound` and `data-program-shot`. Under `?e2e=1`, `window.__editLab` exposes `getState`, `edit`, `seek`, `play`, `pause`, `explanation`, `live`, `frames`, `audible` and `sound`.

## Tests

- **Vitest:**
  - `engine/edit.test.ts`: the model, trims within handles, stats, split clamping, dissolves, preset structure.
  - `engine/explain.test.ts`: information order, each preset reads as itself, the headline rules.
  - `engine/experiments.test.ts`: Kuleshov identical frames, reaction order, eyelines and the crossed line, J/L, montage ratios, comedy gaps.
  - `engine/exports.test.ts`: timecode, cut-list validity, the EDL (including split and dissolve events), the prompt.
  - `performance/performance.test.ts`.
- **Playwright:** `e2e/34-editing-rhythm.spec.ts` (11 tests). Run it against a dev server with `BASE_URL=http://localhost:3123 pnpm exec playwright test e2e/34-editing-rhythm.spec.ts --project chromium`.
- **Screenshots:** `docs/screenshots/editing-rhythm/`, regenerated with `node scripts/editing-rhythm/shots.mjs`.

## Known limits

- The explanation layer is a set of hand-written rules over this one scene's beats. It knows what the box, Bram's face and the lid are doing at every source second, but it does not watch the pixels, and it won't generalise to arbitrary footage without new beat data.
- The reaction-shot facts count only shots whose subject is Bram's face. Bram's startle seen in the reveal wide does not count as a reaction shot.
- Sound is synthesised, not recorded. There is no dialogue, so J/L cuts are demonstrated with effects and breaths, not speech overlap. The drone is a simple score bed, the same for every edit.
- Bram's pratfall is staged as a cut-away because the rig can't take a convincing fall. The seated pose is an approximation (legs straight, coat clipping is possible at some angles).
- The Kuleshov answers are self-report. The "usual readings" are the classic result, not measured data.
- The montage's dusk is a light ramp on the set. The painted backdrop sky does not change.
- The reach shot keeps Bram's torso soft in the background, and the fallen lantern is a simple stand-in prop.
- Compare mode plays both edits from one clock. The shorter one holds its last frame (marked END) until the longer finishes.
