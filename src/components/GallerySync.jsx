import { useEffect } from 'react'
import { useGameStore } from '../store'
import { getInitialGalleryState, isMultiplayerConnected } from '../systems/multiplayer'
import { getState as roomGetState } from 'playroomkit'
import { mergeAnnexCount } from '../systems/galleryExpansion'

const POLL_MS = 400

function sameArtworks(a, b) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false
    if (a[i]?.frameId !== b[i]?.frameId) return false
    if (a[i]?.title !== b[i]?.title) return false
    if ((a[i]?.dataUrl || a[i]?.url || '') !== (b[i]?.dataUrl || b[i]?.url || '')) return false
    if ((a[i]?.description || '') !== (b[i]?.description || '')) return false
  }
  return true
}

/**
 * Sincroniza o estado da galeria do Playroom com o store local.
 * getState não aceita callback: o efeito antigo registrava um listener
 * que nunca existiu e ainda rodava antes do insertCoin, então late
 * joiners ficavam em 0 salas. Aqui o efeito espera a conexão e relê o estado.
 */
export function GallerySync() {
  const mpReady = useGameStore((s) => s.mpReady)
  const mpOffline = useGameStore((s) => s.mpOffline)
  const setAnnexCount = useGameStore((s) => s.setAnnexCount)
  const setCommunityArtworks = useGameStore((s) => s.setCommunityArtworks)

  useEffect(() => {
    if (!mpReady || mpOffline || !isMultiplayerConnected()) return

    let stopped = false

    const apply = (gallery) => {
      if (stopped || !gallery || typeof gallery !== 'object') return
      const state = useGameStore.getState()
      if (typeof gallery.annexCount === 'number') {
        const merged = mergeAnnexCount(state.annexCount, gallery.annexCount)
        if (merged !== state.annexCount) setAnnexCount(merged)
      }
      if (Array.isArray(gallery.artworks) && !sameArtworks(state.communityArtworks, gallery.artworks)) {
        setCommunityArtworks(gallery.artworks)
      }
    }

    apply(getInitialGalleryState())

    const id = setInterval(() => {
      try {
        apply(roomGetState('gallery'))
      } catch {
        // Modo offline ou estado ainda indisponível.
      }
    }, POLL_MS)

    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [mpReady, mpOffline, setAnnexCount, setCommunityArtworks])

  return null
}
