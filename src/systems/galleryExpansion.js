/**
 * Expansão da galeria comunitária.
 * Funções puras: o clique na HUD, a geometria das salas e o sync
 * multiplayer passam por aqui para não depender do servidor de uploads.
 */

export const MAX_ANNEXES = 2

export function clampAnnexCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(MAX_ANNEXES, Math.floor(n)))
}

/** Próximo valor ao clicar em Expandir. Trava em MAX_ANNEXES. */
export function nextAnnexCount(current) {
  const n = clampAnnexCount(current)
  return n >= MAX_ANNEXES ? n : n + 1
}

/**
 * O número de salas só cresce.
 * Um estado remoto atrasado (0) não apaga uma expansão local,
 * e um valor maior (late joiner ou outro jogador) entra na hora.
 */
export function mergeAnnexCount(local, remote) {
  return Math.max(clampAnnexCount(local), clampAnnexCount(remote))
}

/**
 * Sala anexa ao norte da anterior.
 * annexIndex 0 encosta na parede norte da sala principal (z = -halfD).
 */
export function annexRoomBounds(annexIndex, halfD, annexDepth, halfW) {
  const index = Math.max(0, Math.floor(Number(annexIndex) || 0))
  const baseZ = -halfD - index * annexDepth
  return {
    minX: -halfW,
    maxX: halfW,
    minZ: baseZ - annexDepth,
    maxZ: baseZ,
    centerZ: baseZ - annexDepth / 2,
  }
}

/** Alturas Z dos quadros laterais, sempre dentro da sala. */
export function annexFrameZs(annexIndex, halfD, annexDepth) {
  const bounds = annexRoomBounds(annexIndex, halfD, annexDepth, 1)
  return [bounds.centerZ - 6, bounds.centerZ]
}
