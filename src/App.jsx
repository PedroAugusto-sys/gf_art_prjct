import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { AdaptiveDpr, Preload, Sky, useGLTF } from '@react-three/drei'

import { useGameStore } from './store'
import Player from './components/Player'
import MuseumEnvironment from './components/MuseumEnvironment'
import ArtworkFrame from './components/ArtworkFrame'
import VisitorLayer, { VisitorFlowTicker } from './components/NPC'
import DoubleDoor from './components/Door'
import Parking from './components/Parking'
import UIOverlay from './components/UIOverlay'
import ArtworkFocus from './components/ArtworkFocus'
import RemotePlayers from './components/RemotePlayers'
import artworksData from './data/artworks.json'
import { HALF_D } from './data/museumLayout'

// ---------- DRACO ----------
// Habilita a descompressao DRACO para modelos .glb/.gltf otimizados.
// O decoder e servido pela CDN oficial do three.js (evita hospedar os wasm localmente).
// Ao chamar useGLTF('/modelo.glb', true), o drei usa este decoder automaticamente.
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

export default function App() {
  const isMobile = useGameStore((s) => s.isMobile)
  const isStarted = useGameStore((s) => s.isStarted)
  const mpReady = useGameStore((s) => s.mpReady)
  const mpOffline = useGameStore((s) => s.mpOffline)

  const artworks = artworksData.artworks || []
  const showRemotes = isStarted && mpReady && !mpOffline

  return (
    <div className="fixed inset-0">
      <Canvas
        shadows="soft"
        dpr={isMobile ? [1, 1.2] : [1, 1.5]}
        camera={{ fov: 70, near: 0.15, far: 300, position: [0, 2.8, 12] }}
        gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        <Sky sunPosition={[18, 26, 22]} turbidity={6} rayleigh={1.4} />
        <fog attach="fog" args={['#dbe4e2', 80, 220]} />

        <Suspense fallback={null}>
          <VisitorFlowTicker />

          <Physics gravity={[0, -9.81, 0]}>
            <Player position={[0, 2, 12]} />
            <MuseumEnvironment />

            {artworks.map((art) => (
              <ArtworkFrame key={art.id} artwork={art} />
            ))}

            <DoubleDoor centerX={-3.5} wallZ={HALF_D} />
            <DoubleDoor centerX={3.5} wallZ={HALF_D} />
          </Physics>

          <Parking />
          <VisitorLayer />
          {showRemotes && <RemotePlayers />}
          <ArtworkFocus />
          <Preload all />
        </Suspense>

        <AdaptiveDpr pixelated />
      </Canvas>

      <UIOverlay />
    </div>
  )
}
