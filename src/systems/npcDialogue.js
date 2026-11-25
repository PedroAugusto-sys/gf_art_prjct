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

function spokenTitle(artId) {
  const title = artworkTitle(artId)
  if (!title) return 'esta obra'
  return title.replace(/\s*\(exemplo\)\s*$/i, '').trim() || 'esta obra'
}

function spokenDescription(artId) {
  const live = liveArtwork(artId)
  const text = String(live?.description || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 72 ? `${text.slice(0, 69).trimEnd()}…` : text
}

export function pickPositiveLine(artId) {
  const title = spokenTitle(artId)
  const description = spokenDescription(artId)
  const phrases = [
    `Que cores em "${title}"!`,
    `Olha o traço de "${title}".`,
    `"${title}" me parou.`,
    `Adorei "${title}".`,
  ]
  const phrase = phrases[Math.floor(Math.random() * phrases.length)]
  return description ? `${phrase} ${description}` : phrase
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
