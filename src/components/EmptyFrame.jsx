import { useState, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { Html } from '@react-three/drei'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'
import { useEmptyFrameInteraction } from '../hooks/useEmptyFrameInteraction'

/**
 * Redimensiona imagem para JPEG pequeno (~480px no lado maior)
 */
async function resizeImageToJpeg(file, maxSize = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }
            const jpegReader = new FileReader()
            jpegReader.onloadend = () => resolve(jpegReader.result)
            jpegReader.onerror = reject
            jpegReader.readAsDataURL(blob)
          },
          'image/jpeg',
          0.85
        )
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Gera ID estável do autor baseado em dados do navegador
 */
function getStableAuthorId() {
  let authorId = localStorage.getItem('gf-author-id')
  if (!authorId) {
    authorId = `author-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('gf-author-id', authorId)
  }
  return authorId
}

/**
 * Quadro vazio para galeria comunitária.
 * Permite upload de imagem para publicação na sala.
 */
export default function EmptyFrame({ position, rotation, size = [2, 1.5], frameId }) {
  const [hovered, setHovered] = useState(false)
  const [showUploadUI, setShowUploadUI] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [showTitle, setShowTitle] = useState(false)
  const meshRef = useRef(null)
  const matRef = useRef(null)
  const fileInputRef = useRef(null)

  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const addCommunityArtwork = useGameStore((s) => s.addCommunityArtwork)
  const updateCommunityArtwork = useGameStore((s) => s.updateCommunityArtwork)
  const annexCount = useGameStore((s) => s.annexCount)
  const playerName = useGameStore((s) => s.playerName)
  const unlockPointer = useGameStore((s) => s.unlockPointer)
  const lockPointer = useGameStore((s) => s.lockPointer)
  const isMobile = useGameStore((s) => s.isMobile)

  const [width, height] = size
  const FRAME_DEPTH = 0.08
  const FRAME_BORDER = 0.12

  const artwork = communityArtworks.find((art) => art.frameId === frameId)
  const isHost = isRoomHost() || isMultiplayerOffline()
  const authorId = getStableAuthorId()
  const canEdit = !artwork || artwork.authorId === authorId || isHost

  const handleInteract = () => {
    if (!canEdit) return
    unlockPointer()
    setShowUploadUI(true)
  }

  const closeModal = () => {
    setShowUploadUI(false)
    setTitle('')
    setUploadError('')
    if (!isMobile) {
      lockPointer()
    }
  }

  const isNear = useEmptyFrameInteraction(meshRef, frameId, handleInteract)

  useFrame(() => {
    const mat = matRef.current
    if (!mat) return

    const target = hovered ? 0.15 : 0
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity ?? 0, target, 0.1)
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

  const handleClick = () => {
    if (!canEdit) return
    unlockPointer()
    setShowUploadUI(true)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor selecione uma imagem')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const dataUrl = await resizeImageToJpeg(file, 480)

      const newArtwork = {
        id: artwork?.id || `community-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        frameId,
        dataUrl,
        title: title.trim() || 'Sem título',
        author: playerName || 'Anônimo',
        authorId,
        timestamp: Date.now(),
      }

      // Salva no localStorage como backup
      try {
        const backup = JSON.parse(localStorage.getItem('gf-my-artworks') || '[]')
        const existing = backup.findIndex((art) => art.frameId === frameId)
        if (existing >= 0) backup[existing] = newArtwork
        else backup.push(newArtwork)
        localStorage.setItem('gf-my-artworks', JSON.stringify(backup))
      } catch {
        // Falha silenciosa - localStorage pode estar desabilitado
      }

      // Atualiza store local
      if (artwork) {
        updateCommunityArtwork(artwork.id, newArtwork)
      } else {
        addCommunityArtwork(newArtwork)
      }

      // Publica no Playroom
      const updatedArtworks = artwork
        ? communityArtworks.map((art) => (art.id === artwork.id ? newArtwork : art))
        : [...communityArtworks, newArtwork]

      publishGalleryState({
        annexCount,
        artworks: updatedArtworks,
      })

      closeModal()
      setUploading(false)
    } catch (err) {
      // Log apenas se for um erro real de processamento (não de rede/offline)
      if (err?.message && !err.message.includes('network') && !err.message.includes('offline')) {
        console.error('Error processing image:', err)
      }
      setUploadError('Erro ao processar imagem. Tente novamente.')
      setUploading(false)
    }
  }

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: '#2b2b2b',
    roughness: 0.5,
    metalness: 0.3,
  })

  // Proximity check para mostrar título
  useFrame(({ camera }) => {
    if (!meshRef.current || !artwork) {
      setShowTitle(false)
      return
    }
    const frameWorldPos = new THREE.Vector3()
    meshRef.current.getWorldPosition(frameWorldPos)
    const distance = camera.position.distanceTo(frameWorldPos)
    setShowTitle(distance < 4) // Mostra título quando < 4m
  })

  return (
    <group position={position} rotation={rotation}>
      <spotLight
        position={[0, 1.6, 1.8]}
        angle={0.5}
        penumbra={0.6}
        intensity={8}
        distance={8}
        color="#fff6e8"
      />

      <mesh material={frameMaterial} castShadow>
        <boxGeometry args={[width + FRAME_BORDER * 2, height + FRAME_BORDER * 2, FRAME_DEPTH]} />
      </mesh>

      <mesh
        ref={meshRef}
        position={[0, 0, FRAME_DEPTH / 2 + 0.001]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={handleClick}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={matRef}
          color={artwork ? '#ffffff' : '#4a4a4a'}
          emissive={artwork ? '#000000' : '#444444'}
          emissiveIntensity={0}
          roughness={0.8}
          metalness={0}
        />

        {artwork && (
          <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <img
              src={artwork.dataUrl}
              alt={artwork.title}
              style={{
                width: `${width * 100}px`,
                height: `${height * 100}px`,
                objectFit: 'cover',
                borderRadius: '4px',
              }}
            />
          </Html>
        )}
      </mesh>

      {isNear && canEdit && !showUploadUI && (
        <Html center distanceFactor={10}>
          <div
            style={{
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
            }}
          >
            {artwork ? 'Pressione E para substituir' : 'Pressione E para publicar'}
          </div>
        </Html>
      )}

      {showUploadUI && (
        <Html center distanceFactor={5} style={{ pointerEvents: 'auto' }}>
          <div
            style={{
              background: 'rgba(20,20,20,0.95)',
              color: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '320px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
              {artwork ? 'Substituir obra' : 'Publicar obra'}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  opacity: 0.8,
                }}
              >
                Título da obra
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dê um nome à sua obra"
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />

            {uploadError && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '8px',
                  background: 'rgba(220,38,38,0.2)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#fca5a5',
                }}
              >
                {uploadError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: uploading ? '#555' : '#fff',
                  color: '#000',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? 'Processando...' : 'Escolher imagem'}
              </button>
              <button
                onClick={closeModal}
                disabled={uploading}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'transparent',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
            </div>

            <div
              style={{
                marginTop: '12px',
                fontSize: '11px',
                opacity: 0.6,
                textAlign: 'center',
              }}
            >
              A imagem será redimensionada para ~480px
            </div>
          </div>
        </Html>
      )}

      {artwork && showTitle && (
        <Html position={[0, -height / 2 - 0.3, FRAME_DEPTH]} center distanceFactor={10}>
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              textAlign: 'center',
              maxWidth: '200px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{artwork.title}</div>
            <div style={{ opacity: 0.8, fontSize: '10px' }}>{artwork.author}</div>
          </div>
        </Html>
      )}
    </group>
  )
}
