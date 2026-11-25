/** A tela fica à frente da moldura o bastante para o depth buffer não trocar as duas. */
export const FRAME_DEPTH = 0.08
export const FRAME_BORDER = 0.12
export const CANVAS_Z = FRAME_DEPTH / 2 + 0.02

export const CANVAS_DEPTH = {
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
}
