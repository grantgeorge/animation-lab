/**
 * Turnaround layout: three views of one figure at ONE scale, each tile as wide as its own view needs,
 * so a wide front view and a narrow profile both fill the sheet. Pure; units are world metres and pixels.
 */
export interface ViewBounds { minX: number; maxX: number }
export interface SheetBounds { minY: number; maxY: number; views: readonly ViewBounds[] }
export interface SheetTile { x: number; w: number; cx: number }
export interface SheetLayout { scale: number; bottom: number; top: number; tiles: SheetTile[] }

/** Margins as shares of the figure's height (top leaves room for the view labels). */
export const SHEET_MARGIN = { top: 0.12, bottom: 0.05, side: 0.06 } as const;

export function sheetLayout(b: SheetBounds, panelW: number, panelH: number, m = SHEET_MARGIN): SheetLayout {
  const h = Math.max(1e-6, b.maxY - b.minY);
  const pad = h * m.side;
  const widths = b.views.map(v => v.maxX - v.minX + 2 * pad);
  const scale = Math.min(panelH / (h * (1 + m.top + m.bottom)), panelW / widths.reduce((a, w) => a + w, 0));
  // Spare pixels (a height-limited sheet) are shared out evenly, so the views spread across the panel.
  const spare = (panelW - widths.reduce((a, w) => a + w * scale, 0)) / widths.length;
  const tiles: SheetTile[] = [];
  let x = 0;
  b.views.forEach((v, i) => { const w = widths[i] * scale + spare; tiles.push({ x, w, cx: (v.minX + v.maxX) / 2 }); x += w; });
  const bottom = b.minY - h * m.bottom;
  return { scale, bottom, top: bottom + panelH / scale, tiles };
}
