#!/usr/bin/env node
/**
 * Uma multidão anda, para na frente das obras e não gruda na parede.
 * O tempo do passo cabe em um frame.
 */

import assert from 'node:assert/strict'
import { setWalkAnnexCount } from './src/systems/navgrid.js'
import { nearestWalkable } from './src/systems/navgrid.js'
import { resetCrowd, setCrowdAnnexCount } from './src/systems/crowd.js'
import { createWalker, tickWalker } from './src/systems/npcLocomotion.js'
import { resetSpeechLimiter } from './src/systems/npcDialogue.js'

const DT = 1 / 30
const SECONDS = 90
const STEPS = Math.round(SECONDS / DT)
const COUNT = 24
const SEEDS = [
  [0, 0], [-6, 3], [6, -3], [-3, 9], [4, -9], [-8, -7],
  [8, 7], [0, -11], [-10, 5], [10, -5], [2, 6], [-2, -5],
  [5, 11], [-5, 12], [11, 2], [-11, -2], [0, 8], [-4, -12],
  [7, 4], [-7, 11], [3, -6], [-9, 9], [9, -9], [1, 14],
]

setWalkAnnexCount(2)
setCrowdAnnexCount(2)
resetCrowd()
setCrowdAnnexCount(2)
resetSpeechLimiter()

const agents = []
for (let i = 0; i < COUNT; i++) {
  const entrySide = i % 2 === 0 ? -1 : 1
  const seed = SEEDS[i]
  const spot = nearestWalkable(seed[0], seed[1])
  agents.push({
    id: `crowd-${i}`,
    entrySide,
    state: createWalker(entrySide),
    position: { x: spot.x, z: spot.z },
    backward: 0,
    stall: 0,
    maxStall: 0,
    viewed: 0,
    spoke: false,
  })
}

const started = performance.now()
let maxOnOneArt = 0
for (let step = 0; step < STEPS; step++) {
  const time = step * DT
  const onArt = new Map()
  for (const agent of agents) {
    const beforeX = agent.position.x
    const beforeZ = agent.position.z
    const result = tickWalker(agent.state, agent.position, DT, time, {
      npcId: agent.id,
      leaving: false,
      entrySide: agent.entrySide,
    })
    const dx = agent.position.x - beforeX
    const dz = agent.position.z - beforeZ
    const moved = Math.hypot(dx, dz)
    if (result.faceX !== null && moved > 0.012) {
      const forward = dx * result.faceX + dz * result.faceZ
      if (forward < -0.008) agent.backward += 1
    }
    if ((result.moving || result.blocked) && moved < 0.004) agent.stall += DT
    else agent.stall = 0
    if (agent.stall > agent.maxStall) agent.maxStall = agent.stall
    if (agent.state.mode === 'viewing') {
      agent.viewed += DT
      if (agent.state.lastArtId) {
        onArt.set(agent.state.lastArtId, (onArt.get(agent.state.lastArtId) || 0) + 1)
      }
    }
    if (agent.state.speechText) agent.spoke = true
  }
  for (const count of onArt.values()) {
    if (count > maxOnOneArt) maxOnOneArt = count
  }
}
const elapsed = performance.now() - started
const frameMs = elapsed / STEPS
const viewed = agents.filter((agent) => agent.viewed > 3).length
const spoke = agents.filter((agent) => agent.spoke).length
const backward = agents.reduce((sum, agent) => sum + agent.backward, 0)
const maxStall = Math.max(...agents.map((agent) => agent.maxStall))

console.log('multidão de visitantes')
console.log(`  ${COUNT} visitantes, ${SECONDS}s, simulação ${elapsed.toFixed(0)} ms (${frameMs.toFixed(3)} ms/frame)`)
console.log(`  passos para trás: ${backward}`)
console.log(`  maior travada: ${maxStall.toFixed(2)}s`)
console.log(`  pararam numa obra (>3s): ${viewed}/${COUNT}`)
console.log(`  comentaram: ${spoke}/${COUNT}`)
console.log(`  máximo na mesma obra: ${maxOnOneArt}`)

assert.equal(backward, 0, 'algum passo andou para trás')
assert.ok(maxStall < 4, `preso por ${maxStall.toFixed(2)}s`)
assert.ok(viewed >= COUNT - 4, 'quase ninguém parou para ver uma obra')
assert.ok(spoke >= 8, 'quase ninguém comentou a obra')
assert.ok(maxOnOneArt <= 2, 'mais de dois visitantes na mesma obra')
assert.ok(frameMs < 2, `o passo da multidão passou de 2 ms (${frameMs.toFixed(3)})`)

setWalkAnnexCount(0)
resetCrowd()
console.log('todos os testes passaram')
