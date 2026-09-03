/**
 * Ambiente da versao inicial: aspecto de prototipo / blockout.
 * Sem paredes, pilares nem arvores — chao em grade, limites wireframe e marcacoes no chao.
 */

import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM } from '../data/museumLayout'

/** Apenas marcacoes no chao (sem texto). */
const FLOOR_MARKS = [
  [-8, 0.02, -10],
  [8, 0.02, -10],
  [0, 0.02, 0],
  [-6, 0.02, 10],
  [6, 0.02, 8],
]

function WireRoomOutline() {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(ROOM.width, ROOM.height, ROOM.depth)
    const edges = new THREE.EdgesGeometry(g)
    g.dispose()
    return edges
  }, [])
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ff7a18', transparent: true, opacity: 0.55 }),
    []
  )
  return (
    <lineSegments
      geometry={geo}
      material={mat}
      position={[0, ROOM.height / 2, 0]}
    />
  )
}

function PlaceholderBlocks() {
  const blocks = [
    { pos: [-9, 0.5, -12], size: [1, 1, 1] },
    { pos: [9, 0.5, -12], size: [1, 1, 1] },
    { pos: [-9, 0.5, 12], size: [1, 1, 1] },
    { pos: [9, 0.5, 12], size: [1, 1, 1] },
    { pos: [0, 0.25, -8], size: [2.4, 0.5, 0.8] },
  ]
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color="#6b7280"
            wireframe={i < 4}
            transparent
            opacity={i < 4 ? 0.7 : 0.9}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function PrototypeEnvironment() {
  return (
    <group>
      <color attach="background" args={['#1a1d22']} />
      <fog attach="fog" args={['#1a1d22', 40, 120]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={0.85} color="#ffe0c0" />
      <hemisphereLight args={['#8899aa', '#222222', 0.5]} />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[40, 0.1, 40]} position={[0, -0.1, 0]} />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#2a2e35" roughness={1} metalness={0} />
      </mesh>

      <Grid
        args={[80, 80]}
        cellSize={1}
        sectionSize={5}
        cellColor="#3d4654"
        sectionColor="#ff7a18"
        fadeDistance={70}
        fadeStrength={1.2}
        position={[0, 0.01, 0]}
      />

      <WireRoomOutline />
      <PlaceholderBlocks />

      {FLOOR_MARKS.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.35, 0.04, 0.35]} />
          <meshBasicMaterial color="#ff7a18" />
        </mesh>
      ))}

      <Html position={[0, 2.5, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 16,
            color: '#ff7a18',
            fontWeight: 700,
            background: 'rgba(20,20,24,0.85)',
            padding: '10px 18px',
            borderRadius: 6,
            border: '1px dashed #ff7a18',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          meu museu
        </div>
      </Html>
    </group>
  )
}
