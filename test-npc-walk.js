#!/usr/bin/env node
/**
 * Vários visitantes por alguns minutos de simulação.
 * Ninguém anda para trás, ninguém fica preso na parede,
 * e os anexos abertos recebem gente.
 */

import assert from 'node:assert/strict'
import { setWalkAnnexCount } from './src/systems/navgrid.js'
import { resetCrowd, setCrowdAnnexCount } from './src/systems/crowd.js'
import { createWalker, tickWalker } from './src/systems/npcLocomotion.js'

const DT = 1 / 30
const SECONDS = 180
const STEPS = Math.round(SECONDS / DT)
const COUNT = 6

function simulate(annexCount) {
  setWalkAnnexCount(annexCount)
  setCrowdAnnexCount(annexCount)
  resetCrowd()
  setCrowdAnnexCount(annexCount)

  const agents = []
  for (let i = 0; i < COUNT; i++) {
    const entrySide = i % 2 === 0 ? -1 : 1
    agents.push({
      id: `sim-${i}`,
      entrySide,
      state: createWalker(entrySide),
      position: { x: entrySide * 3.2, z: 6 - (i % 3) * 3 },
      backward: 0,
      stall: 0,
      maxStall: 0,
      annex1: false,
      annex2: false,
    })
  }

  for (let step = 0; step < STEPS; step++) {
    const time = step * DT
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
      if (agent.position.z < -21) agent.annex1 = true
      if (agent.position.z < -41) agent.annex2 = true
    }
  }

  return agents
}

const agents = simulate(2)
const backward = agents.reduce((sum, agent) => sum + agent.backward, 0)
const maxStall = Math.max(...agents.map((agent) => agent.maxStall))
const inAnnex = agents.filter((agent) => agent.annex1).length
const inSecond = agents.filter((agent) => agent.annex2).length

console.log('caminhada dos visitantes')
console.log(`  ${COUNT} visitantes, ${SECONDS}s, dt=${DT.toFixed(3)}`)
console.log(`  passos para trás: ${backward}`)
console.log(`  maior tempo preso andando: ${maxStall.toFixed(2)}s`)
console.log(`  chegaram ao anexo 1: ${inAnnex}/${COUNT}`)
console.log(`  chegaram ao anexo 2: ${inSecond}/${COUNT}`)

assert.equal(backward, 0, 'algum passo andou para trás')
assert.ok(maxStall < 4, `preso por ${maxStall.toFixed(2)}s`)
assert.ok(inAnnex >= COUNT - 1, 'quase ninguém entrou no anexo')
assert.ok(inSecond >= 2, 'o segundo anexo ficou vazio')

setWalkAnnexCount(0)
resetCrowd()
console.log('todos os testes passaram')
