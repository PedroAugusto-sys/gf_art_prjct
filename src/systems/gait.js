/**
 * Passo contralateral do visitante procedural.
 *
 * O membro pende em -Y. rotation.x positivo gira essa ponta para -Z,
 * rotation.x negativo gira para +Z (frente do modelo).
 * Braço esquerdo à frente quando a perna direita está à frente.
 */

export function gaitPose(phase, walking) {
  const swing = Math.sin(phase) * (walking ? 0.58 : 0.05)
  // Cotovelo negativo dobra o antebraço para a frente (+Z). O valor
  // antigo era positivo e dobrava o braço para trás, então o balanço
  // parecia invertido mesmo com o ombro no sentido certo.
  const elbowBase = walking ? -0.2 : -0.08
  const kneeAmp = walking ? 1.0 : 0.08
  const sin = Math.sin(phase)

  return {
    leftLegX: swing,
    rightLegX: -swing,
    leftKneeX: Math.max(0, sin) * kneeAmp,
    rightKneeX: Math.max(0, -sin) * kneeAmp,
    leftArmX: -swing * 0.7,
    rightArmX: swing * 0.7,
    leftElbowX: elbowBase + Math.min(0, -swing) * 0.55,
    rightElbowX: elbowBase + Math.min(0, swing) * 0.55,
  }
}
