#!/usr/bin/env node
/**
 * A sala do museu e a sala do Playroom precisam ser a mesma.
 * O SDK lê o hash `r` e descarta o primeiro caractere.
 */

import assert from 'node:assert/strict'
import {
  museumLocationHash,
  normalizeRoomCode,
  readRoomCodeFromLocation,
} from './src/data/versions.js'

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL  ${name}`)
    throw err
  }
}

console.log('sala do multiplayer')

test('?r=gf-museu-v1 é a sala v1', () => {
  assert.equal(readRoomCodeFromLocation({ hash: '', search: '?r=gf-museu-v1' }), 'gf-museu-v1')
})

test('o hash antigo #r=gf-museu-v1 ainda acha a v1', () => {
  assert.equal(readRoomCodeFromLocation({ hash: '#r=gf-museu-v1', search: '' }), 'gf-museu-v1')
})

test('o hash que o Playroom grava descarta o R e cai na mesma sala', () => {
  assert.equal(normalizeRoomCode('Rgf-museu-v1'), 'gf-museu-v1')
  const hash = museumLocationHash('gf-museu-v1')
  const params = new URLSearchParams(hash.slice(1))
  assert.equal(params.get('r'), 'Rgf-museu-v1')
  assert.equal(params.get('r').slice(1), 'gf-museu-v1')
  assert.equal(readRoomCodeFromLocation({ hash, search: '' }), 'gf-museu-v1')
})

test('uma sala cortada pelo SDK não vira outra versão', () => {
  assert.equal(normalizeRoomCode('f-museu-v1'), null)
})

console.log('todos os testes passaram')
