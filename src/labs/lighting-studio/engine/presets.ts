import type { ChannelId, ChannelMask, LightParams, Rig } from "./types";

export type PresetId = "three-point" | "flat" | "storybook" | "dramatic" | "noir" | "sunset";

export interface Preset {
  id: PresetId;
  /** Keyboard number (0 = the neutral starting rig). */
  key: string;
  name: string;
  short: string;
  /** Why it works / where you've seen it. */
  note: string;
  /** Leading phrase for the AI-video prompt when the look is unmodified. */
  promptLead: string;
  /** What each channel does in this look (take-apart copy). */
  roles: Record<ChannelId, string>;
  /** Two colours for the preset card swatch. */
  swatch: [string, string];
  rig: Rig;
}

const light = (p: Partial<LightParams> & Pick<LightParams, "azimuthDeg" | "elevationDeg" | "intensity" | "kelvin">): LightParams => ({
  on: true,
  distanceM: 3,
  softness: 0.4,
  spreadDeg: 36,
  shadows: true,
  gobo: 0,
  ...p,
});

export const PRESETS: readonly Preset[] = [
  {
    id: "three-point",
    key: "0",
    name: "Three-point",
    short: "Studio starting rig",
    note: "The textbook starting point: a key to model the face, a fill to open the shadows, a rim to lift the silhouette off the background. Every look below is a variation on it.",
    promptLead: "classic three-point studio lighting",
    roles: {
      key: "The main light. It decides where the shadows fall and gives the face its shape.",
      fill: "A dimmer, softer light from the other side that controls how dark the shadows get.",
      rim: "From behind, it draws a bright edge on the head and shoulders so he separates from the dark set.",
      ambient: "A little bounce from the room so nothing goes completely black.",
    },
    swatch: ["#3A4150", "#14171D"],
    rig: {
      lights: {
        key: light({ azimuthDeg: -40, elevationDeg: 30, distanceM: 3, intensity: 28, kelvin: 4800, softness: 0.4, spreadDeg: 36 }),
        fill: light({ azimuthDeg: 55, elevationDeg: 8, distanceM: 3.2, intensity: 11, kelvin: 5600, softness: 0.85, spreadDeg: 48, shadows: false }),
        rim: light({ azimuthDeg: 140, elevationDeg: 32, distanceM: 3, intensity: 60, kelvin: 6500, softness: 0.25, spreadDeg: 30 }),
      },
      env: {
        ambient: 0.12,
        skyColor: "#3A4560",
        groundColor: "#1A1612",
        cycColor: "#5A6170",
        glowColor: "#3A4558",
        glowTopColor: "#0E1117",
        glowStrength: 0.3,
        voidColor: "#07090E",
        saturation: 1,
        exposure: 1,
      },
    },
  },
  {
    id: "flat",
    key: "1",
    name: "Flat cartoon",
    short: "High-key, shadowless",
    note: "Big soft light from beside the camera plus an almost equal fill: about 1.2:1 with cast shadows off, so shadows barely exist and colour reads first. It keeps every frame clear and cheerful, which is why so much TV animation for young kids looks like this.",
    promptLead: "flat high-key children's animation lighting",
    roles: {
      key: "A huge soft source just left of the camera: it lights the whole face evenly from the front.",
      fill: "Nearly as strong as the key, from the other side of the camera, so there is almost no shadow side at all.",
      rim: "A gentle edge that keeps the outline crisp against the bright wall without drawing attention.",
      ambient: "Lots of bright bounce and a saturated sky-blue backdrop: the 'sunny day' colour that does most of the storytelling.",
    },
    swatch: ["#7FD3FF", "#FFE07A"],
    rig: {
      lights: {
        key: light({ azimuthDeg: -10, elevationDeg: 14, distanceM: 3.2, intensity: 26, kelvin: 5600, softness: 1, spreadDeg: 64, shadows: false }),
        fill: light({ azimuthDeg: 16, elevationDeg: 6, distanceM: 3, intensity: 23, kelvin: 5800, softness: 1, spreadDeg: 64, shadows: false }),
        rim: light({ azimuthDeg: 168, elevationDeg: 40, distanceM: 3, intensity: 5, kelvin: 6500, softness: 0.7, spreadDeg: 40 }),
      },
      env: {
        ambient: 1.55,
        skyColor: "#E4F3FF",
        groundColor: "#FFF4DC",
        cycColor: "#4FB4F0",
        glowColor: "#8ED8FF",
        glowTopColor: "#3FA6F0",
        glowStrength: 0.55,
        voidColor: "#4FA8E0",
        saturation: 1.4,
        exposure: 1.12,
      },
    },
  },
  {
    id: "storybook",
    key: "2",
    name: "Storybook",
    short: "Soft, warm, 3:1",
    note: "A warm, soft key from three-quarters with a warm bounce fill gives gentle, rounded modelling at about 3:1, and a faint cool rim stops it going muddy. It feels like a lamp-lit picture book: cosy, safe and nostalgic, the default for warm family features.",
    promptLead: "soft warm storybook lighting",
    roles: {
      key: "Soft and warm (about 3000 K), three-quarters from camera left and above, like a big window at golden hour.",
      fill: "Warm bounce from camera right: it keeps the shadow side honey-coloured instead of grey.",
      rim: "A gentle cool edge. The warm/cool contrast is subtle but keeps him from melting into the wall.",
      ambient: "Warm room bounce and a soft glow on the wall behind, like lamplight in the distance.",
    },
    swatch: ["#E9A866", "#5B3A26"],
    rig: {
      lights: {
        key: light({ azimuthDeg: -46, elevationDeg: 22, distanceM: 2.8, intensity: 26, kelvin: 3000, softness: 0.8, spreadDeg: 46 }),
        fill: light({ azimuthDeg: 62, elevationDeg: 2, distanceM: 3.2, intensity: 14.5, kelvin: 2900, softness: 1, spreadDeg: 56, shadows: false }),
        rim: light({ azimuthDeg: 145, elevationDeg: 26, distanceM: 2.8, intensity: 26, kelvin: 11000, softness: 0.45, spreadDeg: 32 }),
      },
      env: {
        ambient: 0.32,
        skyColor: "#FFD8A8",
        groundColor: "#6B4A2E",
        cycColor: "#5E4430",
        glowColor: "#E8954F",
        glowTopColor: "#24170E",
        glowStrength: 0.3,
        voidColor: "#140D08",
        saturation: 1.05,
        exposure: 1.3,
      },
    },
  },
  {
    id: "dramatic",
    key: "3",
    name: "Cinematic",
    short: "Hard side key, 8:1",
    note: "A hard key from the side splits the face in two, the fill is nearly gone (about 8:1) and a strong rim carves him out of a dark set. Half the face in shadow says conflict and secrets, the language of action and thriller features.",
    promptLead: "dramatic cinematic low-key lighting",
    roles: {
      key: "Hard and from the side (80° camera left): one half of the face lit, the other half in shadow.",
      fill: "Barely there. About 1/8 of the key, so you can still read the shadow side but it is dark.",
      rim: "Strong and cool from behind on the opposite side: it carves the silhouette out of the darkness.",
      ambient: "Almost nothing. The set falls off to near-black so only the lit edges read.",
    },
    swatch: ["#2B3646", "#0A0C10"],
    rig: {
      lights: {
        key: light({ azimuthDeg: -100, elevationDeg: 22, distanceM: 2.6, intensity: 40, kelvin: 4300, softness: 0.02, spreadDeg: 30 }),
        fill: light({ azimuthDeg: 45, elevationDeg: 4, distanceM: 3.4, intensity: 10, kelvin: 5600, softness: 1, spreadDeg: 50, shadows: false }),
        rim: light({ azimuthDeg: 135, elevationDeg: 28, distanceM: 2.0, intensity: 90, kelvin: 12000, softness: 0.05, spreadDeg: 18 }),
      },
      env: {
        ambient: 0,
        skyColor: "#2A3448",
        groundColor: "#100E0C",
        cycColor: "#262B34",
        glowColor: "#1C2636",
        glowTopColor: "#08090C",
        glowStrength: 0.18,
        voidColor: "#040507",
        saturation: 0.95,
        exposure: 1.05,
      },
    },
  },
  {
    id: "noir",
    key: "4",
    name: "Noir",
    short: "Hard, high, blinds",
    note: "One hard light from high camera-left, cut by venetian blinds, no fill and deep blacks, graded almost to black-and-white. The stripes and pools of shadow say mystery and moral ambiguity: the classic 1940s crime-film look.",
    promptLead: "dark film noir lighting",
    roles: {
      key: "A single hard light, high and from camera left, shining through venetian blinds: stripes across face and wall.",
      fill: "Off. Nothing opens the shadows, so they go to black.",
      rim: "A thin, hard edge from behind, just enough to find the shoulder line in the dark.",
      ambient: "Practically none, and the image is graded down to near monochrome.",
    },
    swatch: ["#8A8A8A", "#050505"],
    rig: {
      lights: {
        key: light({ azimuthDeg: -55, elevationDeg: 42, distanceM: 3.2, intensity: 56, kelvin: 5200, softness: 0.02, spreadDeg: 40, gobo: 1 }),
        fill: light({ on: false, azimuthDeg: 50, elevationDeg: 5, distanceM: 3.2, intensity: 6, kelvin: 5600, softness: 1, spreadDeg: 50, shadows: false }),
        rim: light({ azimuthDeg: 160, elevationDeg: 28, distanceM: 3, intensity: 5, kelvin: 6000, softness: 0.06, spreadDeg: 24 }),
      },
      env: {
        ambient: 0.015,
        skyColor: "#3A3E46",
        groundColor: "#121212",
        cycColor: "#707070",
        glowColor: "#202020",
        glowTopColor: "#050505",
        glowStrength: 0,
        voidColor: "#020202",
        saturation: 0.06,
        exposure: 1.1,
      },
    },
  },
  {
    id: "sunset",
    key: "5",
    name: "Sunset",
    short: "Low warm backlight",
    note: "The sun sits low behind him, so he becomes a dark shape outlined in orange with a long shadow reaching toward camera, while cool blue sky fills the front. Warm against cool, light behind the subject: endings, longing, the golden-hour hero moment.",
    promptLead: "golden-hour sunset backlighting",
    roles: {
      key: "The sun: low (8°) and behind him, hard and deep orange. It lights his back, not his face, and throws a long shadow toward camera.",
      fill: "Cool blue skylight from the front: the face is lit only by the sky, so it stays soft and blue-ish.",
      rim: "A second warm kick from behind on the other side, wrapping the orange edge around both shoulders.",
      ambient: "Dusky blue bounce, and the backdrop glows orange at the horizon, fading to violet above.",
    },
    swatch: ["#FF8A3D", "#3B2A55"],
    rig: {
      lights: {
        key: light({ azimuthDeg: 160, elevationDeg: 5, distanceM: 2.3, intensity: 120, kelvin: 1800, softness: 0.12, spreadDeg: 52 }),
        fill: light({ azimuthDeg: -20, elevationDeg: 22, distanceM: 3.2, intensity: 9, kelvin: 12000, softness: 1, spreadDeg: 56, shadows: false }),
        rim: light({ azimuthDeg: -136, elevationDeg: 10, distanceM: 1.75, intensity: 120, kelvin: 1900, softness: 0.18, spreadDeg: 38 }),
      },
      env: {
        ambient: 0.06,
        skyColor: "#6F86E0",
        groundColor: "#2C2440",
        cycColor: "#3A2C3A",
        glowColor: "#FF8A3D",
        glowTopColor: "#4B3570",
        glowStrength: 1.5,
        voidColor: "#1B1226",
        saturation: 1.05,
        exposure: 1.15,
      },
    },
  },
];

