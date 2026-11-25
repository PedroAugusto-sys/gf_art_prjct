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
    // Nascem no estacionamento, alguns fora do vão, como na fachada de vidro.
    const doorX = entrySide * 3.5
    agents.push({
      id: `sim-${i}`,
      entrySide,
      state: createWalker(entrySide),
      position: { x: doorX + (i % 3 - 1) * 1.45, z: 29 - i * 0.4 },
      backward: 0,
      stall: 0,
      maxStall: 0,
      glass: 0,
      entered: false,
      annex1: false,
      annex2: false,
      minX: 99,
      maxX: -99,
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
      if (agent.stall > agent.maxStall) {
        agent.maxStall = agent.stall
        agent.stallAt = {
          x: +agent.position.x.toFixed(2),
          z: +agent.position.z.toFixed(2),
          mode: agent.state.mode,
          route: agent.state.route.length,
        }
      }
      if (agent.position.z < 17) agent.entered = true
      const besideGlass =
        agent.position.z > 18.15 &&
        agent.position.z < 19.8 &&
        Math.abs(Math.abs(agent.position.x) - 3.5) > 1.05
      if (besideGlass) agent.glass += DT
      if (agent.position.z < -21) agent.annex1 = true
      if (agent.position.z < -41) agent.annex2 = true
      if (agent.position.x < agent.minX) agent.minX = agent.position.x
      if (agent.position.x > agent.maxX) agent.maxX = agent.position.x
    }
  }

  return agents
}

const agents = simulate(2)
const backward = agents.reduce((sum, agent) => sum + agent.backward, 0)
const maxStall = Math.max(...agents.map((agent) => agent.maxStall))
const inAnnex = agents.filter((agent) => agent.annex1).length
const inSecond = agents.filter((agent) => agent.annex2).length
const entered = agents.filter((agent) => agent.entered).length
const glass = Math.max(...agents.map((agent) => agent.glass))
const roamed = agents.filter((agent) => agent.maxX - agent.minX > 8).length

console.log('caminhada dos visitantes')
console.log(`  ${COUNT} visitantes, ${SECONDS}s, dt=${DT.toFixed(3)}`)
console.log(`  passos para trás: ${backward}`)
console.log(`  maior tempo preso andando: ${maxStall.toFixed(2)}s`, agents.find((a) => a.maxStall === maxStall)?.stallAt)
console.log(`  entraram na sala: ${entered}/${COUNT}`)
console.log(`  maior tempo no vidro da entrada: ${glass.toFixed(2)}s`)
console.log(`  cruzaram a sala: ${roamed}/${COUNT}`)
console.log(`  chegaram ao anexo 1: ${inAnnex}/${COUNT}`)
console.log(`  chegaram ao anexo 2: ${inSecond}/${COUNT}`)

assert.equal(backward, 0, 'algum passo andou para trás')
assert.ok(maxStall < 4, `preso por ${maxStall.toFixed(2)}s`)
assert.equal(entered, COUNT, 'alguém não passou da porta')
assert.ok(glass < 1.5, `encostado no vidro por ${glass.toFixed(2)}s`)
assert.ok(roamed >= COUNT - 1, 'quase ninguém atravessou a sala')
assert.ok(inAnnex >= COUNT - 1, 'quase ninguém entrou no anexo')
assert.ok(inSecond >= 2, 'o segundo anexo ficou vazio')

setWalkAnnexCount(0)
resetCrowd()
console.log('todos os testes passaram')
