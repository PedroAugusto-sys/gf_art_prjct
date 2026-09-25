import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'

/**
 * Painel na parede da sala principal para gerenciar salas anexas.
 * Clicável quando jogador está próximo.
 */
export default function WallPanel({ position, rotation }) {
  const [hovered, setHovered] = useState(false)
  const [isNear, setIsNear] = useState(false)
  const [showUI, setShowUI] = useState(false)
  const meshRef = useRef(null)

  const annexCount = useGameStore((s) => s.annexCount)
  const setAnnexCount = useGameStore((s) => s.setAnnexCount)
  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const unlockPointer = useGameStore((s) => s.unlockPointer)

  const isHost = isRoomHost() || isMultiplayerOffline()
  const canAddRoom = annexCount < 2 && isHost

  useFrame((state) => {
    if (!meshRef.current) return

    const camera = state.camera
    const distance = camera.position.distanceTo(meshRef.current.position)
    const near = distance < 4.0

    if (near !== isNear) {
      setIsNear(near)
    }
  })

  const handleClick = () => {
    if (!isNear) return
    unlockPointer()
    setShowUI(true)
  }

  const handleAddRoom = () => {
    if (!canAddRoom) return

    const newCount = annexCount + 1
    setAnnexCount(newCount)

    publishGalleryState({
      annexCount: newCount,
      artworks: communityArtworks,
    })
  }

  const handleClose = () => {
    setShowUI(false)
  }

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: hovered ? '#4a4a4a' : '#3a3a3a',
    roughness: 0.6,
    metalness: 0.2,
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Spotlight para o painel */}
      <spotLight
        position={[0, 1.5, 1.5]}
        angle={0.6}
        penumbra={0.7}
        intensity={6}
        distance={6}
        color="#fff8e8"
      />

      {/* Placa clicável */}
      <mesh
        ref={meshRef}
        material={panelMaterial}
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
        <boxGeometry args={[1.2, 0.8, 0.08]} />
      </mesh>

      {/* Ícone/texto no painel */}
      <Html center distanceFactor={10} position={[0, 0, 0.05]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            width: '120px',
            height: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center',
            gap: '4px',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ width: '32px', height: '32px', opacity: 0.9 }}
          >
            <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
            <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
          </svg>
          <div>Salas</div>
        </div>
      </Html>

      {/* Hint de proximidade */}
      {isNear && !showUI && (
        <Html center distanceFactor={10} position={[0, -0.5, 0.05]}>
          <div
            style={{
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
            }}
          >
            Clique para gerenciar
          </div>
        </Html>
      )}

      {/* UI de gerenciamento */}
      {showUI && (
        <Html center distanceFactor={5}>
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
              Gerenciar salas
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px' }}>Sala principal</span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#4ade80',
                      background: 'rgba(74,222,128,0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    Ativa
                  </span>
                </div>
              </div>

              {Array.from({ length: annexCount }, (_, i) => (
                <div
                  key={`annex-${i}`}
                  style={{
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px' }}>Sala anexa {i + 1}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#4ade80',
                        background: 'rgba(74,222,128,0.1)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      Ativa
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {canAddRoom && (
              <button
                onClick={handleAddRoom}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#16a34a',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ width: '18px', height: '18px' }}
                >
                  <path
                    fillRule="evenodd"
                    d="M12 5.25a.75.75 0 01.75.75v5.25H18a.75.75 0 010 1.5h-5.25V18a.75.75 0 01-1.5 0v-5.25H6a.75.75 0 010-1.5h5.25V6a.75.75 0 01.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                Adicionar nova sala ({annexCount}/2)
              </button>
            )}

            {!isHost && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '12px',
                  textAlign: 'center',
                }}
              >
                Apenas o anfitrião pode criar novas salas
              </div>
            )}

            {annexCount >= 2 && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#fbbf24',
                  marginBottom: '12px',
                  textAlign: 'center',
                  background: 'rgba(251,191,36,0.1)',
                  padding: '8px',
                  borderRadius: '6px',
                }}
              >
                Limite máximo de salas atingido
              </div>
            )}

            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>

            <div
              style={{
                marginTop: '12px',
                fontSize: '11px',
                opacity: 0.5,
                textAlign: 'center',
              }}
            >
              Atalho: pressione R
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
