#!/usr/bin/env node
/**
 * NPCs só entram no anexo depois que ele abre, e o caminho
 * passa pelo vão em vez de atravessar a parede.
 */

import assert from 'node:assert/strict'
import { findPath, isWalkable, setWalkAnnexCount } from './src/systems/navgrid.js'

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL  ${name}`)
    throw err
  }
}

function samples(from, path) {
  const pts = [from, ...path]
  const out = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    for (let s = 0; s <= 24; s++) {
      const t = s / 24
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
  return out
}

console.log('navegação dos anexos')

test('com a galeria fechada o anexo não é chão', () => {
  setWalkAnnexCount(0)
  assert.equal(isWalkable(0, -30), false)
  assert.equal(isWalkable(0, -19), false)
  const path = findPath(0, 0, 0, -30) || []
  assert.ok(path.length > 0)
  assert.ok(path[path.length - 1].z > -18.5)
})

test('o primeiro anexo abre pelo vão, sem cruzar a parede', () => {
  setWalkAnnexCount(1)
  assert.equal(isWalkable(0, -19), true)
  assert.equal(isWalkable(8, -19), false)
  assert.equal(isWalkable(0, -30), true)
  assert.equal(isWalkable(13.2, -30), false)

  const from = { x: 8, z: -8 }
  const path = findPath(from.x, from.z, 5, -32)
  assert.ok(path && path.length > 0)
  assert.ok(path[path.length - 1].z < -28)
  const crossed = samples(from, path).filter((p) => p.z < -17.6 && p.z > -20.4)
  assert.ok(crossed.length > 0, 'o caminho passa pela porta')
  assert.ok(crossed.every((p) => Math.abs(p.x) < 1.8), 'a porta não deixa atravessar a alvenaria')
})

test('o segundo anexo só abre depois do primeiro', () => {
  setWalkAnnexCount(1)
  assert.equal(isWalkable(0, -50), false)
  setWalkAnnexCount(2)
  assert.equal(isWalkable(0, -50), true)
  assert.equal(isWalkable(8, -39), false)
  const from = { x: 0, z: -30 }
  const path = findPath(from.x, from.z, 0, -50)
  assert.ok(path && path[path.length - 1].z < -45)
  const crossed = samples(from, path).filter((p) => p.z < -37.6 && p.z > -40.4)
  assert.ok(crossed.length > 0)
  assert.ok(crossed.every((p) => Math.abs(p.x) < 1.8))
  setWalkAnnexCount(0)
})

console.log('todos os testes passaram')
