#!/usr/bin/env node
/**
 * Expansão da galeria e passo dos braços.
 * Não sobe o servidor de uploads nem o Playroom.
 */

import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  MAX_ANNEXES,
  annexFrameZs,
  annexRoomBounds,
  frameIsOpen,
  mergeAnnexCount,
  nextAnnexCount,
} from './src/systems/galleryExpansion.js'
import artworksData from './src/data/artworks.json' with { type: 'json' }
import { ANNEX_CORRIDOR_WIDTH, getCommunityFrameLayouts } from './src/data/museumLayout.js'
import { gaitPose } from './src/systems/gait.js'

function limbTipZ(hipY, hipRotX, jointY, jointRotX, tipY, tipZ = 0) {
  const root = new THREE.Group()
  const hip = new THREE.Group()
  hip.position.y = hipY
  hip.rotation.x = hipRotX
  const joint = new THREE.Group()
  joint.position.y = jointY
  joint.rotation.x = jointRotX
  const tip = new THREE.Group()
  tip.position.set(0, tipY, tipZ)
  joint.add(tip)
  hip.add(joint)
  root.add(hip)
  root.updateWorldMatrix(true, true)
  return tip.getWorldPosition(new THREE.Vector3()).z
}

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

function coversDoor(frame) {
  const [x, , z] = frame.position
  const halfW = (frame.size?.[0] ?? 2) / 2
  return [-HALF_D, -HALF_D - ANNEX_DEPTH].some(
    (doorZ) => Math.abs(z - doorZ) < 1.5 && Math.abs(x) < ANNEX_CORRIDOR_WIDTH / 2 + halfW
  )
}

test('nenhum quadro fica no vão do corredor', () => {
  const frames = [...artworksData.artworks, ...getCommunityFrameLayouts(MAX_ANNEXES)]
  const blocking = frames.filter(coversDoor).map((frame) => frame.id)
  assert.deepEqual(blocking, [])
})

test('quadro de anexo só aparece depois que a sala abre', () => {
  assert.equal(frameIsOpen('community-1', 0), true)
  assert.equal(frameIsOpen('annex1-1', 0), false)
  assert.equal(frameIsOpen('annex1-1', 1), true)
  assert.equal(frameIsOpen('annex2-4', 1), false)
  assert.equal(frameIsOpen('annex2-4', 2), true)
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

test('braço esquerdo vai à frente junto com a perna direita', () => {
  const pose = gaitPose(Math.PI / 2, true)
  const leftFoot = limbTipZ(0.9, pose.leftLegX, -0.45, pose.leftKneeX, -0.38, 0.06)
  const rightFoot = limbTipZ(0.9, pose.rightLegX, -0.45, pose.rightKneeX, -0.38, 0.06)
  const leftHand = limbTipZ(1.43, pose.leftArmX, -0.25, pose.leftElbowX, -0.25)
  const rightHand = limbTipZ(1.43, pose.rightArmX, -0.25, pose.rightElbowX, -0.25)
  assert.ok(rightFoot > leftFoot, 'perna direita à frente')
  assert.ok(leftHand > rightHand, 'braço esquerdo à frente')
  assert.ok(leftHand > 0, 'mão esquerda na frente do tronco')
  assert.ok(rightFoot > 0, 'pé direito na frente do tronco')

  const other = gaitPose(-Math.PI / 2, true)
  const leftFootBack = limbTipZ(0.9, other.leftLegX, -0.45, other.leftKneeX, -0.38, 0.06)
  const rightFootBack = limbTipZ(0.9, other.rightLegX, -0.45, other.rightKneeX, -0.38, 0.06)
  const leftHandBack = limbTipZ(1.43, other.leftArmX, -0.25, other.leftElbowX, -0.25)
  const rightHandBack = limbTipZ(1.43, other.rightArmX, -0.25, other.rightElbowX, -0.25)
  assert.ok(leftFootBack > rightFootBack)
  assert.ok(rightHandBack > leftHandBack)
})

test('em repouso os braços continuam opostos às pernas, com amplitude pequena', () => {
  const idle = gaitPose(Math.PI / 2, false)
  assert.ok(Math.abs(idle.leftArmX) < 0.1)
  assert.ok(idle.leftArmX < 0)
  assert.ok(idle.leftLegX > 0)
})

console.log('todos os testes passaram')
