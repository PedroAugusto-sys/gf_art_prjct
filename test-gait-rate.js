#!/usr/bin/env node
/**
 * A passada longe tem a mesma cadência da passada perto.
 * O desenho pode pular quadros; a fase não.
 */

import assert from 'node:assert/strict'
import { advanceGait, gaitPose, STEP_HZ, STRIDE_LENGTH } from './src/systems/gait.js'

const FPS = 60
const SECONDS = 12
const WALK_SPEED = 1.2
const FRAMES = FPS * SECONDS

function apoiosPorSegundo(throttle) {
  let phase = 0
  let last = 0
  let crossings = 0
  const dt = 1 / FPS
  for (let i = 1; i <= FRAMES; i++) {
    phase = advanceGait(phase, { walking: true, moved: WALK_SPEED * dt, dt })
    if (i % throttle !== 0) continue
    const sign = gaitPose(phase, true).leftLegX >= 0 ? 1 : -1
    if (last !== 0 && sign !== last) crossings += 1
    last = sign
  }
  return crossings / SECONDS
}

const perto = apoiosPorSegundo(1)
const longe = apoiosPorSegundo(6)

console.log('cadência da passada')
console.log(`  perto: ${perto.toFixed(2)} apoios/s`)
console.log(`  longe (pose a cada 6 quadros): ${longe.toFixed(2)} apoios/s`)

assert.ok(perto >= 1.5 && perto <= 2, `perto fora de 1,5–2: ${perto}`)
assert.ok(longe >= 1.5 && longe <= 2, `longe fora de 1,5–2: ${longe}`)
assert.ok(Math.abs(perto - longe) < 0.08, `perto ${perto} e longe ${longe} divergem`)
assert.ok(Math.abs(perto - STEP_HZ) < 0.08)
assert.equal(STRIDE_LENGTH * STEP_HZ, WALK_SPEED)

let parado = 0
for (let i = 0; i < FPS; i++) {
  parado = advanceGait(parado, { walking: true, moved: 0, dt: 1 / FPS })
}
assert.equal(parado, 0, 'sem deslocamento a perna não gira')

let idle = 0
for (let i = 0; i < FPS; i++) {
  idle = advanceGait(idle, { walking: false, moved: WALK_SPEED / FPS, dt: 1 / FPS })
}
assert.ok(Math.abs(idle - 1.6) < 1e-9, 'parado usa o tempo, não o metro andado')

const salto = advanceGait(0, { walking: true, moved: 8, dt: 0.5 })
assert.ok(salto <= Math.PI + 1e-9, 'um teleporte não dispara a passada')

console.log('todos os testes passaram')
