#!/usr/bin/env node
/**
 * Expansão da galeria e passo dos braços.
 * Não sobe o servidor de uploads nem o Playroom.
 */

import assert from 'node:assert/strict'
import {
  MAX_ANNEXES,
  annexFrameZs,
  annexRoomBounds,
  mergeAnnexCount,
  nextAnnexCount,
} from './src/systems/galleryExpansion.js'
import { gaitPose } from './src/systems/gait.js'

const HALF_D = 19
const ANNEX_DEPTH = 20
const HALF_W = 14

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL  ${name}`)
    throw err
  }
}

console.log('expansão da galeria')

test('um clique sobe o contador até 2', () => {
  assert.equal(nextAnnexCount(0), 1)
  assert.equal(nextAnnexCount(1), 2)
  assert.equal(nextAnnexCount(2), 2)
  assert.equal(nextAnnexCount(9), 2)
  assert.equal(nextAnnexCount(undefined), 1)
  assert.equal(MAX_ANNEXES, 2)
})

test('sync não deixa um 0 remoto apagar a sala local', () => {
  assert.equal(mergeAnnexCount(1, 0), 1)
  assert.equal(mergeAnnexCount(0, 2), 2)
  assert.equal(mergeAnnexCount(2, 1), 2)
})

test('a primeira sala encosta na parede norte da galeria', () => {
  const room = annexRoomBounds(0, HALF_D, ANNEX_DEPTH, HALF_W)
  assert.equal(room.maxZ, -HALF_D)
  assert.equal(room.minZ, -HALF_D - ANNEX_DEPTH)
  assert.equal(room.centerZ, -HALF_D - ANNEX_DEPTH / 2)
})

test('a segunda sala encosta na primeira, sem vão', () => {
  const first = annexRoomBounds(0, HALF_D, ANNEX_DEPTH, HALF_W)
  const second = annexRoomBounds(1, HALF_D, ANNEX_DEPTH, HALF_W)
  assert.equal(second.maxZ, first.minZ)
  assert.equal(second.minZ, first.minZ - ANNEX_DEPTH)
})

test('os quadros da sala anexa ficam dentro dela', () => {
  for (let i = 0; i < MAX_ANNEXES; i++) {
    const room = annexRoomBounds(i, HALF_D, ANNEX_DEPTH, HALF_W)
    for (const z of annexFrameZs(i, HALF_D, ANNEX_DEPTH)) {
      assert.ok(z < room.maxZ && z > room.minZ, `anexo ${i} quadro z=${z}`)
    }
  }
})

console.log('passo dos braços')

test('braços balançam no sentido oposto às pernas do mesmo lado', () => {
  const forward = gaitPose(Math.PI / 2, true)
  assert.ok(forward.leftLegX > 0)
  assert.ok(forward.rightLegX < 0)
  assert.ok(forward.leftArmX < 0)
  assert.ok(forward.rightArmX > 0)
  assert.notEqual(Math.sign(forward.leftArmX), Math.sign(forward.leftLegX))
  assert.notEqual(Math.sign(forward.rightArmX), Math.sign(forward.rightLegX))

  const back = gaitPose(-Math.PI / 2, true)
  assert.ok(back.leftLegX < 0)
  assert.ok(back.leftArmX > 0)
  assert.ok(back.rightArmX < 0)
})

test('em repouso os braços continuam opostos às pernas, com amplitude pequena', () => {
  const idle = gaitPose(Math.PI / 2, false)
  assert.ok(Math.abs(idle.leftArmX) < 0.1)
  assert.ok(idle.leftArmX < 0)
  assert.ok(idle.leftLegX > 0)
})

console.log('todos os testes passaram')
