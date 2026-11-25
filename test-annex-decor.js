#!/usr/bin/env node
/**
 * Fonte e árvores das salas novas não fecham o corredor.
 */

import assert from 'node:assert/strict'
import { setWalkAnnexCount, isWalkable } from './src/systems/navgrid.js'
import { annexLayout } from './src/systems/annexDecor.js'
import { CANVAS_Z, FRAME_DEPTH } from './src/systems/frameDepth.js'

setWalkAnnexCount(2)
const room = annexLayout(0)
const next = annexLayout(1)

console.log('decoração dos anexos')
assert.equal(isWalkable(0, room.path.z), true, 'o caminho central da primeira sala fechou')
assert.equal(isWalkable(0, next.path.z), true, 'o caminho central da segunda sala fechou')
assert.equal(isWalkable(0, -20), true, 'o vão entre a sala e o anexo fechou')
assert.equal(isWalkable(room.fountain.x, room.fountain.z), false, 'a fonte não virou obstáculo')
for (const tree of room.trees) {
  assert.equal(isWalkable(tree.x, tree.z), false, `árvore em ${tree.x},${tree.z} não bloqueia`)
  assert.ok(Math.abs(tree.x) > 4, 'árvore em cima do corredor')
}
assert.ok(CANVAS_Z > FRAME_DEPTH / 2 + 0.01, 'a tela continua colada na moldura')
console.log('todos os testes passaram')
