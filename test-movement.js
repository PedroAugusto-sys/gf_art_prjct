#!/usr/bin/env node
/**
 * Direção do movimento no chão, inclusive no pitch extremo.
 */

import assert from 'node:assert/strict'
import * as THREE from 'three'
import { groundMoveAxes } from './src/systems/groundMove.js'

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL  ${name}`)
    throw err
  }
}

function cameraHeading(yaw, pitch) {
  const cam = new THREE.PerspectiveCamera()
  cam.rotation.order = 'YXZ'
  cam.rotation.set(pitch, yaw, 0)
  cam.updateMatrixWorld(true)
  const dir = new THREE.Vector3()
  cam.getWorldDirection(dir)
  dir.y = 0
  if (dir.lengthSq() < 1e-8) return null
  dir.normalize()
  return dir
}

console.log('movimento no chão')

test('no pitch normal, frente e direita batem com a câmera', () => {
  for (const yaw of [0, 0.7, Math.PI, -1.2]) {
    for (const pitch of [0, 0.4, -0.8, 1.2, -1.4]) {
      const axes = groundMoveAxes(yaw)
      const look = cameraHeading(yaw, pitch)
      const dot = look.x * axes.forwardX + look.z * axes.forwardZ
      assert.ok(dot > 0.99, `yaw ${yaw} pitch ${pitch} dot ${dot}`)
    }
  }
})

test('olhar reto para baixo não inverte o W', () => {
  const yaw = Math.PI
  const level = cameraHeading(yaw, 0)
  const axes = groundMoveAxes(yaw)
  assert.ok(level.z > 0.9)
  assert.ok(axes.forwardZ > 0.9)
  const dot = level.x * axes.forwardX + level.z * axes.forwardZ
  assert.ok(dot > 0.99)
  // O fallback (0, 0, -1) aponta para o lado oposto desse yaw.
  assert.ok(axes.forwardZ > 0)
  assert.ok(-1 * axes.forwardZ < 0)
})

test('olhar reto para cima usa o mesmo rumo do chão', () => {
  const yaw = 1.1
  const level = cameraHeading(yaw, 0)
  const axes = groundMoveAxes(yaw)
  assert.equal(cameraHeading(yaw, Math.PI / 2), null)
  assert.equal(cameraHeading(yaw, -Math.PI / 2), null)
  const dot = level.x * axes.forwardX + level.z * axes.forwardZ
  assert.ok(dot > 0.99)
})

test('frente e direita são unitárias e perpendiculares', () => {
  const axes = groundMoveAxes(0.3)
  const f2 = axes.forwardX ** 2 + axes.forwardZ ** 2
  const r2 = axes.rightX ** 2 + axes.rightZ ** 2
  const dot = axes.forwardX * axes.rightX + axes.forwardZ * axes.rightZ
  assert.ok(Math.abs(f2 - 1) < 1e-9)
  assert.ok(Math.abs(r2 - 1) < 1e-9)
  assert.ok(Math.abs(dot) < 1e-9)
})

console.log('todos os testes passaram')
