/** Pass list, view ids and teaching copy. */

export type PassId = 'beauty' | 'albedo' | 'diffuse' | 'shadow' | 'specular' | 'emission' | 'ao' | 'depth' | 'normals' | 'id' | 'rebuild' | 'difference';
export type ViewId = PassId | 'sheet';

export interface PassInfo { id: PassId; label: string; short: string; what: string; use: string }

/** Order = the contact sheet, left to right, top to bottom. */
export const PASSES: readonly PassInfo[] = [
  { id: 'beauty', label: 'Beauty', short: 'Beauty', what: 'The finished render: every light, shadow and surface in one image.', use: 'The reference. Everything below adds back up to it.' },
  { id: 'albedo', label: 'Albedo', short: 'Albedo', what: 'Surface colour only, with no light at all. Flat paint.', use: 'Recolour a costume or a wall without touching its lighting.' },
  { id: 'diffuse', label: 'Diffuse light', short: 'Diffuse', what: 'Light arriving at each surface as if everything were white, before shadows.', use: 'Relight: brighten, dim or tint the light without re-rendering.' },
  { id: 'shadow', label: 'Shadow', short: 'Shadow', what: 'Where the key light is blocked: 1 in light, darker in shadow.', use: 'Colour or soften shadows on their own.' },
  { id: 'specular', label: 'Specular', short: 'Spec', what: 'Highlights and reflections off glossy surfaces: brass, boots, eyes.', use: 'Tame or boost shine. It sits on top, so it is added, not multiplied.' },
  { id: 'emission', label: 'Emission', short: 'Emit', what: 'Light the surface gives off itself: the lamps, the lit windows, the painted sky.', use: 'Make practicals glow brighter or dimmer.' },
  { id: 'ao', label: 'Ambient occlusion', short: 'AO', what: 'How enclosed each point is: creases, contact and corners go dark.', use: 'A utility pass. The beauty has none, so add it to ground the characters.' },
  { id: 'depth', label: 'Depth (Z)', short: 'Depth', what: 'Distance from the lens for every pixel. Near is light here, far is dark.', use: 'Haze, depth of field and atmosphere that start at a distance.' },
  { id: 'normals', label: 'Normals', short: 'Normals', what: 'Which way each surface faces, as colour (camera space).', use: 'Relight in comp, rim light, or select surfaces facing one way.' },
  { id: 'id', label: 'ID matte', short: 'ID', what: 'Every object flat-coloured by group: characters red, set green, sky blue.', use: 'Isolate a grade to one object, with soft edges.' },
  { id: 'rebuild', label: 'Rebuild', short: 'Rebuild', what: 'The passes put back together by the comp: albedo × (light × shadow × AO) + specular + emission.', use: 'Where every creative change happens.' },
  { id: 'difference', label: 'Difference', short: 'Diff', what: 'Rebuild minus render, magnified ×8. Black means they match.', use: 'The check that the passes add up.' },
];
export const passInfo = (id: PassId) => PASSES.find((p) => p.id === id)!;

/** Index sent to the composite shader. */
export const VIEW_INDEX: Record<ViewId, number> = {
  rebuild: 0, beauty: 1, albedo: 2, diffuse: 3, shadow: 4, specular: 5, emission: 6, ao: 7, depth: 8, normals: 9, id: 10, difference: 11, sheet: 12,
};
/** Contact-sheet cell → view index (4 × 3, top-left first). */
export const SHEET: readonly PassId[] = PASSES.map((p) => p.id);

export const SWATCHES = {
  shadow: [
    { id: 'night', label: 'Night blue', c: [0.05, 0.11, 0.32] as [number, number, number] },
    { id: 'violet', label: 'Violet', c: [0.16, 0.08, 0.3] as [number, number, number] },
    { id: 'umber', label: 'Warm umber', c: [0.22, 0.12, 0.06] as [number, number, number] },
  ],
  haze: [
    { id: 'night', label: 'Night haze', c: [0.16, 0.2, 0.3] as [number, number, number] },
    { id: 'smoke', label: 'Smoke', c: [0.22, 0.21, 0.2] as [number, number, number] },
    { id: 'dusk', label: 'Dusk', c: [0.42, 0.25, 0.18] as [number, number, number] },
  ],
};

export const BREAKS = [
  { id: 'none', label: 'Correct comp', note: 'Every pass combined the way it was rendered.' },
  { id: 'add', label: 'Add, not multiply', note: 'Light was added to albedo instead of multiplying it. Light scales colour; adding washes everything out.' },
  { id: 'aoAll', label: 'AO on everything', note: 'AO darkened the specular and the lamps too. Occlusion only blocks bounced, ambient light, so it belongs on the diffuse term.' },
  { id: 'flatFog', label: 'Haze without depth', note: 'A flat fog greys the characters as much as the clock tower. Atmosphere needs the depth pass to know what is far.' },
  { id: 'depthKey', label: 'Depth instead of a matte', note: 'The characters’ grade was keyed by distance, so the floor and the lantern at the same depth got it too. An ID matte selects objects, not distances.' },
  { id: 'hardMatte', label: 'Matte without coverage', note: 'A yes/no matte has no soft edge pixels, so the grade stops in a stair-stepped line. Real mattes store how much of each pixel an object covers, like alpha.' },
  { id: 'display', label: 'Comp in display space', note: 'The passes were multiplied after gamma encoding. Light only adds and multiplies correctly in linear light, so mid-tones go muddy.' },
] as const;

export const WHY = [
  { n: '01', title: 'Fix it in comp', text: 'A feature film frame can take hours to render. A comp change takes milliseconds, so the lighting team renders passes once and the look is finished in comp.' },
  { n: '02', title: 'AOV means arbitrary output variable', text: 'Anything the renderer computes per pixel can be saved: light per source, shadows, depth, normals, IDs, motion vectors. Each one is a decision you can still change later.' },
  { n: '03', title: 'Comp in linear light', text: 'Passes are stored as linear light (EXR files in production). Multiply and add there, and only then turn the result into display colour. Doing it in display space breaks the maths.' },
  { n: '04', title: 'Depth and mattes are for later decisions', text: 'Nobody knows in lighting exactly how much haze the final shot needs. With a depth pass and ID mattes, that can be decided in review, shot by shot.' },
];

export const VOCABULARY: readonly (readonly [string, string])[] = [
  ['AOV', 'Arbitrary output variable: any extra per-pixel image the renderer writes besides the beauty.'],
  ['Beauty', 'The full render. The passes are the beauty taken apart.'],
  ['Albedo', 'Surface colour without lighting. Also called diffuse colour or diffuse filter.'],
  ['Linear light', 'Pixel values proportional to light energy, so they add and multiply correctly.'],
  ['Z depth', 'Distance from the camera per pixel. Drives haze, defocus and depth mattes.'],
  ['ID matte / Cryptomatte', 'Masks per object or material, with soft coverage at edges, for isolated grades.'],
  ['Premultiplied', 'Colour already multiplied by coverage, so edges blend cleanly when layered.'],
  ['Rebuild', 'Recombining passes to reproduce the beauty: the check that nothing is missing.'],
];
