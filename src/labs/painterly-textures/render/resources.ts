import { SRGBColorSpace, TextureLoader, type Texture } from "three";
import { painterly } from "../config";
import { live } from "../live";
import { charUniforms, envExtras, envUniforms } from "./paintMaterial";
import { acesInverseLut, brushTexture, paperTexture } from "./textures";

/** Lab-wide textures, created once on the client and released when the lab unmounts. */
export interface Resources {
  brush: Texture;
  brushCanvas: HTMLCanvasElement;
  paper: Texture;
  matte: Texture;
  acesInv: Texture;
  matteReady: Promise<void>;
}

let res: Resources | null = null;

export function resources(): Resources {
  if (res) return res;
  const { texture: brush, canvas: brushCanvas } = brushTexture();
  const paper = paperTexture();
  const acesInv = acesInverseLut();
  let resolve: () => void = () => {};
  const matteReady = new Promise<void>((r) => (resolve = r));
  const matte = new TextureLoader().load(
    painterly.matte.url,
    () => {
      envExtras.ptMatteReady.value = 1;
      resolve();
    },
    undefined,
    () => resolve(),
  );
  matte.colorSpace = SRGBColorSpace;
  matte.name = "painterly-matte";
  charUniforms.ptBrush.value = brush;
  envUniforms.ptBrush.value = brush;
  envExtras.ptMatte.value = matte;
  envExtras.ptAcesInv.value = acesInv;
  live.matte = matte;
  res = { brush, brushCanvas, paper, matte, acesInv, matteReady };
  return res;
}

export function releaseResources() {
  if (!res) return;
  res.brush.dispose();
  res.paper.dispose();
  res.matte.dispose();
  res.acesInv.dispose();
  res = null;
}
