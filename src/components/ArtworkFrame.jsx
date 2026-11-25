import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { registerArtwork } from '../systems/artworkTargets'
import { isExampleArtwork } from '../systems/frameTexture'
import { useFrameTexture } from '../hooks/useFrameTexture'
import PublishForm from './PublishForm'

const FRAME_DEPTH = 0.08
const FRAME_BORDER = 0.12

/**
 * Obra na parede. O catálogo de exemplo aceita publicação: sem obra de
 * visitante, E abre "Publicar obra aqui". Com obra publicada, a textura
 * do quadro é a imagem enviada e E abre Ver obra.
 */
export default function ArtworkFrame({ artwork }) {
  const { id, title, position, rotation, size } = artwork
  const [width, height] = size || [2, 1.5]

  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const publishFrameId = useGameStore((s) => s.publishFrameId)
  const playerName = useGameStore((s) => s.playerName)

  const published = communityArtworks.find((art) => art.frameId === id) || null
  const example = isExampleArtwork(artwork) && !published

  const [hovered, setHovered] = useState(false)
  const [showUploadUI, setShowUploadUI] = useState(false)
  const canvasMatRef = useRef(null)
  const meshRef = useRef(null)
  const texture = useFrameTexture(published || artwork, width, height, canvasMatRef)

  const viewArtwork = published
    ? {
        id: published.id || id,
        title: published.title || 'Obra',
        artist: published.author || playerName || 'Visitante',
        year: '',
        description: published.description || '',
        imagePath: published.dataUrl || published.url || '',
        authorId: published.authorId || null,
        frameId: id,
      }
    : artwork

  useEffect(() => {
    registerArtwork(id, meshRef.current)
    return () => registerArtwork(id, null)
  }, [id])

  useEffect(() => {
    if (!example || publishFrameId !== id) return
    useGameStore.getState().clearPublishRequest()
    useGameStore.getState().unlockPointer()
    useGameStore.getState().setFrameComposerOpen(true)
    setShowUploadUI(true)
  }, [publishFrameId, id, example])

  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5, metalness: 0.3 }),
    []
  )

  useFrame(() => {
    const mat = canvasMatRef.current
    if (!mat) return
    const target = hovered ? 0.25 : 0
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity ?? 0, target, 0.15)
  })

  const closeUpload = () => {
    setShowUploadUI(false)
    useGameStore.getState().setFrameComposerOpen(false)
    if (!useGameStore.getState().isMobile) {
      setTimeout(() => useGameStore.getState().lockPointer(), 100)
    }
  }

  const handleOver = (e) => {
    e.stopPropagation()
    setHovered(true)
  }
  const handleOut = (e) => {
    e.stopPropagation()
    setHovered(false)
  }

  return (
    <group position={position} rotation={rotation}>
      <spotLight
        position={[0, 1.6, 1.8]}
        angle={0.5}
        penumbra={0.6}
        intensity={12}
        distance={8}
        castShadow
        target-position={[0, 0, 0]}
        color="#fff6e8"
      />

      <mesh material={frameMaterial} castShadow>
        <boxGeometry args={[width + FRAME_BORDER * 2, height + FRAME_BORDER * 2, FRAME_DEPTH]} />
      </mesh>

      <mesh
        ref={meshRef}
        position={[0, 0, FRAME_DEPTH / 2 + 0.001]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={(e) => e.stopPropagation()}
        userData={{
          artworkId: id,
          artwork: viewArtwork,
          published: !!published,
          example,
          filled: !!published,
          emptyFrameId: example ? id : null,
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={canvasMatRef}
          map={texture || null}
          color={texture ? '#ffffff' : '#9a9a9a'}
          emissive="#ffffff"
          emissiveIntensity={0}
          roughness={0.6}
          metalness={0}
          toneMapped
        />
      </mesh>

      {!texture && (
        <mesh position={[0, -height / 2 - 0.25, FRAME_DEPTH]}>
          <planeGeometry args={[Math.min(width, 1.6), 0.28]} />
          <meshBasicMaterial color="#1f1f1f" />
        </mesh>
      )}
      <group name={`artwork-${title}`} />

      {showUploadUI && (
        <Html center distanceFactor={5} style={{ pointerEvents: 'auto' }}>
          <PublishForm frameId={id} existing={published} onClose={closeUpload} />
        </Html>
      )}
    </group>
  )
}
