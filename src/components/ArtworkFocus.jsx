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
import { getArtworkTargets, getEmptyFrameTargets } from '../systems/artworkTargets'
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
  const setFocus        = useGameStore((s) => s.setFocusTarget)
  const frameComposerOpen = useGameStore((s) => s.frameComposerOpen)

  const focusedRef = useRef(null)
  const emptyRef = useRef(null)
  const frameCount = useRef(0)

  const exampleRef = useRef(null)

  const applyFocus = (artwork, emptyFrameId, exampleArtwork) => {
    const nextArt = artwork || null
    const nextEmpty = nextArt ? null : (emptyFrameId || null)
    const nextExample = nextArt ? null : (exampleArtwork || null)
    if (
      focusedRef.current === nextArt &&
      emptyRef.current === nextEmpty &&
      exampleRef.current === nextExample
    ) return
    focusedRef.current = nextArt
    emptyRef.current = nextEmpty
    exampleRef.current = nextExample
    setFocus(nextArt, nextEmpty, nextExample)
  }

  const focusFromMesh = (data) => {
    if (data?.published && data.artwork) applyFocus(data.artwork, null, null)
    else if (data?.emptyFrameId && !data.filled) {
      applyFocus(null, data.emptyFrameId, data.example ? data.artwork : null)
    } else if (data?.artwork) applyFocus(data.artwork, null, null)
    else applyFocus(null, null, null)
  }

  useFrame(() => {
    frameCount.current++

    // Nao detecta nada enquanto modal aberto ou jogo nao iniciado
    if (!isStarted || selectedArtwork || frameComposerOpen) {
      if (focusedRef.current || emptyRef.current) applyFocus(null, null, null)
      return
    }

    if (isMobile) {
      // ---- Mobile: proximidade por distancia XZ ----
      if (frameCount.current % PROXIMITY_EVERY !== 0) return

      const [px, , pz] = playerPosRef.current
      let nearest = null
      let nearestDist = MAX_DIST_MOBILE

      const meshes = [...getArtworkTargets().values(), ...getEmptyFrameTargets().values()]
      for (const mesh of meshes) {
        if (!mesh || !isShown(mesh)) continue
        const wp = mesh.getWorldPosition(_wp)
        const dist = Math.hypot(px - wp.x, pz - wp.z)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = mesh
        }
      }

      focusFromMesh(nearest?.userData)
    } else {
      // ---- Desktop: raycast pela mira ----
      if (!isPointerLocked) {
        if (focusedRef.current || emptyRef.current) applyFocus(null, null, null)
        return
      }
      if (frameCount.current % RAYCAST_EVERY !== 0) return

      _raycaster.setFromCamera(_center, camera)
      _raycaster.far = MAX_DIST_RAYCAST

      const meshes = [...getArtworkTargets().values(), ...getEmptyFrameTargets().values()].filter((mesh) => mesh && isShown(mesh))
      if (meshes.length === 0) {
        if (focusedRef.current || emptyRef.current) applyFocus(null, null, null)
        return
      }
      const hits = _raycaster.intersectObjects(meshes, false)
      focusFromMesh(hits[0]?.object?.userData)
    }
  })

  // Tecla E (desktop): obra preenchida abre a ficha; quadro vazio publica ali.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key !== 'e' && e.key !== 'E') || !isPointerLocked) return
      if (focusedRef.current) {
        useGameStore.getState().unlockPointer()
        openArtwork(focusedRef.current)
        return
      }
      if (emptyRef.current) {
        useGameStore.getState().requestPublishOnFrame(emptyRef.current)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    const onViewExample = (e) => {
      if ((e.key !== 'v' && e.key !== 'V') || !isPointerLocked || focusedRef.current) return
      const example = exampleRef.current
      if (!example) return
      useGameStore.getState().unlockPointer()
      openArtwork(example)
    }
    window.addEventListener('keydown', onViewExample)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onViewExample)
    }
  }, [isPointerLocked, openArtwork])

  return null
}

const _wp = new THREE.Vector3()

function isShown(obj) {
  let node = obj
  while (node) {
    if (!node.visible) return false
    node = node.parent
  }
  return true
}
