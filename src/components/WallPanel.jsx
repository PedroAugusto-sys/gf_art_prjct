import { useState, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'

/**
 * Painel na parede para expandir a galeria (adicionar mais espaço para obras).
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
  const lockPointer = useGameStore((s) => s.lockPointer)
  const isMobile = useGameStore((s) => s.isMobile)

  const isHost = isRoomHost() || isMultiplayerOffline()
  const canExpand = annexCount < 2 && isHost
  const maxExpansions = 2

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

  const handleExpand = () => {
    if (!canExpand) return

    const newCount = annexCount + 1
    setAnnexCount(newCount)

    publishGalleryState({
      annexCount: newCount,
      artworks: communityArtworks,
    })

    setShowUI(false)
    
    // Re-lock pointer after closing (desktop only)
    if (!isMobile) {
      setTimeout(() => lockPointer(), 100)
    }
  }

  const handleClose = () => {
    setShowUI(false)
    
    // Re-lock pointer after closing (desktop only)
    if (!isMobile) {
      setTimeout(() => lockPointer(), 100)
    }
  }

  useEffect(() => {
    if (!showUI) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showUI])

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
            fontSize: '11px',
            fontWeight: 600,
            textAlign: 'center',
            gap: '4px',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ width: '28px', height: '28px', opacity: 0.9 }}
          >
            <path
              fillRule="evenodd"
              d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
              clipRule="evenodd"
            />
          </svg>
          <div>Expandir</div>
          <div style={{ fontSize: '9px', opacity: 0.7 }}>
            {annexCount}/{maxExpansions}
          </div>
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
            Clique para expandir
          </div>
        </Html>
      )}

      {/* UI de confirmação de expansão */}
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
              pointerEvents: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
              Expandir galeria
            </h3>

            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                lineHeight: 1.5,
                opacity: 0.85,
              }}
            >
              Adicionar mais espaço de parede para expor obras da comunidade.
            </p>

            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  opacity: 0.7,
                  marginBottom: '4px',
                }}
              >
                Progresso de expansão
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                }}
              >
                {annexCount}/{maxExpansions}
              </div>
              <div
                style={{
                  marginTop: '8px',
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(annexCount / maxExpansions) * 100}%`,
                    height: '100%',
                    background: '#16a34a',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {canExpand ? (
              <button
                onClick={handleExpand}
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
                Expandir agora
              </button>
            ) : (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: annexCount >= maxExpansions ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${annexCount >= maxExpansions ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  fontSize: '13px',
                  textAlign: 'center',
                  color: annexCount >= maxExpansions ? '#fbbf24' : '#fca5a5',
                }}
              >
                {annexCount >= maxExpansions
                  ? 'Galeria totalmente expandida'
                  : 'Só o anfitrião pode expandir'}
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
          </div>
        </Html>
      )}
    </group>
  )
}
