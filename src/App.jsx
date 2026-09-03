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
import artworksData from './data/artworks.json'
import { HALF_D } from './data/museumLayout'

// ---------- DRACO ----------
// Habilita a descompressao DRACO para modelos .glb/.gltf otimizados.
// O decoder e servido pela CDN oficial do three.js (evita hospedar os wasm localmente).
// Ao chamar useGLTF('/modelo.glb', true), o drei usa este decoder automaticamente.
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

export default function App() {
  const isMobile = useGameStore((s) => s.isMobile)

  // Apenas as obras devidamente configuradas no JSON sao renderizadas.
  const artworks = artworksData.artworks || []

  return (
    <div className="fixed inset-0">
      <Canvas
        shadows
        // Limita o pixel ratio: no mobile, DPR alto superaquece e derruba o FPS.
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        camera={{ fov: 70, near: 0.1, far: 400, position: [0, 2.8, 12] }}
        gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
      >
        {/* Ceu real: o jardim externo aparece pela fachada de vidro da parede sul */}
        <Sky sunPosition={[18, 26, 22]} turbidity={6} rayleigh={1.4} />
        <fog attach="fog" args={['#dbe4e2', 80, 220]} />

        <Suspense fallback={null}>
          {/*
            Primeiro na arvore: avanca o relogio da simulacao e cuida do
            spawn/despawn. Precisa rodar antes dos NPCs e das portas para que
            todos leiam o mesmo instante no mesmo frame.
          */}
          <VisitorFlowTicker />

          {/* Gravidade padrao da Terra. Rapier resolve colisoes com o mundo. */}
          <Physics gravity={[0, -9.81, 0]}>
            <Player position={[0, 2, 12]} />
            <MuseumEnvironment />

            {/* Obras instanciadas dinamicamente a partir do artworks.json */}
            {artworks.map((art) => (
              <ArtworkFrame key={art.id} artwork={art} />
            ))}

            {/* Portas duplas de vidro com fisica e animacao por proximidade */}
            <DoubleDoor centerX={-3.5} wallZ={HALF_D} />
            <DoubleDoor centerX={3.5}  wallZ={HALF_D} />
          </Physics>

          {/* Estacionamento externo */}
          <Parking />

          {/* Visitantes dinamicos: entram pelas portas, visitam obras, saem e somem */}
          <VisitorLayer />

          {/* Raycast pela mira: detecta obra em foco e habilita tecla E */}
          <ArtworkFocus />

          {/* Faz o preload dos assets ja carregados para evitar "pop-in" */}
          <Preload all />
        </Suspense>

        {/* Reduz a resolucao dinamicamente sob carga para manter o FPS */}
        <AdaptiveDpr pixelated />
      </Canvas>

      {/* UI HTML sobreposta (fora do Canvas): tela inicial, mira, modal e controles mobile */}
      <UIOverlay />
    </div>
  )
}
