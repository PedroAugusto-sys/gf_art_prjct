import { ART_VIEWING_SPOTS, IDLE_SPOTS } from '../data/museumLayout'

/**
 * Coordenacao da multidao, fora do React (nenhum re-render por frame).
 *
 * Reservas: cada obra tem exatamente 2 pontos de observacao, e cada ponto de
 * descanso e unico. Um NPC so para em um lugar se conseguir reservar o ponto,
 * entao nunca ha mais de dois visitantes analisando a mesma arte nem dois
 * parados dentro um do outro. O tempo de permanencia e limitado e a obra
 * recem-visitada fica bloqueada na escolha seguinte, o que forca o rodizio.
 *
 * Agentes: posicoes compartilhadas para que os NPCs se afastem uns dos outros.
 */

const IDLE_SPOT_LIST = IDLE_SPOTS.map((spot, i) => ({
  key: `idle::${i}`,
  x: spot[0],
  z: spot[1],
  look: null,
  artId: null,
}))

const reservedBy = new Map() // spotKey -> npcId
const agents = new Map() // npcId -> { x, z }

export function releaseSpot(npcId) {
  for (const [key, owner] of reservedBy) {
    if (owner === npcId) reservedBy.delete(key)
  }
}

function nearestFree(spots, x, z, filter) {
  const free = spots.filter((spot) => !reservedBy.has(spot.key) && (!filter || filter(spot)))
  if (free.length === 0) return null

  free.sort(
    (a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2)
  )
  // Sorteia entre os mais proximos para que os visitantes nao convirjam todos
  // para a mesma obra assim que ela vaga.
  const pool = free.slice(0, Math.min(4, free.length))
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Reserva um ponto de observacao livre, evitando a obra recem-visitada. */
export function claimViewingSpot(npcId, { x = 0, z = 0, avoidArtId = null } = {}) {
  releaseSpot(npcId)
  const chosen = nearestFree(ART_VIEWING_SPOTS, x, z, (spot) => spot.artId !== avoidArtId)
  if (chosen) reservedBy.set(chosen.key, npcId)
  return chosen
}

/** Reserva um ponto neutro quando todas as vagas de obra estao ocupadas. */
export function claimIdleSpot(npcId, { x = 0, z = 0 } = {}) {
  releaseSpot(npcId)
  const chosen = nearestFree(IDLE_SPOT_LIST, x, z)
  if (chosen) reservedBy.set(chosen.key, npcId)
  return chosen
}

export function updateAgent(npcId, x, z) {
  const entry = agents.get(npcId)
  if (entry) {
    entry.x = x
    entry.z = z
  } else {
    agents.set(npcId, { x, z })
  }
}

export function removeAgent(npcId) {
  agents.delete(npcId)
  releaseSpot(npcId)
}

/**
 * Empurrao lateral para evitar que dois visitantes ocupem o mesmo espaco.
 * Escreve o resultado em 'out' para nao alocar objetos a cada frame.
 */
export function separationForce(npcId, x, z, radius, out) {
  out.x = 0
  out.z = 0
  for (const [id, other] of agents) {
    if (id === npcId) continue
    const dx = x - other.x
    const dz = z - other.z
    const dist = Math.hypot(dx, dz)
    if (dist > radius || dist < 1e-4) continue
    const push = (radius - dist) / radius
    out.x += (dx / dist) * push
    out.z += (dz / dist) * push
  }
  return out
}
