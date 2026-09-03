/**
 * Poses dos NPCs no host, coletadas a cada frame para o snapshot Playroom.
 */

/** @type {Map<string, object>} */
export const npcSnapshotMap = new Map()

export function updateNpcSnapshot(id, data) {
  npcSnapshotMap.set(id, data)
}

export function removeNpcSnapshot(id) {
  npcSnapshotMap.delete(id)
}

export function buildNpcSnapshot() {
  return Array.from(npcSnapshotMap.values())
}
