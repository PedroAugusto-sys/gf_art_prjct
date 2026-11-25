import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { getAnnexRoomBounds, ROOM, ANNEX_CORRIDOR_WIDTH } from '../data/museumLayout'
import { AnnexRoomDecor } from './AnnexDecor'

/**
 * Sala anexa ao norte. Sem luzes próprias: uma luz nova recompila o shader
 * de todo o museu e trava o frame da expansão. A sala usa a luz da galeria.
 * O vão de entrada é a parede norte da sala anterior; aqui só o miolo.
 */
export default function AnnexRoom({ annexIndex, materials, openNorth = false }) {
  const bounds = useMemo(() => getAnnexRoomBounds(annexIndex), [annexIndex])

  const roomDepth = Math.abs(bounds.minZ - bounds.maxZ)
  const entranceOverlap = 0.6
  const shellDepth = roomDepth + entranceOverlap
  const shellCenterZ = bounds.centerZ + entranceOverlap / 2
  const sideWidth = (ROOM.width - ANNEX_CORRIDOR_WIDTH) / 2

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <mesh
          material={materials.floor}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, shellCenterZ]}
          receiveShadow
        >
          <planeGeometry args={[ROOM.width, shellDepth]} />
        </mesh>
        <CuboidCollider
          args={[ROOM.width / 2, 0.1, shellDepth / 2]}
          position={[0, -0.1, shellCenterZ]}
        />

        <mesh
          material={materials.ceiling}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, ROOM.height, shellCenterZ]}
        >
          <planeGeometry args={[ROOM.width, shellDepth]} />
        </mesh>

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

        {[-1, 1].map((side) => {
          const sideX = side * (ANNEX_CORRIDOR_WIDTH / 2 + sideWidth / 2)
          return (
            <group key={`annex-north-${side}`}>
              <mesh
                material={materials.wall}
                position={[sideX, ROOM.height / 2, bounds.minZ]}
                receiveShadow
              >
                <boxGeometry args={[sideWidth, ROOM.height, ROOM.wallThickness]} />
              </mesh>
              <CuboidCollider
                args={[sideWidth / 2, ROOM.height / 2, ROOM.wallThickness / 2]}
                position={[sideX, ROOM.height / 2, bounds.minZ]}
              />
            </group>
          )
        })}
        {!openNorth && (
          <>
            <mesh
              material={materials.wall}
              position={[0, ROOM.height / 2, bounds.minZ]}
              receiveShadow
            >
              <boxGeometry args={[ANNEX_CORRIDOR_WIDTH, ROOM.height, ROOM.wallThickness]} />
            </mesh>
            <CuboidCollider
              args={[ANNEX_CORRIDOR_WIDTH / 2, ROOM.height / 2, ROOM.wallThickness / 2]}
              position={[0, ROOM.height / 2, bounds.minZ]}
            />
          </>
        )}

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

        <AnnexRoomDecor annexIndex={annexIndex} />
      </RigidBody>
    </group>
  )
}
