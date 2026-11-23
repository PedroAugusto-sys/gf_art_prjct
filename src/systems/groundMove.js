/**
 * Direção de andar no plano do chão, só com o yaw da câmera.
 *
 * A câmera olha para -Z local. Projetar o vetor de visão inteiro no chão
 * funciona no meio do pitch, mas no limite (olhar reto para baixo ou para
 * cima) a componente horizontal zera. O fallback antigo (0, 0, -1) ignora
 * o yaw e, se o jogador olhava para +Z, o W anda para trás.
 */

export function groundMoveAxes(yaw) {
  const y = Number.isFinite(yaw) ? yaw : 0
  const forwardX = -Math.sin(y)
  const forwardZ = -Math.cos(y)
  return {
    forwardX,
    forwardZ,
    rightX: -forwardZ,
    rightZ: forwardX,
  }
}
