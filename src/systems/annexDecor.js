/**
 * Bancos e canteiros das salas expandidas.
 * O corredor central (x = 0) fica livre, e nada fica na frente dos quadros.
 */

import { getAnnexRoomBounds, plantsForBeds, ANNEX_DEPTH, HALF_D } from '../data/museumLayout.js'
import { annexFrameZs } from './galleryExpansion.js'

export function annexLayout(index) {
  const bounds = getAnnexRoomBounds(index)
  const z = bounds.centerZ
  const depth = Math.abs(bounds.minZ - bounds.maxZ)
  const [backZ, midZ] = annexFrameZs(index, HALF_D, ANNEX_DEPTH)
  return {
    path: { x: 0, z, width: 2.5, length: depth - 3.2 },
    benches: [
      { x: -7.2, z: z + 5.5, rotY: 0 },
      { x: 7.2, z: z + 5.5, rotY: 0 },
    ],
    // Entre as duas fileiras de quadros, longe do corredor e da linha de visão.
    beds: [
      { id: `annex${index}-w`, pos: [-5.2, (backZ + midZ) / 2], size: [3.2, 3.2], seed: 510 + index * 17 },
      { id: `annex${index}-e`, pos: [5.2, (backZ + midZ) / 2], size: [3.2, 3.2], seed: 540 + index * 19 },
    ],
  }
}

export function annexObstacles(count) {
  const out = []
  const rooms = Math.max(0, count | 0)
  for (let i = 0; i < rooms; i++) {
    const layout = annexLayout(i)
    for (const bench of layout.benches) {
      out.push({ x: bench.x, z: bench.z, r: 1.15 })
    }
    for (const bed of layout.beds) {
      out.push({
        x: bed.pos[0],
        z: bed.pos[1],
        r: Math.max(bed.size[0], bed.size[1]) * 0.55 + 0.25,
      })
    }
  }
  return out
}

export function annexVegetation(count) {
  const rooms = Math.max(0, count | 0)
  const beds = []
  for (let i = 0; i < rooms; i++) beds.push(...annexLayout(i).beds)
  return plantsForBeds(beds)
}
