#!/usr/bin/env node
/**
 * A imagem publicada chega no quadro como data URL, sem CORS,
 * e cabe inteira no quadro, com passe-partout, sem esticar.
 */

import assert from 'node:assert/strict'
import {
  artworkImageSources,
  containRect,
  isExampleArtwork,
  textureRequest,
} from './src/systems/frameTexture.js'

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL  ${name}`)
    throw err
  }
}

console.log('textura do quadro')

test('o data URL vem antes da URL do servidor', () => {
  const sources = artworkImageSources({
    url: 'http://localhost:3001/uploads/a.webp',
    dataUrl: 'data:image/webp;base64,AAAA',
  })
  assert.equal(sources[0], 'data:image/webp;base64,AAAA')
  assert.equal(sources[1], 'http://localhost:3001/uploads/a.webp')
})

test('data URL não pede CORS', () => {
  const data = textureRequest('data:image/webp;base64,AAAA')
  assert.equal(data.crossOrigin, null)
  assert.equal(data.src, 'data:image/webp;base64,AAAA')
  const remote = textureRequest('https://cdn.example/obra.webp')
  assert.equal(remote.crossOrigin, 'anonymous')
  const local = textureRequest('/assets/artworks/obra-01.jpg')
  assert.equal(local.src, '/assets/artworks/obra-01.jpg')
  assert.equal(local.crossOrigin, null)
})

test('imagem larga cabe inteira, com tarja em cima e embaixo', () => {
  const wide = containRect(800, 200, 2, 1.5)
  assert.equal(wide.w, 2)
  assert.ok(wide.h < 1.5)
  assert.ok(wide.y > 0)
  assert.equal(wide.x, 0)
  const tall = containRect(200, 800, 2, 1.5)
  assert.equal(tall.h, 1.5)
  assert.ok(tall.w < 2)
  assert.ok(tall.x > 0)
  assert.equal(tall.y, 0)
})

test('quadro de exemplo é publicável e obra de visitante não', () => {
  assert.equal(isExampleArtwork({ id: 'obra-01', example: true, title: 'A Noite (exemplo)' }), true)
  assert.equal(isExampleArtwork({ id: 'community-1', title: 'dad', author: 'teste' }), false)
})

console.log('todos os testes passaram')
