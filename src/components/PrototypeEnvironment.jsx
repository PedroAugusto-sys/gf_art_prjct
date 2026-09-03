/**
 * Ambiente da versao inicial: aspecto de prototipo / blockout.
 * Sem paredes, pilares nem arvores — so chao em grade, limites wireframe e marcadores WIP.
 * Multiplayer continua ativo (Player + RemotePlayers fora daqui).
 */

import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { HALF_W, HALF_D, ROOM } from '../data/museumLayout'

const WIP_MARKERS = [
  { pos: [-8, 0.02, -10], label: 'WIP · parede N' },
  { pos: [8, 0.02, -10], label: 'TODO · obras' },
  { pos: [0, 0.02, 0], label: 'prototype v0' },
  { pos: [-6, 0.02, 10], label: 'placeholder' },
  { pos: [6, 0.02, 8], label: 'dev build' },
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
  // Cubos solidos simples onde um dia haveria estrutura — sensacao de blockout
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

      {/* Chao fisico infinito o bastante para andar */}
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

      {/* Eixos de referencia (dev) */}
      <axesHelper args={[4]} position={[-HALF_W + 1, 0.05, HALF_D - 1]} />

      {WIP_MARKERS.map((m) => (
        <group key={m.label} position={m.pos}>
          <mesh>
            <boxGeometry args={[0.35, 0.04, 0.35]} />
            <meshBasicMaterial color="#ff7a18" />
          </mesh>
          <Html position={[0, 0.6, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                color: '#ffb86a',
                background: 'rgba(0,0,0,0.65)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid #ff7a18',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </div>
          </Html>
        </group>
      ))}

      {/* Placa central de prototipo */}
      <Html position={[0, 2.5, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
            color: '#e8e8e8',
            background: 'rgba(20,20,24,0.85)',
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px dashed #ff7a18',
            textAlign: 'center',
            maxWidth: 260,
          }}
        >
          <div style={{ color: '#ff7a18', fontWeight: 700, marginBottom: 4 }}>MUSEU · PROTOTYPE</div>
          <div style={{ opacity: 0.75, fontSize: 11 }}>
            v0 · blockout · sem paredes / pilares / vegetação
          </div>
        </div>
      </Html>
    </group>
  )
}
