import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'
import { deleteArtwork, reportArtwork, getSessionToken } from '../systems/temporaryArtworks'
import { registerEmptyFrame } from '../systems/artworkTargets'
import { useFrameTexture } from '../hooks/useFrameTexture'
import { getStableAuthorId } from '../systems/publishFrame'
import FrameBorder, { CANVAS_DEPTH, CANVAS_Z } from './FrameBorder'
import ArtworkTitlePlate from './ArtworkTitlePlate'

const FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#2b2b2b',
  roughness: 0.5,
  metalness: 0.3,
})

/**
 * Quadro vazio para galeria comunitária.
 * Permite upload de imagem para publicação na sala.
 */
export default function EmptyFrame({ position, rotation, size = [2, 1.5], frameId }) {
  const meshRef = useRef(null)
  const matRef = useRef(null)

  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const updateCommunityArtwork = useGameStore((s) => s.updateCommunityArtwork)
  const publishFrameId = useGameStore((s) => s.publishFrameId)
  const playerName = useGameStore((s) => s.playerName)
  const unlockPointer = useGameStore((s) => s.unlockPointer)

  const [width, height] = size

  const artwork = communityArtworks.find((art) => art.frameId === frameId)
  const isHost = isRoomHost() || isMultiplayerOffline()
  const authorId = getStableAuthorId()
  
  // Verifica ownership via token de sessão (mais seguro que authorId localStorage)
  const sessionToken = getSessionToken()
  const isOwner = artwork && (
    artwork.authorId === authorId || // Compatibilidade com sistema antigo
    (sessionToken && artwork.authorToken === sessionToken) // Novo sistema
  )
  const canEdit = !artwork || isOwner || isHost

  const artworkTexture = useFrameTexture(artwork, width, height, matRef)

  const handleInteract = () => {
    if (!canEdit || artwork) return
    unlockPointer()
    useGameStore.getState().beginPublish({ frameId, existing: artwork || null })
  }

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.userData.emptyFrameId = frameId
    mesh.userData.filled = !!artwork
    mesh.userData.published = !!artwork
    mesh.userData.example = false
    if (artwork) {
      mesh.userData.artwork = {
        id: artwork.id || frameId,
        title: artwork.title || 'Obra',
        artist: artwork.author || playerName || 'Visitante',
        year: '',
        description: artwork.description || '',
        imagePath: artwork.dataUrl || artwork.url || '',
        authorId: artwork.authorId || null,
        frameId,
      }
    } else {
      mesh.userData.artwork = null
    }
    registerEmptyFrame(frameId, mesh)
    return () => registerEmptyFrame(frameId, null)
  }, [frameId, artwork, playerName])

  useEffect(() => {
    if (publishFrameId !== frameId) return
    useGameStore.getState().clearPublishRequest()
    handleInteract()
  }, [publishFrameId, frameId])

  return (
    <group position={position} rotation={rotation}>
      <FrameBorder width={width} height={height} material={FRAME_MATERIAL} />

      <mesh
        ref={meshRef}
        position={[0, 0, CANVAS_Z]}
        receiveShadow={false}
        onClick={(e) => e.stopPropagation()}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={matRef}
          color={artwork ? '#ffffff' : '#4a4a4a'}
          emissive={artwork ? '#000000' : '#444444'}
          emissiveIntensity={0}
          roughness={0.8}
          metalness={0}
          map={artworkTexture}
          {...CANVAS_DEPTH}
        />
      </mesh>

      <ArtworkTitlePlate
        meshRef={meshRef}
        width={width}
        height={height}
        title={artwork?.title}
        author={artwork?.author}
        enabled={!!artwork}
      >
            {artwork?.isTemporary && (
              <div style={{ 
                fontSize: '9px', 
                opacity: 0.6, 
                marginBottom: '6px',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                paddingTop: '4px'
              }}>
                ⏱️ Obra temporária da sessão
              </div>
            )}
            
            {artwork?.isTemporary && (
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', pointerEvents: 'auto', whiteSpace: 'normal' }}>
                {isOwner && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (confirm(`Deletar "${artwork.title}"?`)) {
                        try {
                          await deleteArtwork(artwork.id)
                          // Remove do store local
                          updateCommunityArtwork(artwork.id, null)
                          // Atualiza Playroom
                          publishGalleryState({
                            annexCount: useGameStore.getState().annexCount,
                            artworks: communityArtworks.filter(a => a.id !== artwork.id)
                          })
                        } catch (err) {
                          alert(`Erro: ${err.message}`)
                        }
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: '#dc2626',
                      color: 'white',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    🗑️ Deletar
                  </button>
                )}
                
                {!isOwner && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (confirm('Reportar esta obra como inapropriada?')) {
                        try {
                          await reportArtwork(artwork.id)
                          alert('Obra reportada com sucesso')
                        } catch (err) {
                          alert(`Erro: ${err.message}`)
                        }
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'transparent',
                      color: 'white',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    ⚠️ Reportar
                  </button>
                )}
              </div>
            )}
      </ArtworkTitlePlate>
    </group>
  )
}
