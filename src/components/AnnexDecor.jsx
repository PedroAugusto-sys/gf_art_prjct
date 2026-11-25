import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider } from '@react-three/rapier'
import * as THREE from 'three'
import Vegetation from './Vegetation'
import { annexLayout, annexVegetation } from '../systems/annexDecor'

const stone = new THREE.MeshStandardMaterial({ color: '#d9d3c7', roughness: 0.86 })
const pathMat = new THREE.MeshStandardMaterial({
  color: '#c9bfb0',
  roughness: 0.95,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
})
const waterMat = new THREE.MeshStandardMaterial({
  color: '#7eb6c9',
  roughness: 0.18,
  metalness: 0.08,
  transparent: true,
  opacity: 0.88,
})

function Fountain({ x, z, radius }) {
  const water = useRef(null)
  useFrame(({ clock }) => {
    if (!water.current) return
    const t = clock.elapsedTime
    water.current.position.y = 0.52 + Math.sin(t * 1.4) * 0.015
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]} material={stone} receiveShadow>
        <cylinderGeometry args={[radius, radius + 0.1, 0.56, 8]} />
      </mesh>
      <mesh ref={water} position={[0, 0.52, 0]} material={waterMat}>
        <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.08, 8]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} material={stone}>
        <cylinderGeometry args={[0.08, 0.11, 0.7, 6]} />
      </mesh>
      <mesh position={[0, 1.28, 0]} material={waterMat}>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <CylinderCollider args={[0.45, radius]} position={[0, 0.45, 0]} />
    </group>
  )
}

/** Decoração de uma sala anexa. Os colisores precisam estar num RigidBody. */
export function AnnexRoomDecor({ annexIndex }) {
  const layout = annexLayout(annexIndex)
  return (
    <group>
      <mesh
        material={pathMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[layout.path.x, 0.025, layout.path.z]}
        receiveShadow
      >
        <planeGeometry args={[layout.path.width, layout.path.length]} />
      </mesh>
      <Fountain x={layout.fountain.x} z={layout.fountain.z} radius={layout.fountain.radius} />
      {layout.trees.map((tree) => (
        <CylinderCollider
          key={`tree-${tree.x}-${tree.z}`}
          args={[tree.height * 0.28, 0.28]}
          position={[tree.x, tree.height * 0.28, tree.z]}
        />
      ))}
    </group>
  )
}

/** Árvores de todas as salas abertas, num único par de instâncias. */
export function AnnexTrees({ annexCount }) {
  if (!annexCount) return null
  const plants = annexVegetation(annexCount)
  return <Vegetation trunks={plants.trunks} canopy={plants.canopy} shrubs={plants.shrubs} castShadow={false} />
}
