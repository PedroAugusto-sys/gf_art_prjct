import { useEffect, useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store'

/**
 * Gerencia interação com quadros vazios via tecla E.
 * Detecta proximidade e dispara evento quando E é pressionado.
 */
export function useEmptyFrameInteraction(meshRef, frameId, onInteract) {
  const [isNear, setIsNear] = useState(false)
  const lastInteractTime = useRef(0)

  useFrame((state) => {
    if (!meshRef.current) return

    const camera = state.camera
    const distance = camera.position.distanceTo(meshRef.current.position)
    const near = distance < 3.5

    if (near !== isNear) {
      setIsNear(near)
    }
  })

  useEffect(() => {
    if (!isNear) return

    const handleKey = (e) => {
      if (e.key === 'e' || e.key === 'E') {
        const now = performance.now()
        if (now - lastInteractTime.current < 500) return // debounce
        
        const { isStarted, isMovementPaused } = useGameStore.getState()
        if (!isStarted || isMovementPaused) return

        const el = document.activeElement
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return

        lastInteractTime.current = now
        onInteract()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isNear, onInteract])

  return isNear
}
