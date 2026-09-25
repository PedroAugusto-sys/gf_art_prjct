import { useEffect } from 'react'
import { useGameStore } from '../store'
import { getInitialGalleryState, isMultiplayerConnected } from '../systems/multiplayer'
import { getState as roomGetState } from 'playroomkit'

/**
 * Sincroniza o estado da galeria do Playroom com o store local.
 * Carrega estado inicial e escuta mudanças.
 */
export function GallerySync() {
  const setAnnexCount = useGameStore((s) => s.setAnnexCount)
  const setCommunityArtworks = useGameStore((s) => s.setCommunityArtworks)

  useEffect(() => {
    if (!isMultiplayerConnected()) return

    // Carrega estado inicial
    const loadInitialState = () => {
      try {
        const gallery = getInitialGalleryState()
        if (gallery) {
          if (typeof gallery.annexCount === 'number') {
            setAnnexCount(gallery.annexCount)
          }
          if (Array.isArray(gallery.artworks)) {
            setCommunityArtworks(gallery.artworks)
          }
        }
      } catch (err) {
        console.warn('Failed to load initial gallery state:', err)
      }
    }

    loadInitialState()

    // Escuta mudanças no estado da galeria
    let unsubscribe
    try {
      unsubscribe = roomGetState('gallery', (gallery) => {
        if (!gallery) return
        if (typeof gallery.annexCount === 'number') {
          setAnnexCount(gallery.annexCount)
        }
        if (Array.isArray(gallery.artworks)) {
          setCommunityArtworks(gallery.artworks)
        }
      })
    } catch (err) {
      console.warn('Failed to subscribe to gallery state:', err)
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [setAnnexCount, setCommunityArtworks])

  return null
}
