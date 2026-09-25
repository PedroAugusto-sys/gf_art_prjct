import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useMemo } from 'react'
import { getAnnexRoomBounds, ROOM, ANNEX_CORRIDOR_WIDTH } from '../data/museumLayout'

/**
 * Sala anexa ao norte da sala principal.
 * Renderizada dinamicamente baseada no annexCount.
 */
export default function AnnexRoom({ annexIndex, materials }) {
  const bounds = useMemo(() => getAnnexRoomBounds(annexIndex), [annexIndex])

  const corridorZ = bounds.maxZ + ROOM.wallThickness / 2

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {/* Piso da sala anexa */}
        <mesh
          material={materials.floor}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, bounds.centerZ]}
          receiveShadow
        >
          <planeGeometry args={[ROOM.width, Math.abs(bounds.minZ - bounds.maxZ)]} />
        </mesh>
        <CuboidCollider
          args={[ROOM.width / 2, 0.1, Math.abs(bounds.minZ - bounds.maxZ) / 2]}
          position={[0, -0.1, bounds.centerZ]}
        />

        {/* Parede norte da sala anexa */}
        <mesh
          material={materials.wall}
          position={[0, ROOM.height / 2, bounds.minZ]}
          receiveShadow
        >
          <boxGeometry args={[ROOM.width, ROOM.height, ROOM.wallThickness]} />
        </mesh>
        <CuboidCollider
          args={[ROOM.width / 2, ROOM.height / 2, ROOM.wallThickness / 2]}
          position={[0, ROOM.height / 2, bounds.minZ]}
        />

        {/* Paredes laterais da sala anexa */}
        {[-1, 1].map((side) => (
          <group key={`annex-side-${side}`}>
            <mesh
              material={materials.wall}
              position={[side * (ROOM.width / 2), ROOM.height / 2, bounds.centerZ]}
              receiveShadow
            >
              <boxGeometry
                args={[ROOM.wallThickness, ROOM.height, Math.abs(bounds.minZ - bounds.maxZ)]}
              />
            </mesh>
            <CuboidCollider
              args={[
                ROOM.wallThickness / 2,
                ROOM.height / 2,
                Math.abs(bounds.minZ - bounds.maxZ) / 2,
              ]}
              position={[side * (ROOM.width / 2), ROOM.height / 2, bounds.centerZ]}
            />
          </group>
        ))}

        {/* Abertura do corredor (paredes laterais ao corredor) */}
        {[-1, 1].map((side) => {
          const sideWidth = (ROOM.width - ANNEX_CORRIDOR_WIDTH) / 2
          const sideX = side * (ANNEX_CORRIDOR_WIDTH / 2 + sideWidth / 2)

          return (
            <group key={`corridor-wall-${side}`}>
              <mesh
                material={materials.wall}
                position={[sideX, ROOM.height / 2, corridorZ]}
                receiveShadow
              >
                <boxGeometry args={[sideWidth, ROOM.height, ROOM.wallThickness]} />
              </mesh>
              <CuboidCollider
                args={[sideWidth / 2, ROOM.height / 2, ROOM.wallThickness / 2]}
                position={[sideX, ROOM.height / 2, corridorZ]}
              />
            </group>
          )
        })}
      </RigidBody>
    </group>
  )
}
