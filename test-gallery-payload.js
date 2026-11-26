#!/usr/bin/env node
/**
 * A imagem da sala vai em pedaços e o site publicado não chama localhost.
 */

import assert from 'node:assert/strict'
import {
  IMAGE_CHUNK,
  galleryHasInlineImages,
  packGallery,
  shouldDiscardSessionArtworks,
  staleImageKeys,
  unpackGallery,
  withoutBuriedArtworks,
} from './src/systems/galleryPayload.js'
import { uploadServerUrl } from './src/systems/uploadServer.js'

function test(name, fn) {
  try {
    fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL  ${name}`)
    throw err
  }
}

console.log('imagem da sala')

test('a ficha não leva o data URL, e os pedaços remontam', () => {
  const dataUrl = `data:image/webp;base64,${'A'.repeat(IMAGE_CHUNK * 2 + 50)}`
  const packed = packGallery({
    annexCount: 1,
    artworks: [{
      id: 'community-1',
      frameId: 'community-1',
      title: 'Teste',
      author: 'Marina',
      dataUrl,
      url: 'http://localhost:3001/uploads/a.webp',
    }],
  })
  assert.equal(packed.meta.artworks[0].dataUrl, undefined)
  assert.equal(packed.meta.artworks[0].url, undefined)
  assert.equal(packed.meta.artworks[0].parts, 3)
  assert.equal(packed.chunks.length, 3)
  assert.ok(packed.chunks.every((chunk) => chunk.value.length <= IMAGE_CHUNK))
  const store = new Map(packed.chunks.map((chunk) => [chunk.key, chunk.value]))
  const back = unpackGallery(packed.meta, (key) => store.get(key))
  assert.equal(back.artworks[0].dataUrl, dataUrl)
  assert.equal(back.artworks[0].title, 'Teste')
  assert.equal(back.artworks[0].parts, undefined)
})

test('pedaço faltando não inventa imagem e não apaga a contagem', () => {
  const packed = packGallery({
    artworks: [{ id: 'a', dataUrl: `data:image/webp;base64,${'B'.repeat(IMAGE_CHUNK + 10)}` }],
  })
  const back = unpackGallery(packed.meta, () => undefined)
  assert.equal(back.artworks[0].dataUrl, undefined)
  assert.equal(back.artworks[0].parts, 2)
})

test('quem ainda não tem a imagem não zera os pedaços dos outros', () => {
  const prev = { artworks: [{ id: 'a', parts: 4 }, { id: 'b', parts: 2 }] }
  const next = packGallery({
    artworks: [
      { id: 'a', parts: 4, title: 'Fica' },
      { id: 'c', dataUrl: 'data:image/webp;base64,CCCC' },
    ],
  })
  assert.equal(next.chunks.length, 1)
  assert.deepEqual(staleImageKeys(prev, next.meta), ['ga:b:0', 'ga:b:1'])
})

test('obra antiga com data URL inteiro ainda abre', () => {
  const dataUrl = 'data:image/webp;base64,AAAA'
  const back = unpackGallery({ artworks: [{ id: 'a', title: 'Velha', dataUrl }] }, () => undefined)
  assert.equal(back.artworks[0].dataUrl, dataUrl)
  assert.equal(galleryHasInlineImages({ artworks: [{ dataUrl }] }), true)
  assert.equal(galleryHasInlineImages({ artworks: [{ id: 'a', parts: 1 }] }), false)
})

test('produção não usa localhost e sem variável não há servidor', () => {
  assert.equal(uploadServerUrl({}), '')
  assert.equal(uploadServerUrl({ VITE_ART_SERVER_URL: 'http://localhost:3001', PROD: true }), '')
  assert.equal(uploadServerUrl({ VITE_UPLOAD_SERVER_URL: 'http://127.0.0.1:3001/', PROD: true }), '')
  assert.equal(uploadServerUrl({ VITE_ART_SERVER_URL: 'http://localhost:3001', PROD: false }), 'http://localhost:3001')
  assert.equal(uploadServerUrl({ VITE_UPLOAD_SERVER_URL: 'https://uploads.example/' }), 'https://uploads.example')
})

test('sala vazia apaga os pedaços da imagem', () => {
  const prev = { artworks: [{ id: 'community-1', parts: 2 }] }
  const next = packGallery({ annexCount: 1, artworks: [] })
  assert.deepEqual(next.meta.artworks, [])
  assert.equal(next.meta.annexCount, 1)
  assert.deepEqual(staleImageKeys(prev, next.meta), ['ga:community-1:0', 'ga:community-1:1'])
})

test('só quem está sozinho descarta a sessão anterior', () => {
  assert.equal(shouldDiscardSessionArtworks({ isHost: true, others: 0 }), true)
  assert.equal(shouldDiscardSessionArtworks({ isHost: true, others: 1 }), false)
  assert.equal(shouldDiscardSessionArtworks({ isHost: false, others: 0 }), false)
  const buried = new Set(['velha'])
  const kept = withoutBuriedArtworks(
    [{ id: 'velha', title: 'Circulo vermelho' }, { id: 'nova', title: 'Agora' }],
    buried,
  )
  assert.deepEqual(kept.map((art) => art.id), ['nova'])
})
