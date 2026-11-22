/**
 * Passo contralateral do visitante procedural.
 *
 * rotation.x > 0 leva o membro para a frente (+Z local).
 * O braço do mesmo lado vai para trás: braço esquerdo à frente
 * quando a perna direita está à frente.
 */

export function gaitPose(phase, walking) {
  const swing = Math.sin(phase) * (walking ? 0.58 : 0.05)
  const elbowBase = walking ? 0.35 : 0.2
  const kneeAmp = walking ? 1.0 : 0.08
  const sin = Math.sin(phase)

  return {
    leftLegX: swing,
    rightLegX: -swing,
    leftKneeX: Math.max(0, sin) * kneeAmp,
    rightKneeX: Math.max(0, -sin) * kneeAmp,
    leftArmX: -swing * 0.7,
    rightArmX: swing * 0.7,
    leftElbowX: elbowBase + Math.max(0, -swing) * 0.4,
    rightElbowX: elbowBase + Math.max(0, swing) * 0.4,
  }
}
