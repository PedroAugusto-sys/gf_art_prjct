/**
 * Altura da câmera a partir do modelo do visitante.
 *
 * O corpo procedural mede cerca de 1,8 m com escala 1 (pés ~0, cabeça ~1,68).
 * A câmera fica sempre na altura dos olhos. Soltar o mouse, Alt ou um modal
 * não mudam essa altura: o modo não existe fora da primeira pessoa.
 */

export const MODEL_FOOT_Y = 0.04
export const MODEL_EYE_Y = 1.64
export const MODEL_SHOULDER_Y = 1.44
export const MODEL_HEAD_Y = 1.68
export const MODEL_HEAD_TOP_Y = 1.8

export function avatarMetrics(scale = [1, 1, 1]) {
  const sx = Math.max(0.45, Number(scale?.[0]) || 1)
  const sy = Math.max(0.45, Number(scale?.[1]) || 1)
  const height = (MODEL_HEAD_TOP_Y - MODEL_FOOT_Y) * sy
  const eyeAboveFeet = (MODEL_EYE_Y - MODEL_FOOT_Y) * sy
  const shoulderAboveFeet = (MODEL_SHOULDER_Y - MODEL_FOOT_Y) * sy
  const headAboveFeet = (MODEL_HEAD_Y - MODEL_FOOT_Y) * sy
  const radius = Math.min(0.38, Math.max(0.24, 0.3 * sx))
  const half = Math.max(0.3, height / 2 - radius)
  return {
    sx,
    sy,
    height,
    eyeAboveFeet,
    shoulderAboveFeet,
    headAboveFeet,
    radius,
    half,
    capsuleCenter: half + radius,
  }
}

export function firstPersonEyeY(bodyY, scale) {
  const metrics = avatarMetrics(scale)
  return bodyY - metrics.capsuleCenter + metrics.eyeAboveFeet
}
