/** Accent per variable (same tokens as the rest of the product). */
export const ACCENT_MAIN = "#d8bd96";
export const ACCENT_MAIN_TEXT = "#e7d3b5";
export const ACCENT_A = "#d8b481";
export const ACCENT_B = "#9dc4cb";
export const SQUASH = "#a4c8b5";
export const ANTIC = "#cbb391";
export const INK = { 0: "#eef0f3", 1: "#b5bdc8", 2: "#8d97a5", 3: "#616c7b" } as const;

export const variantColor = (id: "main" | "A" | "B") => (id === "A" ? ACCENT_A : id === "B" ? ACCENT_B : ACCENT_MAIN);
