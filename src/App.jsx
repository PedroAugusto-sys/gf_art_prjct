import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { AdaptiveDpr, Preload, Sky, useGLTF } from '@react-three/drei'

import { useGameStore } from './store'
import Player from './components/Player'
import MuseumEnvironment from './components/MuseumEnvironment'
import PrototypeEnvironment from './components/PrototypeEnvironment'
import ArtworkFrame from './components/ArtworkFrame'
import EmptyFrame from './components/EmptyFrame'
import VisitorLayer, { VisitorFlowTicker } from './components/NPC'
import DoubleDoor from './components/Door'
import Parking from './components/Parking'
import UIOverlay from './components/UIOverlay'
import ArtworkFocus from './components/ArtworkFocus'
import RemotePlayers from './components/RemotePlayers'
import { GallerySync } from './components/GallerySync'
import { TemporaryArtworkSession } from './components/TemporaryArtworkSession'
import artworksData from './data/artworks.json'
import { HALF_D, getCommunityFrameLayouts } from './data/museumLayout'
import { frameIsOpen } from './systems/galleryExpansion'
import ShaderWarmup from './components/ShaderWarmup'
import AnnexNavSync from './components/AnnexNavSync'
import { getVersionById } from './data/versions'

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

export default function App() {
  const isMobile = useGameStore((s) => s.isMobile)
  const isStarted = useGameStore((s) => s.isStarted)
  const mpReady = useGameStore((s) => s.mpReady)
  const mpOffline = useGameStore((s) => s.mpOffline)
  const selectedVersionId = useGameStore((s) => s.selectedVersionId)
  const prototype = !!getVersionById(selectedVersionId)?.flags?.prototypeScene
  const hasCommunityGallery = !!getVersionById(selectedVersionId)?.flags?.communityGallery

  const artworks = artworksData.artworks || []
  const showRemotes = isStarted && mpReady && !mpOffline

  const annexCount = useGameStore((s) => s.annexCount)
  const communityFrames = hasCommunityGallery ? getCommunityFrameLayouts(2) : []

  return (
    <div className="fixed inset-0">
      <Canvas
        shadows={prototype ? false : 'soft'}
        dpr={isMobile ? [1, 1.2] : [1, 1.5]}
        camera={{ fov: 70, near: 0.12, far: 140, position: [0, 2.8, 12] }}
        gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
      >
        {!prototype && (
          <>
            <Sky sunPosition={[18, 26, 22]} turbidity={6} rayleigh={1.4} />
            <fog attach="fog" args={['#dbe4e2', 80, 220]} />
          </>
        )}

        <Suspense fallback={null}>
          <VisitorFlowTicker />

          <Physics gravity={[0, -9.81, 0]}>
            <Player position={[0, 2, 8]} />
            {prototype ? <PrototypeEnvironment /> : <MuseumEnvironment />}

            {artworks.map((art) => (
              <ArtworkFrame key={art.id} artwork={art} />
            ))}

            {communityFrames.map((frame) => (
              <group key={frame.id} visible={frameIsOpen(frame.id, annexCount)}>
                <EmptyFrame
                  frameId={frame.id}
                  position={frame.position}
                  rotation={frame.rotation}
                  size={frame.size}
                />
              </group>
            ))}

            {!prototype && (
              <>
                <DoubleDoor centerX={-3.5} wallZ={HALF_D} />
                <DoubleDoor centerX={3.5} wallZ={HALF_D} />
              </>
            )}
          </Physics>

          {!prototype && <Parking />}
          <VisitorLayer />
          {showRemotes && <RemotePlayers />}
          <ArtworkFocus />
          <AnnexNavSync />
          <ShaderWarmup />
          <Preload all />
        </Suspense>

        <AdaptiveDpr pixelated />
      </Canvas>

      <UIOverlay />
      <GallerySync />
      <TemporaryArtworkSession />
    </div>
  )
}
