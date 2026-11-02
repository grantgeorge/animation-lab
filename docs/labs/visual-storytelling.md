# Visual storytelling: three connected labs

The story is an original five-beat illustrated study: Pip returns a lost lantern to Bram. Shared vector artwork keeps the cast, setting and props consistent. These are instructional illustrations, not final animation or a physically lit renderer.

## Research and teaching decisions

- [NYFA: The five stages of blocking a scene](https://www.nyfa.edu/film-school-blog/the-5-stages-of-blocking-a-scene/) describes blocking as coordinating actor movement with camera placement. The blocking lab links floor marks to a projected camera view, with a silhouette test and a repeatable six-second gesture.
- [Toon Boom: About timing](https://docs.toonboom.com/help/storyboard-pro-25/storyboard/timing/about-timing.html) explains timing panels and scenes to establish an animatic's pace. Five editable 15-second presets vary order and holds; custom edits display their actual total. The story reel is silent.
- [Pixar: Toy Story 2](https://www.pixar.com/toy-story-2) describes color scripts as sequences of small color studies establishing the film's visual tone. The color lab paints each of five beats independently, with a fixed reference, grayscale comparison and a sequence-wide palette option. Mood names describe possible readings in this scene, not universal psychological rules.

Each lab includes three interactive lessons: set up a deliberate experiment, manipulate its controls, and reveal an observation. Direction text reflects the actual current settings and can be copied. Navigation connects the three studies.

## Routes

- `/labs/staging-and-blocking`: superseded by the shared-cast 3D revision. See [Staging & Blocking](staging-and-blocking.md) for the real camera, studio inspector, draggable marks and silhouettes.
- `/labs/storyboards-animatics`: five shot crops, selectable panels, earlier/later moves, half-second duration adjustments, proportional timeline, playback and scrubbing. Edits remain in memory for the current visit.
- `/labs/color-scripting`: environment hue, saturation, light and dark-accent contrast for each beat. Costume colors remain constant. This is palette design, not a physically based lighting simulation.

No new dependencies or external inference calls. The 3D blocking revision uses one WebGL canvas; the other two studies use SVG. Playback starts on demand and pauses when the document is hidden.

## Verification

Unit tests cover edit budgets and boundaries, reorder preservation, projection behavior and independent color beats. Browser tests are in `e2e/23-storytelling.spec.ts`. Run `node scripts/shots-storytelling.mjs` against the dev server to capture each desktop, lesson and mobile state.

A static SVG contact sheet is stored in `docs/screenshots/storytelling/scene-contact-sheet.png`. Full browser captures at 1440×900, 1280×800 and 390×844 are in `docs/screenshots/storytelling-refined/`, including desktop and phone color comparisons. The focused suite exercises blocking, reordering, playback, palette edits, filmstrip selection, field-guide focus restoration, frame proportions and phone overflow.

The shared workspace uses a compact neutral header, a native Field guide dialog and a 16:9 picture beside the inspector. Animatics and Color keep their editable filmstrips directly below the picture; the desktop image fits the viewport height so the strip stays visible. Phone strips scroll horizontally within the page, with the inspector before the longer reading. Color comparisons retain full 16:9 compositions, side by side on desktop and stacked on phone. Guided-experiment setup scrolls back to the picture so its change is visible.
