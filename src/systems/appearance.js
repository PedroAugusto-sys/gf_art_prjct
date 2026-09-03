/**
 * Aparencia procedural compartilhada entre jogador e NPCs.
 */

const SKIN_TONES = [
  '#f5e0c8', '#e8c9a0', '#d4a97a', '#c4a484', '#b08968',
  '#9c6a45', '#8d5a3b', '#6f4526', '#5a3220', '#3d1f10',
]
const HAIR_COLORS = [
  '#1a1008', '#2c1b10', '#4a3520', '#5a3f28', '#6b4c31',
  '#8a6040', '#a07048', '#c8a870', '#d4c090', '#f0e8d0',
  '#0a0a0a', '#151515', '#303030',
]
const SHIRT_COLORS = [
  '#4a6fa5', '#a8574a', '#5c6b4a', '#d8cfc0', '#7a5c8f',
  '#4f8073', '#2f4858', '#c2703d', '#5b6c8c', '#8c6f9e',
  '#b03a2e', '#1a5276', '#1e8449', '#784212', '#6e2f6e',
  '#2e4057', '#e8b86d', '#a45a52', '#5d8aa8', '#8b7355',
]
const PANTS_COLORS = [
  '#2f3340', '#3a3f4a', '#44506b', '#3f3f46', '#33383f',
  '#2c2f36', '#1a1a2e', '#4a3525', '#5a4030', '#3d3d3d',
]
const SHOES_COLORS = ['#1f1f1f', '#2b2420', '#222222', '#1a1a1a', '#2b2b2b', '#3a2a1a']
const OUTFITS = ['shirt', 'shirt', 'shirt', 'dress', 'coat']

const VISITOR_NAMES = [
  'Ana', 'Lucas', 'Marina', 'Rafael', 'Beatriz', 'Pedro', 'Camila', 'João',
  'Sofia', 'Gabriel', 'Larissa', 'Thiago', 'Julia', 'Felipe', 'Amanda', 'Bruno',
  'Carolina', 'Diego', 'Isabela', 'Mateus', 'Nina', 'Otávio', 'Paula', 'Renato',
]

const HEIGHT_MIN = 1.55
const HEIGHT_MAX = 1.95
const MODEL_BASE_HEIGHT = 1.82

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomVisitorName() {
  return randomFrom(VISITOR_NAMES)
}

/** Trim, 2–16 chars, sem tags HTML. */
export function sanitizeNick(str) {
  if (typeof str !== 'string') return ''
  const cleaned = str.replace(/<[^>]*>/g, '').trim().slice(0, 16)
  return cleaned.length >= 2 ? cleaned : ''
}

/**
 * Gera aparencia + escala aleatorias.
 * @returns {{ appearance, outfit, scale, height }}
 */
export function generateAppearance() {
  const shirtColor = randomFrom(SHIRT_COLORS)
  const outfit = randomFrom(OUTFITS)
  const pantsColor = outfit === 'dress' ? shirtColor : randomFrom(PANTS_COLORS)
  const height = HEIGHT_MIN + Math.random() * (HEIGHT_MAX - HEIGHT_MIN)
  const scaleY = height / MODEL_BASE_HEIGHT
  const scaleXZ = 0.93 + Math.random() * 0.14

  return {
    appearance: {
      skin: randomFrom(SKIN_TONES),
      hair: randomFrom(HAIR_COLORS),
      shirt: shirtColor,
      pants: pantsColor,
      shoes: randomFrom(SHOES_COLORS),
    },
    outfit,
    scale: [scaleXZ, scaleY, scaleXZ],
    height,
  }
}

export const DEFAULT_APPEARANCE = {
  skin: '#c4a484',
  hair: '#2c1b10',
  shirt: '#6b7280',
  pants: '#3f3f46',
  shoes: '#1f1f1f',
}
