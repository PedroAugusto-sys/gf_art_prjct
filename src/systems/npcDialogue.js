/**
 * Frases curtas que os visitantes dizem parados na frente de uma obra.
 * Várias podem aparecer ao mesmo tempo, com um teto para não virar mural.
 */

import artworksData from '../data/artworks.json' with { type: 'json' }
import { CROWD_QUALITY } from './crowdQuality.js'

const POSITIVE_LINES = [
  'Que cores lindas!',
  'Olha esse traço...',
  'Que composição.',
  'Isso me acalmou.',
  'Adorei este detalhe.',
  'Fiquei sem palavras.',
  'Que luz nessa tela.',
  'Me fez parar.',
  'Bonito demais.',
  'Olha a textura.',
  'Queria ver de perto.',
  'Que obra forte.',
  'Me fez pensar.',
  'Vale a visita.',
]

const activeUntil = []

function communityTitle(artId) {
  const store = typeof window !== 'undefined' ? window.useGameStore : null
  if (!store) return null
  const arts = store.getState().communityArtworks || []
  const found = arts.find((art) => art && (art.id === artId || art.frameId === artId))
  return found?.title || null
}

export function artworkTitle(artId) {
  if (!artId) return null
  const fromJson = artworksData.artworks?.find((art) => art.id === artId)
  if (fromJson?.title) return fromJson.title
  return communityTitle(artId)
}

export function pickPositiveLine(artId) {
  const title = artworkTitle(artId)
  const clean = title ? String(title).replace(/\s*\(exemplo\)\s*$/i, '') : ''
  if (clean) {
    const phrases = [
      `Que cores em "${clean}"!`,
      `Olha o traço de "${clean}".`,
      `"${clean}" me parou.`,
      `Adorei "${clean}".`,
    ]
    return phrases[Math.floor(Math.random() * phrases.length)]
  }
  return POSITIVE_LINES[Math.floor(Math.random() * POSITIVE_LINES.length)]
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
