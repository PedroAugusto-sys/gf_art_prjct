import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { registerArtwork } from '../systems/artworkTargets'

const FRAME_DEPTH = 0.08
const FRAME_BORDER = 0.12

/**
 * ArtworkFrame: uma obra na parede (moldura 3D + tela texturizada + spotlight).
 *
 * A textura (imagePath) e carregada de forma resiliente: se o arquivo ainda nao
 * existir em public/assets/artworks/, mostramos um placeholder cinza em vez de
 * quebrar a cena. Assim voce pode montar o museu antes de ter todas as imagens.
 *
 * >>> ONDE COLOCAR SUAS IMAGENS <<<
 * public/assets/artworks/  -> e o 'imagePath' no artworks.json aponta para
 * '/assets/artworks/nome-do-arquivo.jpg' (com barra inicial).
 */
export default function ArtworkFrame({ artwork }) {
  const { id, imagePath, title, position, rotation, size } = artwork
  const [width, height] = size || [2, 1.5]

  const openArtwork = useGameStore((s) => s.openArtwork)

  const [texture, setTexture] = useState(null)
  const [hovered, setHovered] = useState(false)
  const canvasMatRef = useRef(null)
  const meshRef = useRef(null)

  // Registra a malha para raycasting via mira
  useEffect(() => {
    registerArtwork(id, meshRef.current)
    return () => registerArtwork(id, null)
  }, [id])

  // ---------- Carregamento resiliente da textura ----------
  useEffect(() => {
    let active = true
    const loader = new THREE.TextureLoader()
    loader.load(
      imagePath,
      (tex) => {
        if (!active) return
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        setTexture(tex)
      },
      undefined,
      () => {
        // Falha (arquivo ausente): mantemos o placeholder. Sem crash.
        if (active) setTexture(null)
      }
    )
    return () => {
      active = false
    }
  }, [imagePath])

  // Materiais da moldura (reaproveitados)
  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.5, metalness: 0.3 }),
    []
  )

  // Realce sutil ao passar o mouse/dedo (emissive na tela)
  useFrame(() => {
    const mat = canvasMatRef.current
    if (!mat) return
    const target = hovered ? 0.25 : 0
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity ?? 0, target, 0.15)
  })

  // ---------- Handlers de raycasting (R3F) ----------
  const handleOver = (e) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer' // muda o cursor no desktop
  }
  const handleOut = (e) => {
    e.stopPropagation()
    setHovered(false)
    document.body.style.cursor = 'auto'
  }
  const handleClick = (e) => {
    e.stopPropagation()
    // So abre se o clique veio de perto (distancia da camera ate a obra <= 2.8 m)
    if (e.distance > 2.8) return
    document.body.style.cursor = 'auto'
    useGameStore.getState().unlockPointer()
    openArtwork(artwork)
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Spotlight direcionado a obra */}
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

      {/* Moldura (borda) */}
      <mesh material={frameMaterial} castShadow>
        <boxGeometry args={[width + FRAME_BORDER * 2, height + FRAME_BORDER * 2, FRAME_DEPTH]} />
      </mesh>

      {/* Tela / area interativa (recebe os eventos de ponteiro e raycast da mira) */}
      <mesh
        ref={meshRef}
        position={[0, 0, FRAME_DEPTH / 2 + 0.001]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
        userData={{ artworkId: id, artwork }}
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
          toneMapped={true}
        />
      </mesh>

      {/* Placa com o titulo (fallback simples enquanto nao ha imagem) */}
      {!texture && (
        <mesh position={[0, -height / 2 - 0.25, FRAME_DEPTH]}>
          <planeGeometry args={[Math.min(width, 1.6), 0.28]} />
          <meshBasicMaterial color="#1f1f1f" />
        </mesh>
      )}
      {/* 'title' fica disponivel para debug/uso futuro (ex.: <Text> do drei) */}
      <group name={`artwork-${title}`} />
    </group>
  )
}
