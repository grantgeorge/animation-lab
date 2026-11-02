# Painterly Textures

Route: `/labs/painterly-textures` · code: `src/labs/painterly-textures/` · tests: `src/labs/painterly-textures/engine/engine.test.ts`, `e2e/31-painterly-textures.spec.ts` · screenshots: `docs/screenshots/painterly-textures/`.

## What it teaches

Painterly animation looks hand-painted because the paint is part of the world: strokes and colour patches live on the character and the set, light is reduced to a few painted values, backgrounds are matte paintings, and effects are painted cards. Film grain and painting filters are different. They sit on the screen.

That difference decides whether the result holds up in motion. When Bram turns his head, strokes that are mapped onto his surface turn with his face. Strokes that live on the screen swim across it (the shower-door effect). Strokes that are re-invented every frame boil, which is what naive per-frame stylisation and a lot of AI video do.

For AI video (TrueStudio / Seedance), the lab turns this into two separate controls:

- **Art style (generation):** decides how every surface is rendered. It goes in the generation prompt, for example "hand-painted character textures with visible gouache brushwork, graphic shadow shapes in three painted values, cool blue shadows against warm light, matte-painted background… brushstrokes stay fixed to surfaces".
- **Finishing (post):** paper texture, grain, halation and grade, applied after generation.

The prompt panel writes both from the current layers and parameters (`engine/prompt.ts`). It also carries a short note on temporal consistency: what tends to crawl, why to ask for surface-bound textures, why to avoid frame-by-frame style transfer, and why to keep camera moves modest.

## Layout and modes

Two sections, each with Watch / Inspect / Experiment (W / I / E; T switches section):

| | Build the look | Stick or crawl |
|---|---|---|
| **Watch** | Full painted shot (Workshop, 35 mm) with a drag wipe to clean 3D, the key distinction, the five techniques and the prompts | The four test versions side by side, each with a crawl bar (smoothed mean and peak) and sparkline, and a per-film-frame crawl chart |
| **Inspect** | Orbitable 3D breakdown plus the final shot as a picture-in-picture. Tabs: texture swatch and unlit turntable, ramp curve, projector frustum with the matte, exploded overlay cards, compositing stack | The surface-coordinate pass and each version's frame-to-frame change map, plus how the metric works |
| **Experiment** | Wipe (starts at 50%), paint character / environment independently, stroke size, stroke direction, value bands, shadow hue, paper, and swinging the camera off the projector with a live stretch readout | Head turn or camera orbit, boil timing (ones, twos or threes), stroke size, frame stepping |

The build-up strip is the take-apart: click a number to stack up to that technique (0 = clean 3D), or tick a box to toggle a single layer. Keys 0–5 do the same.

Deep links: `?mode=watch|inspect|experiment`, `?layer=clean|texture|shading|projection|overlays|composite` (build up to it; in Inspect it also opens that breakdown), `?test=surface|screen|random|boil` (opens the test with that version highlighted). The address bar is kept in sync. `?freeze=<s>`, `?nomotion=1` and `?quality=high|low` behave as in the other labs.

## The five techniques

Everything is one material per mesh: a **clone** of the shared material, patched in `onBeforeCompile` (`render/paintMaterial.ts`, GLSL in `render/glsl.ts`). With `ptPaint = 0` it is the untouched PBR path. That's how the clean and painted passes of the same frame share every program, and the character and environment have their own uniform groups so they can be painted independently. Shared GLTF and set materials are never modified. The cast's own per-instance materials are swapped for painted clones by a traversal in `stage/World.tsx`.

1. **Hand-painted texture maps (surface).** Painted dabs live in each object's rest space (the bind pose for the skinned cast), so skinning carries them. One jittered dab per 3D cell is an ellipsoid two cells long, laid along the tangent that wraps around the form and rotated by the stroke-direction slider. The top-most covering dab wins, like overlapping paint. Each dab has a value, a warm or cool hue id and a break mask, and its bristles come from a procedural brush tile. Terraced value noise adds colour blocks, and the character's fine texture and normal detail are softened so the strokes read. Inspect shows a flattened 30 cm patch of the coat and a 1.2 m patch of plaster, rendered live by the same shader, and an unlit turntable of Bram.
2. **Painterly shading (surface).** Irradiance becomes a light amount `x = L / (L + mid)`, which is nudged by a brush mask in surface space and banded into 2–4 flat values (`engine/ramp.ts`, mirrored by `ptRamp`). Shadows take a cool tint that keeps some local colour; light takes the warm key colour. Specular becomes a painted dab on glossy surfaces only, and on the character the rim is one painted stroke on the side the rim lamp comes from. Metals are banded from what they reflect.
3. **Matte painting / projection (world).** `scripts/painterly/capture-plate.mjs` renders the clean, empty set from the shot camera. `scripts/painterly/paint-matte.mjs` asks an image-edit model for a pixel-aligned gouache repaint (`public/labs/painterly-textures/matte.jpg`). The environment shader projects it back through the shot camera's view-projection, undoing the display tone curve with a small LUT so the composite returns the painted values. Props that move (the hatch lid) are detected and left out. Inspect shows the projector frustum, the painting hung in it, and the swung camera's frustum.
4. **2D overlays (world).** Painted cards (`stage/Overlays.tsx`, textures drawn procedurally in `render/textures.ts`): a moonlight shaft, two rising smoke wisps, three glints and two scratch cards. They exist only in the painted pass. The exploded view slides each card toward the observer and outlines it.
5. **Compositing (screen).** The final pass (`render/post.ts`) applies ACES, a unifying split-tone grade, gentle halation, painted silhouette edges from depth, an indigo black lift, paper tooth and a rough vignette. This is the only screen-space layer, and it's meant to stay still on screen. The Grading & Finishing lab's "Arcane-inspired painterly" preset is the screen-space contrast to this lab.

