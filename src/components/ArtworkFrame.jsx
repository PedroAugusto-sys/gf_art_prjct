import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { registerArtwork } from '../systems/artworkTargets'
import { isExampleArtwork } from '../systems/frameTexture'
import { useFrameTexture } from '../hooks/useFrameTexture'
import FrameBorder, { CANVAS_DEPTH, CANVAS_Z, FRAME_DEPTH } from './FrameBorder'

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
    useGameStore.getState().beginPublish({ frameId: id, existing: published })
  }, [publishFrameId, id, example, published])

  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5, metalness: 0.3 }),
    []
  )

  return (
    <group position={position} rotation={rotation}>
      <spotLight
        position={[0, 1.6, 1.8]}
        angle={0.5}
        penumbra={0.6}
        intensity={12}
        distance={8}
        castShadow={false}
        target-position={[0, 0, 0]}
        color="#fff6e8"
      />

      <FrameBorder width={width} height={height} material={frameMaterial} />

      <mesh
        ref={meshRef}
        position={[0, 0, CANVAS_Z]}
        receiveShadow={false}
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
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.6}
          metalness={0}
          toneMapped
          {...CANVAS_DEPTH}
        />
      </mesh>

      {!texture && (
        <mesh position={[0, -height / 2 - 0.25, FRAME_DEPTH]}>
          <planeGeometry args={[Math.min(width, 1.6), 0.28]} />
          <meshBasicMaterial color="#1f1f1f" />
        </mesh>
      )}
      <group name={`artwork-${title}`} />

    </group>
  )
}
