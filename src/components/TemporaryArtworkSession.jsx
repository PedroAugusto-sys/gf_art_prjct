import { useEffect, useState } from 'react'
import { useGameStore } from '../store'
import { 
  joinRoom, 
  leaveRoom, 
  checkServerHealth,
  getRoomState 
} from '../systems/temporaryArtworks'

/**
 * Gerencia sessão de uploads temporários.
 * Conecta ao servidor quando jogador entra no museu.
 */
export function TemporaryArtworkSession() {
  const isStarted = useGameStore((s) => s.isStarted)
  const playerName = useGameStore((s) => s.playerName)
  const setTemporaryArtworksEnabled = useGameStore((s) => s.setTemporaryArtworksEnabled)
  const setCommunityArtworks = useGameStore((s) => s.setCommunityArtworks)
  const [serverAvailable, setServerAvailable] = useState(null)
  const [sessionJoined, setSessionJoined] = useState(false)

  // Verifica se servidor está disponível
  useEffect(() => {
    checkServerHealth().then(health => {
      setServerAvailable(health.available)
      setTemporaryArtworksEnabled(health.available)
      
      if (health.available) {
        console.log('[TempArtworkSession] Servidor disponível:', health.config)
      } else {
        console.info('[TempArtworkSession] Servidor indisponível, usando sistema antigo (data URLs)')
      }
    })
  }, [setTemporaryArtworksEnabled])

  // Entra na sala quando jogador inicia
  useEffect(() => {
    if (!isStarted || !serverAvailable || sessionJoined) return

    // Usa hash da URL como roomId (ou default)
    const hash = window.location.hash.slice(1)
    const match = hash.match(/r=([^&]+)/)
    const roomId = match ? decodeURIComponent(match[1]) : 'default-room'

    joinRoom(roomId, playerName)
      .then(data => {
        console.log('[TempArtworkSession] Joined room:', roomId)
        setSessionJoined(true)

        // Carrega artworks temporários existentes
        if (data.artworks.length > 0) {
          console.log(`[TempArtworkSession] Loaded ${data.artworks.length} existing artworks`)
          
          // Converte artworks do servidor para formato do store
          const artworks = data.artworks.map(a => ({
            id: a.id,
            frameId: a.frameId,
            url: a.url,
            title: a.title,
            author: a.author,
            timestamp: a.timestamp,
            isTemporary: true
          }))
          
          setCommunityArtworks(artworks)
        }
      })
      .catch(err => {
        console.error('[TempArtworkSession] Failed to join room:', err)
        setServerAvailable(false)
        setTemporaryArtworksEnabled(false)
      })

    // Cleanup ao desmontar
    return () => {
      if (sessionJoined) {
        leaveRoom()
        setSessionJoined(false)
      }
    }
  }, [isStarted, serverAvailable, sessionJoined, playerName, setCommunityArtworks, setTemporaryArtworksEnabled])

  return null
}
