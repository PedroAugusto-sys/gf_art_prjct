#!/usr/bin/env node
/**
 * A câmera acompanha a escala do corpo, e o balão não atravessa a parede.
 */

import assert from 'node:assert/strict'
import { avatarMetrics, firstPersonEyeY, thirdPersonRig } from './src/systems/avatarCamera.js'
import { pointIndoors, segmentIndoors } from './src/systems/roomClearance.js'
import { pickPositiveLine, resetSpeechLimiter, canStartSpeech, markSpeechStarted } from './src/systems/npcDialogue.js'

const shortScale = [0.9, 0.8, 0.9]
const tallScale = [1.15, 1.4, 1.15]
const short = avatarMetrics(shortScale)
const tall = avatarMetrics(tallScale)

const shortEye = firstPersonEyeY(short.capsuleCenter, shortScale)
const tallEye = firstPersonEyeY(tall.capsuleCenter, tallScale)

console.log('câmera do visitante')
console.log(`  olhos baixos: ${shortEye.toFixed(2)} m, altos: ${tallEye.toFixed(2)} m`)
assert.ok(shortEye > 1.15 && shortEye < 1.6, 'olho baixo fora do corpo')
assert.ok(tallEye > shortEye + 0.4, 'o corpo alto não levantou a câmera')
assert.ok(Math.abs(shortEye - short.eyeAboveFeet) < 0.001, 'pés no chão, olho acima deles')

const shortRig = thirdPersonRig(0, 0, 8, 0, shortScale)
const tallRig = thirdPersonRig(0, 0, 8, 0, tallScale)
const gap = (rig) => Math.hypot(rig.camera.x, rig.camera.z - 8)
console.log(`  distância 3ª pessoa: baixa ${gap(shortRig).toFixed(2)} m, alta ${gap(tallRig).toFixed(2)} m`)
assert.ok(gap(tallRig) > gap(shortRig) + 0.4, 'a câmera não se afastou do corpo alto')
assert.ok(tallRig.look.y > shortRig.look.y + 0.4, 'a mira não subiu com a cabeça')
assert.ok(pointIndoors(shortRig.camera.x, shortRig.camera.z), 'câmera saiu da sala no meio do salão')

const againstWall = thirdPersonRig(0, 0, 17.2, 0, [1, 1, 1])
console.log(`  câmera perto da fachada: z=${againstWall.camera.z.toFixed(2)}`)
assert.ok(againstWall.camera.z < 18.7, 'a câmera atravessou a parede sul')
assert.ok(pointIndoors(againstWall.camera.x, againstWall.camera.z), 'a câmera ficou dentro da alvenaria')

assert.equal(segmentIndoors(0, 0, 3, 4), true, 'o salão aberto escondeu o balão')
assert.equal(segmentIndoors(0, 4, 0, -30), true, 'o vão do anexo bloqueou o balão')
assert.equal(segmentIndoors(10, 4, 10, -30), false, 'o balão atravessou a parede norte')

resetSpeechLimiter()
const line = pickPositiveLine('obra-01')
assert.match(line, /Noite Estrelada|cores|traço|parou|Adorei/)
let started = 0
for (let i = 0; i < 6; i++) {
  if (canStartSpeech(i * 0.01)) {
    markSpeechStarted(i * 0.01, 5)
    started += 1
  }
}
assert.equal(started, 4, 'passou do teto de balões')
console.log('  frase:', line)
console.log('todos os testes passaram')
