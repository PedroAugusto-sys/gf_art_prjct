/**
 * VisitorModel: corpo procedural + nametag + bolha de fala.
 * Usado por NPCs locais, NPCs remotos (snapshot) e jogadores remotos.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { DEFAULT_APPEARANCE } from '../systems/appearance'

const STEP_FREQ = 7.4

const GEO = {
  head: new THREE.SphereGeometry(0.115, 16, 12),
  hair: new THREE.SphereGeometry(0.121, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  neck: new THREE.CylinderGeometry(0.05, 0.055, 0.09, 8),
  torso: new THREE.CapsuleGeometry(0.16, 0.2, 6, 14),
  pelvis: new THREE.CapsuleGeometry(0.15, 0.07, 6, 14),
  joint: new THREE.SphereGeometry(0.068, 10, 8),
  upperArm: new THREE.CapsuleGeometry(0.05, 0.15, 5, 10),
  foreArm: new THREE.CapsuleGeometry(0.044, 0.15, 5, 10),
  hand: new THREE.SphereGeometry(0.05, 8, 8),
  thigh: new THREE.CapsuleGeometry(0.078, 0.19, 5, 10),
  shin: new THREE.CapsuleGeometry(0.066, 0.21, 5, 10),
  foot: new THREE.BoxGeometry(0.11, 0.07, 0.25),
  skirt: new THREE.CylinderGeometry(0.17, 0.3, 0.36, 14, 1, true),
  coat: new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12, 1, true),
}

const materialCache = new Map()
function sharedMaterial(color, roughness = 0.8, side = THREE.FrontSide) {
  const key = `${color}|${roughness}|${side}`
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, side }))
  }
  return materialCache.get(key)
}

const blobGeo = new THREE.CircleGeometry(0.3, 16)
blobGeo.rotateX(-Math.PI / 2)
const blobMat = new THREE.MeshBasicMaterial({
  color: '#000000',
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
})

const _blobWorldPos = new THREE.Vector3()

export function BlobShadow({ target }) {
  const meshRef = useRef(null)
  useFrame(() => {
    if (!meshRef.current || !target.current) return
    const wp = target.current.getWorldPosition(_blobWorldPos)
    meshRef.current.position.set(wp.x, 0.003, wp.z)
  })
  return <mesh ref={meshRef} geometry={blobGeo} material={blobMat} renderOrder={1} />
}

function VisitorBody({ appearance = DEFAULT_APPEARANCE, outfit = 'shirt', motion, headPitch = 0 }) {
  const torso = useRef(null)
  const head = useRef(null)
  const leftLeg = useRef(null)
  const rightLeg = useRef(null)
  const leftKnee = useRef(null)
  const rightKnee = useRef(null)
  const leftArm = useRef(null)
  const rightArm = useRef(null)
  const leftElbow = useRef(null)
  const rightElbow = useRef(null)
  const phase = useRef(Math.random() * Math.PI * 2)

  const mats = useMemo(
    () => ({
      skin: sharedMaterial(appearance.skin, 0.72),
      hair: sharedMaterial(appearance.hair, 0.88),
      shirt: sharedMaterial(appearance.shirt, 0.78),
      pants: sharedMaterial(appearance.pants, 0.8),
      shoes: sharedMaterial(appearance.shoes, 0.55),
      outerwear: sharedMaterial(appearance.shirt, 0.78, THREE.DoubleSide),
    }),
    [appearance]
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const walking = motion?.current?.walking
    const viewing = motion?.current?.viewing
    const time = state.clock.elapsedTime

    phase.current += dt * (walking ? STEP_FREQ : 1.6)
    const p = phase.current
    const swing = Math.sin(p) * (walking ? 0.58 : 0.05)
    const bob = Math.abs(Math.sin(p)) * (walking ? 0.032 : 0.006)

    if (leftLeg.current) leftLeg.current.rotation.x = swing
    if (rightLeg.current) rightLeg.current.rotation.x = -swing
    if (leftKnee.current) leftKnee.current.rotation.x = -Math.max(0, -Math.sin(p)) * (walking ? 1.0 : 0.08)
    if (rightKnee.current) rightKnee.current.rotation.x = -Math.max(0, Math.sin(p)) * (walking ? 1.0 : 0.08)
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.7
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.7
    const eb = walking ? 0.35 : 0.2
    if (leftElbow.current) leftElbow.current.rotation.x = eb + Math.max(0, -swing) * 0.4
    if (rightElbow.current) rightElbow.current.rotation.x = eb + Math.max(0, swing) * 0.4

    if (torso.current) {
      torso.current.position.y = bob
      torso.current.rotation.z = viewing ? Math.sin(time * 0.6) * 0.03 : 0
    }
    if (head.current) {
      head.current.rotation.y = viewing ? Math.sin(time * 0.45) * 0.34 : 0
      head.current.rotation.x =
        (viewing ? Math.sin(time * 0.3) * 0.08 : 0) + headPitch * 0.35
    }
  })

  return (
    <group>
      <group ref={torso}>
        <mesh geometry={GEO.pelvis} material={mats.pants} position={[0, 0.95, 0]} />
        <mesh geometry={GEO.torso} material={mats.shirt} position={[0, 1.26, 0]} />
        {outfit === 'dress' && (
          <mesh geometry={GEO.skirt} material={mats.outerwear} position={[0, 0.86, 0]} />
        )}
        {outfit === 'coat' && (
          <mesh geometry={GEO.coat} material={mats.outerwear} position={[0, 1.06, 0]} />
        )}
        <mesh geometry={GEO.joint} material={mats.shirt} position={[-0.19, 1.44, 0]} />
        <mesh geometry={GEO.joint} material={mats.shirt} position={[0.19, 1.44, 0]} />
        <mesh geometry={GEO.neck} material={mats.skin} position={[0, 1.55, 0]} />
        <group ref={head} position={[0, 1.68, 0]}>
          <mesh geometry={GEO.head} material={mats.skin} />
          <mesh geometry={GEO.hair} material={mats.hair} position={[0, 0.012, 0]} />
        </group>
        <group ref={leftArm} position={[-0.21, 1.43, 0]}>
          <mesh geometry={GEO.upperArm} material={mats.shirt} position={[0, -0.125, 0]} />
          <group ref={leftElbow} position={[0, -0.25, 0]}>
            <mesh geometry={GEO.foreArm} material={mats.skin} position={[0, -0.12, 0]} />
            <mesh geometry={GEO.hand} material={mats.skin} position={[0, -0.25, 0]} />
          </group>
        </group>
        <group ref={rightArm} position={[0.21, 1.43, 0]}>
          <mesh geometry={GEO.upperArm} material={mats.shirt} position={[0, -0.125, 0]} />
          <group ref={rightElbow} position={[0, -0.25, 0]}>
            <mesh geometry={GEO.foreArm} material={mats.skin} position={[0, -0.12, 0]} />
            <mesh geometry={GEO.hand} material={mats.skin} position={[0, -0.25, 0]} />
          </group>
        </group>
      </group>

      <group ref={leftLeg} position={[-0.1, 0.9, 0]}>
        <mesh geometry={GEO.thigh} material={mats.pants} position={[0, -0.22, 0]} />
        <group ref={leftKnee} position={[0, -0.45, 0]}>
          <mesh geometry={GEO.shin} material={mats.pants} position={[0, -0.18, 0]} />
          <mesh geometry={GEO.foot} material={mats.shoes} position={[0, -0.38, 0.06]} />
        </group>
      </group>
      <group ref={rightLeg} position={[0.1, 0.9, 0]}>
        <mesh geometry={GEO.thigh} material={mats.pants} position={[0, -0.22, 0]} />
        <group ref={rightKnee} position={[0, -0.45, 0]}>
          <mesh geometry={GEO.shin} material={mats.pants} position={[0, -0.18, 0]} />
          <mesh geometry={GEO.foot} material={mats.shoes} position={[0, -0.38, 0.06]} />
        </group>
      </group>
    </group>
  )
}

/**
 * @param {{
 *   appearance, outfit, motion,
 *   name?: string,
 *   speech?: string | null,
 *   viewingArt?: boolean,
 *   headPitch?: number,
 * }} props
 */
export default function VisitorModel({
  appearance,
  outfit = 'shirt',
  motion,
  name,
  speech,
  viewingArt = false,
  headPitch = 0,
}) {
  return (
    <group>
      <VisitorBody
        appearance={appearance}
        outfit={outfit}
        motion={motion}
        headPitch={headPitch}
      />
      {(name || speech) && (
        <Html
          position={[0, 2.05, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[10, 0]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {speech && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  color: '#1a1a1a',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: 10,
                  maxWidth: 160,
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  lineHeight: 1.3,
                }}
              >
                {speech}
              </div>
            )}
            {name && (
              <div
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {viewingArt && <span style={{ opacity: 0.85 }}>◉</span>}
                {name}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
