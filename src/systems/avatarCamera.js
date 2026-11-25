/**
 * Altura da câmera a partir do modelo do visitante.
 *
 * O corpo procedural mede cerca de 1,8 m com escala 1 (pés ~0, cabeça ~1,68).
 * A escala do jogador muda isso. A primeira pessoa fica nos olhos; a terceira
 * olha para o meio entre ombro e cabeça, mais longe quanto maior o corpo.
 */

import { groundMoveAxes } from './groundMove.js'
import { pullCameraIn } from './roomClearance.js'

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

/** Corpo recuado o bastante para o tronco não entrar no near plane. */
export function firstPersonBodyBack(scale) {
  const metrics = avatarMetrics(scale)
  return 0.1 + metrics.sx * 0.12
}

/**
 * Terceira pessoa: mira no ombro/cabeça e afasta na proporção da altura.
 * `yaw` é o mesmo da câmera em primeira pessoa (olhar para -Z local).
 */
export function thirdPersonRig(x, feetY, z, yaw, scale) {
  const metrics = avatarMetrics(scale)
  const lookY = feetY + metrics.shoulderAboveFeet * 0.7 + metrics.headAboveFeet * 0.3
  const distance = 2.05 + metrics.height * 1.05
  const lift = 0.18 + metrics.height * 0.2
  const { forwardX, forwardZ } = groundMoveAxes(yaw)
  const look = { x, y: lookY, z }
  const desired = {
    x: x - forwardX * distance,
    y: lookY + lift,
    z: z - forwardZ * distance,
  }
  const origin = { x, y: feetY + metrics.headAboveFeet, z }
  const camera = pullCameraIn(origin, desired, 0.42 + metrics.radius)
  return { look, camera, distance, metrics }
}
