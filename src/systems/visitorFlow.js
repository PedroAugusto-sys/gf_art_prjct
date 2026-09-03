/**
 * Fluxo de visitantes: spawn, vida util e despawn.
 *
 * - Novo visitante entra pela porta a cada SPAWN_INTERVAL segundos (aleatorio).
 * - Cada visitante tem uma vida util de LIFESPAN_MIN..LIFESPAN_MAX segundos.
 * - Quando a vida expira o NPC entra em modo 'leaving': caminha ate a saida,
 *   some assim que chega perto da porta (sem efeito visual pesado).
 * - O numero de visitantes simutaneos nunca passa de MAX_VISITORS.
 * - Destruir um NPC libera sua vaga e materiais imediatamente.
 */

import { create } from 'zustand'

// ---------- Paletas aleatorias ----------
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

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ---------- Limites de altura (em metros, referente ao modelo base ~1.8 m) ----------
// A escala vertical (scaleY) e calculada a partir da altura desejada.
// O modelo base mede aproximadamente 1.82 m com scaleY = 1.
const HEIGHT_MIN = 1.55   // m  (pessoa baixa)
const HEIGHT_MAX = 1.95   // m  (pessoa alta)
const MODEL_BASE_HEIGHT = 1.82  // m com scale = 1

function randomHeight() {
  return HEIGHT_MIN + Math.random() * (HEIGHT_MAX - HEIGHT_MIN)
}

function generateVisitor(id) {
  const shirtColor = randomFrom(SHIRT_COLORS)
  const outfit = randomFrom(OUTFITS)
  const pantsColor = outfit === 'dress' ? shirtColor : randomFrom(PANTS_COLORS)

  const height = randomHeight()
  const scaleY = height / MODEL_BASE_HEIGHT
  // Escala horizontal levemente independente para variacao de biotipo
  const scaleXZ = 0.93 + Math.random() * 0.14  // 0.93 .. 1.07

  const entrySide = Math.random() < 0.5 ? -1 : 1
  const doorX = entrySide < 0 ? -3.5 : 3.5

  return {
    id,
    key: id,
    appearance: {
      skin: randomFrom(SKIN_TONES),
      hair: randomFrom(HAIR_COLORS),
      shirt: shirtColor,
      pants: pantsColor,
      shoes: randomFrom(SHOES_COLORS),
    },
    outfit,
    // scaleX/scaleZ = biotipo, scaleY = altura
    scale: [scaleXZ, scaleY, scaleXZ],
    height,   // mantido para debug / UI futura
    // Lado de entrada: -1 = porta esquerda, +1 = porta direita
    entrySide,
    // Posicao de nascimento no estacionamento.
    // Criada UMA unica vez aqui: se fosse calculada no render do componente,
    // cada re-render geraria um novo array e o R3F reaplicaria a posicao,
    // teleportando o visitante de volta para a porta.
    spawn: [doorX + (Math.random() - 0.5) * 2.6, 0, 27 + Math.random() * 7],
  }
}

// ---------- Configuracao ----------
export const MAX_VISITORS = 5        // maximo simultaneo (era 8, cada NPC = ~8 draw calls + logica)
export const SPAWN_INTERVAL_MIN = 10 // segundos entre cada entrada
export const SPAWN_INTERVAL_MAX = 18
export const LIFESPAN_MIN = 60       // quanto tempo um visitante fica na galeria
export const LIFESPAN_MAX = 120

// ---------- Store Zustand (fora do Canvas, re-renderiza apenas a lista de NPCs) ----------
let uidCounter = 1

export const useVisitorStore = create((set, get) => ({
  // Visitantes ativos (dentro da galeria, incluindo quem esta saindo)
  visitors: [],

  // Tempo de simulacao atual (atualizado pelo ticker)
  _nextSpawn: 0,
  _initialized: false,

  init(now) {
    const state = get()
    if (state._initialized) return
    // Pre-popula com alguns visitantes para a galeria nao aparecer vazia
    const initial = []
    for (let i = 0; i < 2; i++) {
      const v = generateVisitor(`v-${uidCounter++}`)
      initial.push({
        ...v,
        spawnedAt: now - Math.random() * (LIFESPAN_MIN * 0.6),
        lifespan: LIFESPAN_MIN + Math.random() * (LIFESPAN_MAX - LIFESPAN_MIN),
        leaving: false,
      })
    }
    set({
      visitors: initial,
      _nextSpawn: now + SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN),
      _initialized: true,
    })
  },

  /** Chamado a cada frame com o tempo atual do relogio da cena. */
  tick(now) {
    const { visitors, _nextSpawn } = get()
    let changed = false
    let next = _nextSpawn

    // 1) Marcar quem deve sair (vida expirou e ainda nao esta saindo)
    const updated = visitors.map((v) => {
      if (!v.leaving && now - v.spawnedAt >= v.lifespan) {
        changed = true
        return { ...v, leaving: true }
      }
      return v
    })

    // 2) Spawn de novo visitante
    const inside = updated.filter((v) => !v.leaving).length
    if (now >= _nextSpawn && inside < MAX_VISITORS) {
      const v = generateVisitor(`v-${uidCounter++}`)
      updated.push({
        ...v,
        spawnedAt: now,
        lifespan: LIFESPAN_MIN + Math.random() * (LIFESPAN_MAX - LIFESPAN_MIN),
        leaving: false,
      })
      next = now + SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN)
      changed = true
    }

    if (changed || next !== _nextSpawn) {
      set({ visitors: updated, _nextSpawn: next })
    }
  },

  /** O NPC chama isso assim que sai pela porta; o React remove o elemento. */
  despawn(id) {
    set((s) => ({ visitors: s.visitors.filter((v) => v.id !== id) }))
  },
}))
