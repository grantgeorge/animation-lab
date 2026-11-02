// Creative prompts for the Animation History media, compiled per endpoint.
// Canonical mapping comes from the Lens & Framing lab: lead = Bram, companion = Pip,
// set = lamplit street doorway, editable target = Bram's scarf.

export const CAST = {
  bram: "Bram, a tall, sturdy lamplighter with a charcoal flat cap, brown hair, a big round nose, rosy cheeks, a thick curled handlebar moustache, a long deep-red wool coat with brass buttons and flap pockets over a dark sweater, a long cream knitted scarf with fringed ends wrapped around his neck with one end hanging down his chest, and dark trousers",
  pip: "Pip, a small child about half Bram's height with auburn hair, wearing a yellow sou'wester rain hat, a yellow duffle raincoat with dark toggles, black trousers and teal rain boots",
  set: "a night street: a warm plaster wall with an arched doorway and a green door, a glowing wall lamp above the door, a dark red brick wall on the left, a black iron street lantern in the right foreground, and a clock tower against the dark blue night sky behind",
};

const PRESERVE = `Keep exactly the same camera, framing, composition and character positions as the first image.
The characters are ${CAST.bram}; and ${CAST.pip}.
Preserve their silhouettes, proportions, relative heights, costumes, poses and expressions.
Bram stands in the middle facing us; Pip stands just outside the arched doorway to the right of him.
Keep the setting: ${CAST.set}.
Do not add characters, props, text, captions, logos, borders or watermarks.`;

/** Per-era visual treatment. These describe appearances only; the mechanisms are taught by the authored demos. */
export const ERA_STYLES = {
  drawings: `Redraw this shot as a 1930s hand-drawn animation pencil test on a single sheet of warm off-white animation paper.
Soft graphite linework with confident, expressive contours over faint light-blue construction lines and loose circles.
The characters are fully drawn; the background is indicated with lighter, simpler layout lines.
Monochrome only: graphite and faint blue pencil on paper. Keep the characters readable through silhouette and values:
Bram's coat is shaded darker with graphite, Pip's raincoat lighter, and Bram's knitted scarf is left as clean white paper with a few knit lines.
Three small round registration peg holes along the bottom edge of the paper. No scratches, dirt, sepia or film grain.`,
  multiplane: `Repaint this shot in the style of a lavish late-1930s painted-cel animated feature.
The characters are painted cels: carefully inked contour lines with flat opaque gouache-like color and one soft shadow tone.
The environment is a rich watercolor and gouache background painting with soft edges and atmospheric depth:
the iron lantern in the foreground painted darker and crisper, the wall and doorway in the middle distance,
the clock tower and the night sky softer, bluer and hazier in the far distance. Warm glowing lamplight.
No film grain, scratches or sepia.`,
  television: `Redesign this shot as a 1960s limited-animation television cartoon.
Bold uniform black outlines, flat unshaded color fills, simplified geometric character shapes and strong silhouettes.
A stylized flat background built from simple graphic shapes and a limited palette with a few dry-brush texture marks.
Clean and graphic. No film grain, scratches or sepia.`,
  "digital-2d": `Repaint this shot as a lush early-1990s hand-drawn animated feature finished with digital ink and paint.
Characters: fine, clean, self-colored ink lines (dark red lines on the red coat, dark gold lines on the yellow raincoat), crisp flat digital colors with
a precise cel shadow tone and a small highlight tone on each form, expressive hand-drawn faces.
Background: a richly detailed painted background with visible brushwork on the brick and plaster, soft airbrushed gradients in the night sky,
a warm painted pool of lamplight on the wall, and a soft digital glow around the lamps. The look of clean hand-drawn characters composited over a painted set.`,
  cg: `Re-render this shot as if it were a mid-1990s computer-animated feature made on 1995 hardware.
Simplified low-polygon forms with slightly faceted edges on rounded shapes, smooth untextured plastic surfaces with bright hot specular highlights,
hair and moustache as solid sculpted shapes, no fabric or knit texture (the scarf is a smooth cream tube with simple fringe), hard-edged dark shadows,
flat ambient light with no bounce light, simple flat-colored walls. Everything looks like carefully modeled toys.`,
  simulation: `Re-render this shot as a contemporary stylized computer-animated feature.
Soft global illumination with warm lamplight bouncing off the plaster wall onto the characters' faces,
gentle subsurface scattering on skin, a visible fabric weave on the coat, the cream knitted scarf with visible yarn texture and fringe,
soft contact shadows on the ground and a little atmospheric haze around the lamps. Appealing, polished character shapes.`,
  stylization: `Re-render this shot as a boldly illustrated computer-animated film inspired by printed comic books and painted storybooks.
Thick hand-drawn black ink contour lines and interior ink lines on both characters, bold halftone dot shading in every shadow,
flat graphic color blocks, a strong teal rim light along the left edges against warm orange lamplight, visible painterly brush strokes in the background,
and slightly offset printed-color edges like a comic page. Simplified, designed shapes.`,
};

export function eraStillPrompt(era) {
  return `${ERA_STYLES[era]}\n\n${PRESERVE}\n\nThe second image shows Bram up close and the third image shows Pip up close, for identity only.`;
}

/**
 * Image-to-video motion prompt (Seedance 2.5 image-to-video). The start frame carries the look and identity,
 * so the prompt spends its words on the four action beats and the fixed camera.
 */
export function eraClipPrompt(styleWords) {
  return `${styleWords} One continuous six-second shot with a completely fixed camera: no zoom, pan or cuts.
0-1s: Bram, the tall lamplighter in the red coat, stands still by the glowing doorway; Pip, the small child in the yellow raincoat, has just stepped out beside the door.
1-2s: Bram hears something and his eyes and head turn toward Pip.
2-4s: Bram turns his body toward Pip and waves back, raising his right hand in front of him; Pip waves eagerly with one arm out to the side.
4-6s: Pip gives a small happy hop and both settle into warm, delighted expressions. Bram's scarf end sways slightly with his turn and settles; it stays wrapped around his neck.
Keep the same art style, character designs, proportions and background throughout. Clear anticipation, readable silhouettes.
No new characters, no text, no dialogue, no music.`;
}

/** Short style words reused inside the motion prompt so the model keeps the treatment while animating. */
export const ERA_CLIP_STYLE = {
  drawings: "A 1930s graphite pencil-test animation. The whole shot stays a monochrome pencil drawing on warm off-white paper from the first frame to the last: grey graphite lines and light blue construction lines only, never any color, paint or fill. The drawings change on every second frame; the paper and the background drawing stay still.",
  multiplane: "A late-1930s painted-cel animated film: inked, flat-painted characters over a watercolor background painting.",
  television: "A 1960s limited-animation TV cartoon: flat colors and bold outlines, mostly held poses with only the parts that need to move animating.",
  "digital-2d": "An early-1990s hand-drawn animated feature with digital ink and paint.",
  cg: "A mid-1990s early computer-animated feature with simple plastic-like materials and hard shadows.",
  simulation: "A contemporary stylized computer-animated feature with soft bounced lamplight and a soft knitted scarf.",
  stylization: "An illustrated comic-book-style computer-animated film with ink lines, halftone shading and stepped, punchy poses.",
};
