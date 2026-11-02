import { PNG } from "pngjs";

/** Decode a PNG buffer and average it into a cols × rows grid of RGB cells. */
export function cellGrid(buf: Buffer, cols: number, rows: number) {
  const png = PNG.sync.read(buf);
  const cells: number[][] = [];
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * png.width) / cols);
      const x1 = Math.floor(((cx + 1) * png.width) / cols);
      const y0 = Math.floor((cy * png.height) / rows);
      const y1 = Math.floor(((cy + 1) * png.height) / rows);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * png.width + x) * 4;
          r += png.data[i];
          g += png.data[i + 1];
          b += png.data[i + 2];
          n++;
        }
      cells.push([r / n, g / n, b / n]);
    }
  return cells;
}

export const cellDiff = (a: number[], b: number[]) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
