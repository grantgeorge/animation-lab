import { CanvasTexture, LinearFilter } from "three";

const SIZE = 256;

/**
 * A venetian-blind cookie for a spot light (SpotLight.map). Redrawn only when the strength changes
 * by a visible step, so presets can fade the blinds in and out without recompiling shaders.
 */
export class BlindsCookie {
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D | null;
  private drawn = -1;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    this.ctx = canvas.getContext("2d");
    this.texture = new CanvasTexture(canvas);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.update(0);
  }

  update(strength: number) {
    const q = Math.round(Math.min(1, Math.max(0, strength)) * 24) / 24;
    if (q === this.drawn || !this.ctx) return;
    this.drawn = q;
    const c = this.ctx;
    c.save();
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, SIZE, SIZE);
    if (q > 0) {
      const v = Math.round(255 * (1 - q * 0.97));
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.filter = "blur(1.2px)";
      c.translate(SIZE / 2, SIZE / 2);
      c.rotate(-0.14);
      c.translate(-SIZE / 2, -SIZE / 2);
      const slats = 34;
      const period = (SIZE * 1.4) / slats;
      for (let i = -3; i < slats + 3; i++) c.fillRect(-SIZE * 0.3, i * period - SIZE * 0.2, SIZE * 1.6, period * 0.46);
    }
    c.restore();
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