export const DEFAULT_PRESET_ID: PresetId = "three-point";

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** The five one-click looks (excludes the neutral starting rig). */
export const LOOKS = PRESETS.filter((p) => p.id !== "three-point");

/** Deep copy so presets are never mutated through the store. */
export function cloneRig(r: Rig): Rig {
  return {
    lights: { key: { ...r.lights.key }, fill: { ...r.lights.fill }, rim: { ...r.lights.rim } },
    env: { ...r.env },
  };
}

export interface TakeApartStep {
  label: string;
  adds: ChannelId;
  mask: ChannelMask;
}

/** Build a look back up one channel at a time: key → + fill → + rim → full (ambient & set). */
export const TAKE_APART_STEPS: readonly TakeApartStep[] = [
  { label: "Key only", adds: "key", mask: { key: 1, fill: 0, rim: 0, ambient: 0 } },
  { label: "Key + fill", adds: "fill", mask: { key: 1, fill: 1, rim: 0, ambient: 0 } },
  { label: "+ Rim", adds: "rim", mask: { key: 1, fill: 1, rim: 1, ambient: 0 } },
  { label: "Full look", adds: "ambient", mask: { key: 1, fill: 1, rim: 1, ambient: 1 } },
];

export function soloMask(id: ChannelId): ChannelMask {
  return { key: id === "key" ? 1 : 0, fill: id === "fill" ? 1 : 0, rim: id === "rim" ? 1 : 0, ambient: id === "ambient" ? 1 : 0 };
}
