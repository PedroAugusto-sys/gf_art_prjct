import { useEffect, useRef } from 'react'
import { onPlayerJoin } from 'playroomkit'
import { useGameStore } from '../store'
import {
  getInitialGalleryState,
  isMultiplayerConnected,
  isRoomHost,
  publishGalleryState,
  readGalleryMeta,
} from '../systems/multiplayer'
import { galleryHasInlineImages } from '../systems/galleryPayload'
import { mergeAnnexCount } from '../systems/galleryExpansion'

function withLocalImages(local, remote) {
  return remote.map((art) => {
    if (art?.dataUrl) return art
    if (!art?.parts) return art
    const mine = (local || []).find((item) => item?.id === art?.id)
    if (mine?.dataUrl) return { ...art, dataUrl: mine.dataUrl }
    return art
  })
}

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
  const repacked = useRef(false)

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
      if (Array.isArray(gallery.artworks)) {
        const mergedArt = withLocalImages(state.communityArtworks, gallery.artworks)
        if (!sameArtworks(state.communityArtworks, mergedArt)) setCommunityArtworks(mergedArt)
      }
    }

    const publishHeld = () => {
      const state = useGameStore.getState()
      const held = (state.communityArtworks || []).some((art) => typeof art?.dataUrl === 'string' && art.dataUrl.startsWith('data:'))
      if (!held) return
      publishGalleryState({
        annexCount: state.annexCount,
        artworks: state.communityArtworks,
      })
    }

    apply(getInitialGalleryState())

    const raw = readGalleryMeta()
    if (!repacked.current && galleryHasInlineImages(raw)) {
      repacked.current = true
      publishHeld()
    }

    const id = setInterval(() => {
      try {
        apply(getInitialGalleryState())
      } catch {
        // Modo offline ou estado ainda indisponível.
      }
    }, POLL_MS)

    let unsubscribe = () => {}
    try {
      const joined = onPlayerJoin(() => {
        if (stopped || !isRoomHost()) return
        publishHeld()
      })
      if (typeof joined === 'function') unsubscribe = joined
    } catch {
      /* a sala segue pelo estado, sem o aviso de entrada */
    }

    return () => {
      stopped = true
      clearInterval(id)
      try {
        unsubscribe()
      } catch {
        /* ignore */
      }
    }
  }, [mpReady, mpOffline, setAnnexCount, setCommunityArtworks])

  return null
}
