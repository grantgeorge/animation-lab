/** Design tokens shared by CSS (src/app/tokens.css) and three.js materials. Keep both in sync. */
export const tokens = {
  stageVoid: "#07090E",
  stageFloor: "#141922",
  stageFloorEdge: "#1C2330",
  stageWall: "#0F131B",
  backdropTop: "#1A2230",
  ink0: "#F2F5F9",
  ink1: "#B9C2CF",
  ink2: "#7C8796",
  ink3: "#4A5465",
  glassBase: "#0E121A",
  focal: "#5FE3FF",
  focalText: "#8FEBFF",
  distance: "#FFB547",
  subject: "#8EF0C3",
  danger: "#FF6B6B",
  plaster: "#D9C9B0",
  plasterShade: "#B8A68C",
  brick: "#8C4E3C",
  wood: "#6E4B2E",
  teal: "#2B6F72",
  stone: "#6F6A62",
  roof: "#3A3F4A",
  lampWarm: "#FFB46A",
  windowGlow: "#FFC98A",
  bramSkin: "#F0C3A0",
  bramNose: "#E8A98A",
  bramCoat: "#C8552F",
  bramScarf: "#F4E9D8",
  bramTrousers: "#2F3A4A",
  bramShoes: "#3B2A20",
  bramCap: "#2A2321",
  pipSkin: "#F7D9C2",
  pipCoat: "#F2C14E",
  pipBoots: "#2F6F73",
  pipHair: "#7A3B22",
  gunmetal: "#2B2F36",
  rubber: "#141414",
  brass: "#B8893A",
  aluminum: "#9AA3AD",
} as const;

/** WCAG relative luminance contrast between two hex colors. */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
