/**
 * O que é sala aberta para a câmera e para o balão de fala.
 * Amostra o plano XZ: parede, pilar e o lado de fora escondem;
 * porta e vão do anexo continuam abertos.
 */

import {
  ANNEX_CORRIDOR_WIDTH,
  DOORS,
  HALF_D,
  HALF_W,
  PILLAR_POSITIONS,
  getAnnexRoomBounds,
} from '../data/museumLayout.js'

const INSET = 0.42
const PILLAR_R2 = 0.62 * 0.62
const CORRIDOR_HALF = ANNEX_CORRIDOR_WIDTH / 2 - 0.28
const DOOR_HALF = DOORS.width * 0.5 - 0.12

export function pointIndoors(x, z) {
  if (Math.abs(x) < HALF_W - INSET && z < HALF_D - INSET && z > -HALF_D + INSET) {
    return !insidePillar(x, z)
  }
  if (z < HALF_D + 0.15 && z > HALF_D - 1.3) {
    for (let i = 0; i < DOORS.centers.length; i++) {
      if (Math.abs(x - DOORS.centers[i]) < DOOR_HALF) return true
    }
  }
  if (Math.abs(x) < CORRIDOR_HALF && z < -HALF_D + 1.5 && z > -HALF_D - 1.5) return true
  for (let i = 0; i < 2; i++) {
    const bounds = getAnnexRoomBounds(i)
    if (
      Math.abs(x) < HALF_W - INSET &&
      z < bounds.maxZ - 0.15 &&
      z > bounds.minZ + INSET &&
      !insidePillar(x, z)
    ) {
      return true
    }
    if (Math.abs(x) < CORRIDOR_HALF && z <= bounds.maxZ + 0.3 && z >= bounds.maxZ - 0.9) return true
  }
  return false
}

function insidePillar(x, z) {
  for (let i = 0; i < PILLAR_POSITIONS.length; i++) {
    const px = PILLAR_POSITIONS[i][0]
    const pz = PILLAR_POSITIONS[i][1]
    const dx = x - px
    const dz = z - pz
    if (dx * dx + dz * dz < PILLAR_R2) return true
  }
  return false
}

/** A reta entre duas pessoas atravessa parede quando alguma amostra sai da sala. */
export function segmentIndoors(x1, z1, x2, z2) {
  const dist = Math.hypot(x2 - x1, z2 - z1)
  const steps = Math.max(4, Math.ceil(dist / 0.35))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!pointIndoors(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false
  }
  return true
}

/**
 * Encosta a câmera antes da parede. `origin` é a cabeça, `desired` o ponto ideal.
 * Devolve o último ponto que ainda está dentro da sala.
 */
export function pullCameraIn(origin, desired, minDistance = 0.4) {
  const dx = desired.x - origin.x
  const dy = desired.y - origin.y
  const dz = desired.z - origin.z
  const len = Math.hypot(dx, dy, dz) || 1
  let best = { x: origin.x, y: Math.min(6.2, Math.max(0.4, origin.y)), z: origin.z }
  const steps = 20
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const dist = len * t
    const y = origin.y + dy * t
    const x = origin.x + dx * t
    const z = origin.z + dz * t
    if (y < 0.35 || y > 6.3) break
    if (dist > minDistance && !pointIndoors(x, z)) break
    best = { x, y, z }
  }
  return best
}
