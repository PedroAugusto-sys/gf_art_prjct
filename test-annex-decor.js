#!/usr/bin/env node
/**
 * Bancos e canteiros das salas novas não fecham o corredor
 * nem ficam na frente dos quadros.
 */

import assert from 'node:assert/strict'
import { setWalkAnnexCount, isWalkable } from './src/systems/navgrid.js'
import { annexLayout, annexVegetation } from './src/systems/annexDecor.js'
import { CANVAS_Z, FRAME_DEPTH } from './src/systems/frameDepth.js'
import { getCommunityFrameLayouts, GARDEN_BEDS, BED_HEIGHT } from './src/data/museumLayout.js'
import artworksData from './src/data/artworks.json' with { type: 'json' }

setWalkAnnexCount(2)
const room = annexLayout(0)
const next = annexLayout(1)
const frames = getCommunityFrameLayouts(2)

function blocksFrame(x, z, radius, frame) {
  const rotY = frame.rotation[1]
  const nx = Math.sin(rotY)
  const nz = Math.cos(rotY)
  const dx = x - frame.position[0]
  const dz = z - frame.position[2]
  const along = dx * nx + dz * nz
  const lateral = Math.abs(dx * -nz + dz * nx)
  const frameHalf = (frame.size?.[0] || 2) / 2
  return along > -0.3 && along < 4 && lateral < frameHalf + radius * 0.35
}

console.log('decoração dos anexos')
assert.equal(isWalkable(0, room.path.z), true, 'o caminho central da primeira sala fechou')
assert.equal(isWalkable(0, next.path.z), true, 'o caminho central da segunda sala fechou')
assert.equal(isWalkable(0, -20), true, 'o vão entre a sala e o anexo fechou')
assert.equal(room.fountain, undefined, 'a fonte ainda está na sala')
for (const bench of [...room.benches, ...next.benches]) {
  assert.equal(isWalkable(bench.x, bench.z), false, `banco em ${bench.x},${bench.z} não bloqueia`)
  assert.ok(Math.abs(bench.x) > 4, 'banco em cima do corredor')
}
for (const bed of [...room.beds, ...next.beds]) {
  const [x, z] = bed.pos
  assert.equal(isWalkable(x, z), false, `canteiro em ${x},${z} não bloqueia`)
  assert.ok(Math.abs(x) > 4, 'canteiro em cima do corredor')
  const radius = Math.max(bed.size[0], bed.size[1]) / 2
  for (const frame of frames) {
    assert.equal(blocksFrame(x, z, radius, frame), false, `${bed.id} na frente de ${frame.id}`)
  }
}
for (const bench of [...room.benches, ...next.benches]) {
  for (const frame of frames) {
    assert.equal(blocksFrame(bench.x, bench.z, 1.2, frame), false, `banco na frente de ${frame.id}`)
  }
}
assert.ok(!GARDEN_BEDS.some((bed) => bed.id === 'bed-c1'), 'o canteiro do canto continua na frente do quadro')
const catalogFrames = (artworksData.artworks || []).map((art) => ({
  id: art.id,
  position: art.position,
  rotation: art.rotation,
  size: art.size,
}))
for (const bed of GARDEN_BEDS) {
  const radius = Math.max(bed.size[0], bed.size[1]) / 2
  for (const frame of [...catalogFrames, ...frames]) {
    assert.equal(
      blocksFrame(bed.pos[0], bed.pos[1], radius, frame),
      false,
      `${bed.id} na frente de ${frame.id}`,
    )
  }
}
const plants = annexVegetation(2)
assert.ok(plants.trunks.length >= 4, 'as salas novas ficaram sem árvore')
assert.ok(plants.shrubs.length >= 8, 'os canteiros ficaram sem arbusto')
assert.ok(plants.trunks.every((trunk) => trunk.position[1] >= BED_HEIGHT), 'árvore brotando do concreto')
assert.ok(CANVAS_Z > FRAME_DEPTH / 2 + 0.01, 'a tela continua colada na moldura')
console.log('todos os testes passaram')