## The consistency test and its metric

Bram plays a 6 s head turn (`stage/clips.ts`) under a static portrait camera, or holds still while the camera orbits him. Four versions:

| Version | What it is |
|---|---|
| Surface-attached | The painted materials. Strokes are a function of rest-space position |
| Screen-space filter | The clean render through a Kuwahara filter, plus the *same* dab function evaluated in pixel coordinates |
| Per-frame random | The same filter, re-seeded on every 24 fps frame (naive per-frame stylisation, AI flicker) |
| Intentional boil | The surface version with three slightly offset paintings held on twos (or ones/threes) and cycled |

**Crawl** (`engine/crawl.ts`) is measured from rendered frames. Each 24 fps film frame is rendered off-screen at 150 × 200:

- once as a surface-coordinate pass (RGB = the 1.2 cm rest-space cell under each pixel; Bram only, via a dedicated layer and a skinned override material);
- once clean;
- once per version. The surface and boil versions are measured on the texture layer (shading off), because banded light legitimately moves over the face as it turns.

For each surface cell visible in two consecutive frames, the metric compares the mean of the residual (stylised − clean), so lighting that moves across the face cancels out. Crawl is the mean absolute change, as a percentage of full brightness. While playing, each film frame is captured once at its exact time and scored against the previous one, so the history is one point per film frame and boil shows its beat. Typical values mid-turn: surface ≈ 0.4%, screen ≈ 2–3%, per-frame random ≈ 3.5%, boil ≈ 0.7% as a regular zigzag. During a hold, screen drops to 0 while random keeps boiling: crawl needs motion, boiling doesn't.

The test hook's `crawl()` measures three frame pairs ending at the current time. The e2e spec asserts surface < screen < random at two moments of the turn, and screen ≈ 0 < random during the hold.

**Projection stretch** (`engine/projection.ts`) is the mean anisotropy σ₁/σ₂ of the matte-pixel → screen-pixel Jacobian (`J_view · J_proj⁻¹`) over 14 sample points on the set seen by both cameras. It is exactly 1.00 from the projector and grows as the camera swings away (≈1.2 at 5°, ≈1.45 at 10°, ≈2.1 at 20°, ≈3 at 32°).

## Test hook (`?e2e=1`)

`window.__painterlyLab`: `getState()` (store plus `t`, `frames` and `stretch`), `set(patch)`, `seek(t)`, `play()`, `pause()`, `frames(n)`, `crawl()`, `crawlLive()`, `lastMeasure()` (raw change and cell counts), `stretch()`, and `plate()` (the matte painter's plate as a PNG data URL). The lab root carries `data-section`, `data-mode`, `data-layers`, `data-focus`, `data-test`, `data-paint-char`, `data-paint-env` and `data-playing`.

## Approximate, and known limits

- Strokes are procedural 3D dabs in rest space, not hand-painted UV maps. They're attached and seamless, but their direction comes from a tangent rule (around the form, rotated by one angle), not an artist's hand. On thin parts the dab cross-section can read as spots.
- The skinned cast deforms the dab field with the mesh (like a painted UV texture stretches). Face morphs don't move the rest coordinate, so the mouth area slides slightly under its strokes.
- Painterly shading is driven by three's summed diffuse irradiance, so all lights share one ramp. Real productions often ramp key and fill separately.
- The matte was painted once from the shot camera and is projected without an occlusion test. Hidden surfaces take the paint of whatever is in front of them when you swing away. This is shown deliberately, but production would split projections by depth and paint extra coverage. The red ball on the stool and the trapdoor's dark opening aren't in the painting.
- The screen-space filter is a basic 4-sector Kuwahara plus screen-fixed dabs, a stand-in for painterly post and style transfer, not a specific product.
- The crawl metric uses mean change per 1.2 cm cell. It isn't optical flow, and very fine stroke detail inside a cell averages out. The surface version keeps a small floor (≈0.3–0.5%) from rasterisation and silhouette cells. Values depend on stroke size and contrast, so compare versions against each other rather than as absolutes.
- The texture-swatch and test views render the real shaders, but the swatch uses a flat patch, so the dab tangent rule shows its default horizontal direction.
- Assets: one `openai/gpt-image-2.5/sunburst/edit` call (two variants, ~$0.09) produced the matte. All other textures (brush tile, paper, cards) are drawn procedurally at load with seeded randomness.
