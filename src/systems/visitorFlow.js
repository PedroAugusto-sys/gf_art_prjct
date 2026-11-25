/**
 * Fluxo de visitantes: spawn, vida util e despawn (somente no host).
 */

import { create } from 'zustand'
import { generateAppearance, randomVisitorName } from './appearance'
import { crowdLimit } from './crowdQuality'
import { nearestWalkable } from './navgrid'
import { useGameStore } from '../store'

const INSIDE_SEEDS = [
  [0, 0], [-6, 3], [6, -3], [-3, 9], [4, -9], [-8, -7],
  [8, 7], [0, -11], [-10, 5], [10, -5], [2, 6], [-2, -5],
  [5, 11], [-5, 12], [11, 2], [-11, -2],
]

function generateVisitor(id, index = 0) {
  const { appearance, outfit, scale, height } = generateAppearance()
  const entrySide = index % 2 === 0 ? -1 : 1
  const doorX = entrySide < 0 ? -3.5 : 3.5
  const lane = (index % 6) - 2.5

  return {
    id,
    key: id,
    name: randomVisitorName(),
    appearance,
    outfit,
    scale,
    height,
    entrySide,
    // O vão tem 2,1 m. Nascer fora dele faz o corpo ir de encontro ao vidro.
    spawn: [doorX + lane * 0.28, 0, 24 + (index % 10) * 0.85],
  }
}

function indoorSpawn(index) {
  const seed = INSIDE_SEEDS[index % INSIDE_SEEDS.length]
  const spot = nearestWalkable(seed[0], seed[1])
  return [spot.x, 0, spot.z]
}

export const MAX_VISITORS = 26
export const SPAWN_INTERVAL_MIN = 2
export const SPAWN_INTERVAL_MAX = 4.5
export const LIFESPAN_MIN = 160
export const LIFESPAN_MAX = 280

function visitorCap() {
  try {
    return crowdLimit(!!useGameStore.getState().isMobile)
  } catch {
    return MAX_VISITORS
  }
}

let uidCounter = 1

export const useVisitorStore = create((set, get) => ({
  visitors: [],
  _nextSpawn: 0,
  _initialized: false,

  init(now) {
    const state = get()
    if (state._initialized) return
    const initial = []
    const starters = Math.min(14, visitorCap())
    for (let i = 0; i < starters; i++) {
      const v = generateVisitor(`v-${uidCounter++}`, i)
      initial.push({
        ...v,
        spawn: indoorSpawn(i),
        entrySide: i % 2 === 0 ? -1 : 1,
        spawnedAt: now - Math.random() * 20,
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

  /** Restaura visitantes a partir de um snapshot (quando este cliente vira host). */
  hydrateFromSnapshot(snapshot, now) {
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      get().init(now)
      return
    }
    const visitors = snapshot.map((s) => ({
      id: s.id,
      key: s.id,
      name: s.name || randomVisitorName(),
      appearance: s.appearance,
      outfit: s.outfit || 'shirt',
      scale: s.scale || [1, 1, 1],
      height: 1.75,
      entrySide: s.x < 0 ? -1 : 1,
      spawn: [s.x ?? 0, 0, s.z ?? 12],
      spawnedAt: now,
      lifespan: LIFESPAN_MIN + Math.random() * (LIFESPAN_MAX - LIFESPAN_MIN),
      leaving: false,
      _bootPose: { x: s.x, z: s.z, yaw: s.yaw || 0 },
    }))
    set({
      visitors,
      _nextSpawn: now + SPAWN_INTERVAL_MIN,
      _initialized: true,
    })
  },

  tick(now) {
    const { visitors, _nextSpawn } = get()
    let changed = false
    let next = _nextSpawn

    const updated = visitors.map((v) => {
      if (!v.leaving && now - v.spawnedAt >= v.lifespan) {
        changed = true
        return { ...v, leaving: true }
      }
      return v
    })

    const inside = updated.filter((v) => !v.leaving).length
    if (now >= _nextSpawn && inside < visitorCap()) {
      const v = generateVisitor(`v-${uidCounter++}`, inside)
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

  despawn(id) {
    set((s) => ({ visitors: s.visitors.filter((v) => v.id !== id) }))
  },

  reset() {
    uidCounter = 1
    set({ visitors: [], _nextSpawn: 0, _initialized: false })
  },
}))
