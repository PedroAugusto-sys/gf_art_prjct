import { useState, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { Html } from '@react-three/drei'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'

/**
 * Quadro vazio para galeria comunitária.
 * Permite upload de imagem para publicação na sala.
 */
export default function EmptyFrame({ position, rotation, size = [2, 1.5], frameId }) {
  const [hovered, setHovered] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const meshRef = useRef(null)
  const matRef = useRef(null)

  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const addCommunityArtwork = useGameStore((s) => s.addCommunityArtwork)
  const annexCount = useGameStore((s) => s.annexCount)
  const playerName = useGameStore((s) => s.playerName)

  const [width, height] = size
  const FRAME_DEPTH = 0.08
  const FRAME_BORDER = 0.12

  const artwork = communityArtworks.find((art) => art.frameId === frameId)
  const isHost = isRoomHost() || isMultiplayerOffline()
  const canEdit = !artwork || artwork.authorId === playerName || isHost

  useFrame((state) => {
    const mat = matRef.current
    if (!mat) return

    const target = hovered ? 0.15 : 0
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity ?? 0, target, 0.1)

    const camera = state.camera
    const mesh = meshRef.current
    if (!mesh) return

    const distance = camera.position.distanceTo(mesh.position)
    const isNear = distance < 3.5
    if (isNear !== showUpload && !artwork) {
      setShowUpload(isNear)
    }
  })

  const handleClick = () => {
    if (!canEdit) return
    useGameStore.getState().unlockPointer()
  }

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: '#2b2b2b',
    roughness: 0.5,
    metalness: 0.3,
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

      {showUpload && !artwork && canEdit && (
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
            Pressione E para publicar
          </div>
        </Html>
      )}

      {artwork && (
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
