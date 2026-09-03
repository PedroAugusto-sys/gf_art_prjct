/**
 * ArtworkFocus
 *
 * Dispara um raio a partir do centro da camera (mira) a cada frame e
 * atualiza o store com a obra em foco. Se o jogador pressionar 'E' (ou 'e'),
 * abre o modal da obra — sem precisar clicar nem mover o mouse.
 *
 * Teclas:
 *   E  — interage com a obra em foco
 *
 * Visibilidade do prompt:
 *   O store expoe `focusedArtwork` (null ou objeto de obra). A UIOverlay le
 *   esse campo e mostra o dica "[E] Ver obra" quando nao-nulo.
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { getArtworkTargets } from '../systems/artworkTargets'

const MAX_DIST = 4.5   // metros: distancia maxima de interacao
const _raycaster = new THREE.Raycaster()
const _center = new THREE.Vector2(0, 0)
const RAYCAST_EVERY = 8  // faz raycast a cada N frames (nao precisa de 60/s)

export default function ArtworkFocus() {
  const { camera } = useThree()
  const isPointerLocked = useGameStore((s) => s.isPointerLocked)
  const isStarted       = useGameStore((s) => s.isStarted)
  const selectedArtwork = useGameStore((s) => s.selectedArtwork)
  const openArtwork     = useGameStore((s) => s.openArtwork)
  const setFocused      = useGameStore((s) => s.setFocusedArtwork)

  const focusedRef = useRef(null)
  const frameCount = useRef(0)

  useFrame(() => {
    frameCount.current++

    // So faz raycast quando o jogador esta com o mouse capturado e sem modal aberto
    if (!isPointerLocked || !isStarted || selectedArtwork) {
      if (focusedRef.current) { focusedRef.current = null; setFocused(null) }
      return
    }

    // Throttle: raycast so a cada N frames
    if (frameCount.current % RAYCAST_EVERY !== 0) return

    _raycaster.setFromCamera(_center, camera)
    _raycaster.far = MAX_DIST

    const meshes = [...getArtworkTargets().values()]
    if (meshes.length === 0) return
    const hits = _raycaster.intersectObjects(meshes, false)

    const artwork = hits[0]?.object?.userData?.artwork ?? null

    if (artwork !== focusedRef.current) {
      focusedRef.current = artwork
      setFocused(artwork)
    }
  })

  // Tecla E
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
