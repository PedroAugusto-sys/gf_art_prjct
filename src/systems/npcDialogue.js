/**
 * Frases curtas que os visitantes dizem parados na frente de uma obra.
 * Várias podem aparecer ao mesmo tempo, com um teto para não virar mural.
 */

import artworksData from '../data/artworks.json' with { type: 'json' }
import { CROWD_QUALITY } from './crowdQuality.js'

const activeUntil = []

/** O mesmo array que a plaquinha lê. Nada fica guardado entre um comentário e o outro. */
function liveArtworks() {
  const store = typeof window !== 'undefined' ? window.useGameStore : null
  const list = store?.getState?.().communityArtworks
  return Array.isArray(list) ? list : []
}

function liveArtwork(artId) {
  const arts = liveArtworks()
  return (
    arts.find((art) => art && art.frameId === artId) ||
    arts.find((art) => art && art.id === artId) ||
    null
  )
}

function catalogArtwork(artId) {
  return artworksData.artworks?.find((art) => art.id === artId) || null
}

/**
 * Título que a plaquinha mostra agora.
 * Obra publicada ou editada na sessão ganha do nome do template.
 */
export function artworkTitle(artId) {
  if (!artId) return null
  const live = liveArtwork(artId)
  if (live) {
    const title = String(live.title || '').trim()
    return title || null
  }
  const fromJson = catalogArtwork(artId)
  const title = fromJson?.title ? String(fromJson.title).trim() : ''
  return title || null
}

function titleKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function spokenTitle(artId) {
  const title = artworkTitle(artId)
  if (!title) return 'esta obra'
  const clean = title.replace(/\s*\(exemplo\)\s*$/i, '').trim()
  // Só o template interno. Um título digitado, mesmo curto, é falado.
  if (!titleKey(clean) || titleKey(clean) === 'titulo da obra') return 'esta obra'
  return clean
}

export function pickPositiveLine(artId) {
  const title = spokenTitle(artId)
  const phrases = [
    `Que cores em "${title}"!`,
    `Gostei muito de "${title}".`,
    `O que será que o artista quis dizer em "${title}"?`,
    `Olha o traço de "${title}".`,
    `Adorei "${title}".`,
  ]
  return phrases[Math.floor(Math.random() * phrases.length)]
}

/** Cabe mais um balão agora? */
export function canStartSpeech(now) {
  while (activeUntil.length && activeUntil[0] <= now) activeUntil.shift()
  return activeUntil.length < CROWD_QUALITY.maxSpeeches
}

export function markSpeechStarted(now, duration = SPEECH_DURATION) {
  activeUntil.push(now + duration)
  activeUntil.sort((a, b) => a - b)
}

export function resetSpeechLimiter() {
  activeUntil.length = 0
}

export const SPEECH_DURATION = 4.2
export const SPEECH_COOLDOWN = 10
export const SPEECH_CHANCE = 0.92
export const SPEECH_DELAY_MIN = 0.6
export const SPEECH_DELAY_MAX = 1.6
