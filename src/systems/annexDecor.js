/**
 * Fonte, árvores e caminho das salas expandidas.
 * O corredor central (x = 0) fica livre para jogadores e NPCs.
 */

import { getAnnexRoomBounds } from '../data/museumLayout.js'

export function annexLayout(index) {
  const bounds = getAnnexRoomBounds(index)
  const z = bounds.centerZ
  const depth = Math.abs(bounds.minZ - bounds.maxZ)
  return {
    path: { x: 0, z, width: 2.5, length: depth - 3.2 },
    fountain: { x: -5.5, z, radius: 1.15 },
    trees: [
      { x: -8.2, z: z - 6.2, height: 2.7, seed: 410 + index },
      { x: -8.0, z: z + 5.6, height: 2.3, seed: 428 + index },
      { x: 8.3, z: z - 5.4, height: 2.9, seed: 446 + index },
      { x: 7.8, z: z + 6.1, height: 2.4, seed: 464 + index },
    ],
  }
}

export function annexObstacles(count) {
  const out = []
  const rooms = Math.max(0, count | 0)
  for (let i = 0; i < rooms; i++) {
    const layout = annexLayout(i)
    out.push({
      x: layout.fountain.x,
      z: layout.fountain.z,
      r: layout.fountain.radius + 0.2,
    })
    for (const tree of layout.trees) {
      out.push({ x: tree.x, z: tree.z, r: 0.55 })
    }
  }
  return out
}

export function annexVegetation(count) {
  const trunks = []
  const canopy = []
  const rooms = Math.max(0, count | 0)
  for (let i = 0; i < rooms; i++) {
    for (const tree of annexLayout(i).trees) {
      const trunkH = tree.height * 0.55
      const key = `annex-${i}-${tree.x.toFixed(1)}-${tree.z.toFixed(1)}`
      trunks.push({
        key: `${key}-trunk`,
        position: [tree.x, trunkH / 2, tree.z],
        scale: [tree.height * 0.28, trunkH, tree.height * 0.28],
        color: '#6b4c31',
      })
      canopy.push(
        {
          key: `${key}-a`,
          position: [tree.x, trunkH + tree.height * 0.2, tree.z],
          scale: [tree.height * 0.42, tree.height * 0.3, tree.height * 0.42],
          rotation: [0, tree.seed, 0],
          color: '#4f7a3a',
        },
        {
          key: `${key}-b`,
          position: [tree.x + 0.12, trunkH + tree.height * 0.38, tree.z - 0.08],
          scale: [tree.height * 0.3, tree.height * 0.24, tree.height * 0.3],
          rotation: [0.15, tree.seed * 0.3, 0],
          color: '#5c8a44',
        },
      )
    }
  }
  return { trunks, canopy, shrubs: [] }
}
