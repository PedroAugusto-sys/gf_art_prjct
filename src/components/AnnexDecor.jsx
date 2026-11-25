import { CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import Vegetation from './Vegetation'
import { annexLayout, annexVegetation } from '../systems/annexDecor'
import { BED_HEIGHT } from '../data/museumLayout'

const benchWood = new THREE.MeshStandardMaterial({ color: '#5a4634', roughness: 0.6 })
const bedRim = new THREE.MeshStandardMaterial({ color: '#cfc7b8', roughness: 0.9 })
const grass = new THREE.MeshStandardMaterial({ color: '#5f8a4a', roughness: 1 })
const pathMat = new THREE.MeshStandardMaterial({
  color: '#c9bfb0',
  roughness: 0.95,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
})

/** Bancos e canteiros de uma sala anexa. Os colisores precisam estar num RigidBody. */
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
      {layout.benches.map((bench) => (
        <group key={`bench-${bench.x}`} position={[bench.x, 0, bench.z]} rotation={[0, bench.rotY, 0]}>
          <mesh material={benchWood} position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 0.5, 0.8]} />
          </mesh>
          <CuboidCollider args={[1.2, 0.25, 0.4]} position={[0, 0.25, 0]} />
        </group>
      ))}
      {layout.beds.map((bed) => (
        <group key={bed.id} position={[bed.pos[0], 0, bed.pos[1]]}>
          <mesh material={bedRim} position={[0, BED_HEIGHT / 2, 0]} receiveShadow>
            <boxGeometry args={[bed.size[0], BED_HEIGHT, bed.size[1]]} />
          </mesh>
          <mesh material={grass} position={[0, BED_HEIGHT + 0.02, 0]} receiveShadow>
            <boxGeometry args={[bed.size[0] - 0.28, 0.06, bed.size[1] - 0.28]} />
          </mesh>
          <CuboidCollider
            args={[bed.size[0] / 2, BED_HEIGHT / 2, bed.size[1] / 2]}
            position={[0, BED_HEIGHT / 2, 0]}
          />
        </group>
      ))}
    </group>
  )
}

/** Árvores e arbustos de todas as salas abertas, num único lote instanciado. */
export function AnnexTrees({ annexCount }) {
  if (!annexCount) return null
  const plants = annexVegetation(annexCount)
  return (
    <Vegetation
      trunks={plants.trunks}
      canopy={plants.canopy}
      shrubs={plants.shrubs}
      castShadow={false}
    />
  )
}
