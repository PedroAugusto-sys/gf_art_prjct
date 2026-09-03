/**
 * Frases positivas curtas que os NPCs dizem ao observar obras.
 */

const POSITIVE_LINES = [
  'Que obra linda.',
  'Isso me acalmou.',
  'Que cores incríveis.',
  'Adorei este detalhe.',
  'Muito emocionante.',
  'Que composição bela.',
  'Fiquei sem palavras.',
  'Simplesmente maravilhoso.',
  'Que luz especial.',
  'Vale a visita.',
  'Que talento!',
  'Me fez pensar.',
]

let lastGlobalSpeechAt = -999
const GLOBAL_SPEECH_GAP = 8 // s entre falas de qualquer NPC na cena

export function pickPositiveLine() {
  return POSITIVE_LINES[Math.floor(Math.random() * POSITIVE_LINES.length)]
}

/** Pode algum NPC falar agora? (no máximo 1 fala ativa na cena) */
export function canStartSpeech(now) {
  return now - lastGlobalSpeechAt >= GLOBAL_SPEECH_GAP
}

export function markSpeechStarted(now) {
  lastGlobalSpeechAt = now
}

export const SPEECH_DURATION = 4.5
export const SPEECH_COOLDOWN = 12
export const SPEECH_CHANCE = 0.4
export const SPEECH_DELAY_MIN = 1.5
export const SPEECH_DELAY_MAX = 3
