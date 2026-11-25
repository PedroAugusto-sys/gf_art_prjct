import { useState, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { Html } from '@react-three/drei'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'
import { deleteArtwork, reportArtwork, getSessionToken } from '../systems/temporaryArtworks'
import { registerEmptyFrame } from '../systems/artworkTargets'
import { useFrameTexture } from '../hooks/useFrameTexture'
import PublishForm from './PublishForm'
import { getStableAuthorId } from '../systems/publishFrame'
import FrameBorder, { CANVAS_DEPTH, CANVAS_Z, FRAME_DEPTH } from './FrameBorder'

const FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#2b2b2b',
  roughness: 0.5,
  metalness: 0.3,
})
const _framePos = new THREE.Vector3()

/**
 * Quadro vazio para galeria comunitária.
 * Permite upload de imagem para publicação na sala.
 */
export default function EmptyFrame({ position, rotation, size = [2, 1.5], frameId }) {
  const [hovered, setHovered] = useState(false)
  const [showUploadUI, setShowUploadUI] = useState(false)
  const [showTitle, setShowTitle] = useState(false)
  const meshRef = useRef(null)
  const matRef = useRef(null)

  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const updateCommunityArtwork = useGameStore((s) => s.updateCommunityArtwork)
  const publishFrameId = useGameStore((s) => s.publishFrameId)
  const playerName = useGameStore((s) => s.playerName)
  const unlockPointer = useGameStore((s) => s.unlockPointer)
  const lockPointer = useGameStore((s) => s.lockPointer)
  const isMobile = useGameStore((s) => s.isMobile)

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
    useGameStore.getState().setFrameComposerOpen(true)
    setShowUploadUI(true)
  }

  const closeModal = () => {
    setShowUploadUI(false)
    useGameStore.getState().setFrameComposerOpen(false)
    if (!isMobile) {
      // Pequeno delay para evitar race condition com pointer lock
      setTimeout(() => {
        lockPointer()
      }, 100)
    }
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

  const titleNear = useRef(false)

  useFrame(({ camera }) => {
    const mat = matRef.current
    if (mat) {
      const target = hovered ? 0.15 : 0
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity ?? 0, target, 0.1)
    }

    const mesh = meshRef.current
    if (!mesh || !artwork) {
      if (titleNear.current) {
        titleNear.current = false
        setShowTitle(false)
      }
      return
    }
    mesh.getWorldPosition(_framePos)
    const near = camera.position.distanceTo(_framePos) < 4
    if (near !== titleNear.current) {
      titleNear.current = near
      setShowTitle(near)
    }
  })

  useEffect(() => {
    if (!showUploadUI) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showUploadUI])

  return (
    <group position={position} rotation={rotation}>
      <FrameBorder width={width} height={height} material={FRAME_MATERIAL} />

      <mesh
        ref={meshRef}
        position={[0, 0, CANVAS_Z]}
        receiveShadow={false}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHovered(false)
        }}
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

      {showUploadUI && (
        <Html center distanceFactor={5} style={{ pointerEvents: 'auto' }}>
          <PublishForm frameId={frameId} existing={artwork} onClose={closeModal} />
        </Html>
      )}


      {artwork && showTitle && (
        <Html position={[0, -height / 2 - 0.3, FRAME_DEPTH]} center distanceFactor={10}>
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              textAlign: 'center',
              maxWidth: '220px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{artwork.title}</div>
            <div style={{ opacity: 0.8, fontSize: '10px', marginBottom: '6px' }}>{artwork.author}</div>
            
            {artwork.isTemporary && (
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
            
            {artwork.isTemporary && (
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
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
          </div>
        </Html>
      )}
    </group>
  )
}
