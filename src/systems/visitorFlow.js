/**
 * Fluxo de visitantes: spawn, vida util e despawn (somente no host).
 */

import { create } from 'zustand'
import { generateAppearance, randomVisitorName } from './appearance'

function generateVisitor(id) {
  const { appearance, outfit, scale, height } = generateAppearance()
  const entrySide = Math.random() < 0.5 ? -1 : 1
  const doorX = entrySide < 0 ? -3.5 : 3.5

  return {
    id,
    key: id,
    name: randomVisitorName(),
    appearance,
    outfit,
    scale,
    height,
    entrySide,
    spawn: [doorX + (Math.random() - 0.5) * 2.6, 0, 27 + Math.random() * 7],
  }
}

export const MAX_VISITORS = 5
export const SPAWN_INTERVAL_MIN = 10
export const SPAWN_INTERVAL_MAX = 18
export const LIFESPAN_MIN = 60
export const LIFESPAN_MAX = 120

let uidCounter = 1

export const useVisitorStore = create((set, get) => ({
  visitors: [],
  _nextSpawn: 0,
  _initialized: false,

  init(now) {
    const state = get()
    if (state._initialized) return
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

  despawn(id) {
    set((s) => ({ visitors: s.visitors.filter((v) => v.id !== id) }))
  },

  reset() {
    uidCounter = 1
    set({ visitors: [], _nextSpawn: 0, _initialized: false })
  },
}))
