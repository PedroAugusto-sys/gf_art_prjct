#!/usr/bin/env node
/**
 * A câmera acompanha a escala do corpo, e o balão não atravessa a parede.
 */

import assert from 'node:assert/strict'
import { avatarMetrics, firstPersonEyeY } from './src/systems/avatarCamera.js'
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
assert.equal(
  firstPersonEyeY(short.capsuleCenter, shortScale),
  firstPersonEyeY(short.capsuleCenter, shortScale),
)
assert.ok(pointIndoors(0, 8), 'o meio da sala deixou de ser interior')

assert.equal(segmentIndoors(0, 0, 3, 4), true, 'o salão aberto escondeu o balão')
assert.equal(segmentIndoors(0, 4, 0, -30), true, 'o vão do anexo bloqueou o balão')
assert.equal(segmentIndoors(10, 4, 10, -30), false, 'o balão atravessou a parede norte')

resetSpeechLimiter()
const line = pickPositiveLine('obra-01')
assert.match(line, /Noite Estrelada/)
assert.doesNotMatch(line, /exemplo/)

const arts = [{ id: 'sessao-1', frameId: 'obra-01', title: 'Raposa na galeria', description: 'sépia e orelhas' }]
globalThis.window = { useGameStore: { getState: () => ({ communityArtworks: arts }) } }
const edited = Array.from({ length: 40 }, () => pickPositiveLine('obra-01'))
assert.ok(edited.every((phrase) => phrase.includes('Raposa na galeria')))
assert.ok(edited.every((phrase) => !phrase.includes('sépia')))
assert.ok(edited.every((phrase) => !phrase.includes('Noite Estrelada')))
assert.ok(edited.some((phrase) => phrase.includes('Gostei muito')))
assert.ok(edited.some((phrase) => phrase.includes('artista quis')))
arts[0] = { ...arts[0], title: 'Título novo da sessão', description: 'DESCRIÇÃO' }
const renamed = pickPositiveLine('obra-01')
assert.match(renamed, /Título novo da sessão/)
assert.doesNotMatch(renamed, /Raposa|Noite Estrelada|DESCRI/)
arts[0] = { ...arts[0], title: 'Título', description: 'Descrição' }
const literal = Array.from({ length: 12 }, () => pickPositiveLine('obra-01'))
assert.ok(literal.every((phrase) => phrase.includes('"Título"')))
assert.ok(literal.every((phrase) => !phrase.includes('esta obra') && !phrase.includes('Descrição')))
arts[0] = { ...arts[0], title: 'Teste', description: 'notas do quadro' }
const named = Array.from({ length: 40 }, () => pickPositiveLine('obra-01'))
assert.ok(named.every((phrase) => phrase.includes('"Teste"')))
assert.ok(named.every((phrase) => !phrase.includes('notas do quadro')))
assert.ok(named.some((phrase) => phrase.includes('Gostei muito de "Teste"')))
arts[0] = { ...arts[0], title: 'TITULO DA OBRA', description: 'DESCRIÇÃO' }
const placeholder = Array.from({ length: 8 }, () => pickPositiveLine('obra-01'))
assert.ok(placeholder.every((phrase) => phrase.includes('esta obra')))
assert.ok(placeholder.every((phrase) => !/TITULO|DESCRI/i.test(phrase)))
arts[0] = { ...arts[0], title: '   ' }
assert.match(pickPositiveLine('obra-01'), /esta obra/)
assert.doesNotMatch(pickPositiveLine('obra-01'), /Noite Estrelada/)
arts.push({ id: 'vis-1', frameId: 'community-4', title: 'Obra do visitante', description: '' })
assert.match(pickPositiveLine('community-4'), /Obra do visitante/)
delete globalThis.window
assert.match(pickPositiveLine('obra-01'), /Noite Estrelada/)
assert.match(pickPositiveLine('quadro-sem-nome'), /esta obra/)
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
