/**
 * ArtworkFocus
 *
 * Desktop: raycast pela mira (centro da tela) → prompt [E] Ver obra.
 * Mobile:  busca por proximidade XZ → botão tátil "Ver obra" na UIOverlay.
 *
 * Em ambos os casos, o resultado é gravado em store.focusedArtwork.
 * A UIOverlay lê esse campo e exibe a interação adequada para cada plataforma.
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { getArtworkTargets } from '../systems/artworkTargets'
import { playerPosRef } from '../systems/proximityRefs'

// ---------- Desktop (raycast pela mira) ----------
const MAX_DIST_RAYCAST = 2.8     // metros
const _raycaster = new THREE.Raycaster()
const _center    = new THREE.Vector2(0, 0)
const RAYCAST_EVERY = 8          // throttle: 1 raycast a cada N frames

// ---------- Mobile (proximidade XZ) ----------
const MAX_DIST_MOBILE = 3.0      // metros: mais generoso pois nao ha mira
const PROXIMITY_EVERY = 10       // throttle: checa a cada N frames

export default function ArtworkFocus() {
  const { camera } = useThree()
  const isPointerLocked = useGameStore((s) => s.isPointerLocked)
  const isStarted       = useGameStore((s) => s.isStarted)
  const selectedArtwork = useGameStore((s) => s.selectedArtwork)
  const isMobile        = useGameStore((s) => s.isMobile)
  const openArtwork     = useGameStore((s) => s.openArtwork)
  const setFocused      = useGameStore((s) => s.setFocusedArtwork)

  const focusedRef = useRef(null)
  const frameCount = useRef(0)

  useFrame(() => {
    frameCount.current++

    // Nao detecta nada enquanto modal aberto ou jogo nao iniciado
    if (!isStarted || selectedArtwork) {
      if (focusedRef.current) { focusedRef.current = null; setFocused(null) }
      return
    }

    if (isMobile) {
      // ---- Mobile: proximidade por distancia XZ ----
      if (frameCount.current % PROXIMITY_EVERY !== 0) return

      const [px, , pz] = playerPosRef.current
      let nearest = null
      let nearestDist = MAX_DIST_MOBILE

      for (const mesh of getArtworkTargets().values()) {
        if (!mesh) continue
        // Posicao world da malha da obra
        const wp = mesh.getWorldPosition(_wp)
        const dist = Math.hypot(px - wp.x, pz - wp.z)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = mesh.userData.artwork ?? null
        }
      }

      if (nearest !== focusedRef.current) {
        focusedRef.current = nearest
        setFocused(nearest)
      }
    } else {
      // ---- Desktop: raycast pela mira ----
      if (!isPointerLocked) {
        if (focusedRef.current) { focusedRef.current = null; setFocused(null) }
        return
      }
      if (frameCount.current % RAYCAST_EVERY !== 0) return

      _raycaster.setFromCamera(_center, camera)
      _raycaster.far = MAX_DIST_RAYCAST

      const meshes = [...getArtworkTargets().values()]
      if (meshes.length === 0) return
      const hits = _raycaster.intersectObjects(meshes, false)
      const artwork = hits[0]?.object?.userData?.artwork ?? null

      if (artwork !== focusedRef.current) {
        focusedRef.current = artwork
        setFocused(artwork)
      }
    }
  })

  // Tecla E (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'e' || e.key === 'E') && focusedRef.current && isPointerLocked) {
        useGameStore.getState().unlockPointer()
        openArtwork(focusedRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPointerLocked, openArtwork])

  return null
}

const _wp = new THREE.Vector3()
