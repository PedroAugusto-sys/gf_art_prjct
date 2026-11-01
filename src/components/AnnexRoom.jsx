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
      {/* Iluminação ambiente da sala anexa */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[0, ROOM.height - 1, bounds.centerZ]}
        intensity={0.8}
        color="#fff6e6"
        target-position={[0, 0, bounds.centerZ]}
      />
      
      {/* Spotlights nas paredes laterais para os quadros */}
      {[-1, 1].map((side) => (
        <group key={`annex-lights-${side}`}>
          <spotLight
            position={[side * 10, ROOM.height - 1, bounds.centerZ - 6]}
            angle={0.6}
            penumbra={0.7}
            intensity={10}
            distance={12}
            color="#fff6e8"
            target-position={[side * 13.7, 2.2, bounds.centerZ - 6]}
          />
          <spotLight
            position={[side * 10, ROOM.height - 1, bounds.centerZ]}
            angle={0.6}
            penumbra={0.7}
            intensity={10}
            distance={12}
            color="#fff6e8"
            target-position={[side * 13.7, 2.2, bounds.centerZ]}
          />
        </group>
      ))}
      
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
        
        {/* Teto da sala anexa */}
        <mesh 
          material={materials.ceiling} 
          rotation={[Math.PI / 2, 0, 0]} 
          position={[0, ROOM.height, bounds.centerZ]}
        >
          <planeGeometry args={[ROOM.width, Math.abs(bounds.minZ - bounds.maxZ)]} />
        </mesh>
        
        {/* Faixas luminosas no teto */}
        {[-6, 0, 6].map((x) => (
          <mesh
            key={`annex-skylight-${x}`}
            material={materials.skylight}
            rotation={[Math.PI / 2, 0, 0]}
            position={[x, ROOM.height - 0.05, bounds.centerZ]}
          >
            <planeGeometry args={[1.6, Math.abs(bounds.minZ - bounds.maxZ) - 6]} />
          </mesh>
        ))}

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
