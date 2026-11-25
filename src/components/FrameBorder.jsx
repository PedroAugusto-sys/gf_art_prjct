/**
 * Moldura só nas bordas. Um bloco sólido atrás da tela ficava a 1 mm
 * dela e, ao andar, o depth buffer trocava os dois — a obra piscava.
 */

export { CANVAS_DEPTH, CANVAS_Z, FRAME_BORDER, FRAME_DEPTH } from '../systems/frameDepth'
import { FRAME_BORDER, FRAME_DEPTH } from '../systems/frameDepth'

export default function FrameBorder({ width, height, material }) {
  const bar = FRAME_BORDER
  const y = (height + bar) / 2
  const x = (width + bar) / 2
  return (
    <group>
      <mesh material={material} position={[0, y, 0]} castShadow>
        <boxGeometry args={[width + bar * 2, bar, FRAME_DEPTH]} />
      </mesh>
      <mesh material={material} position={[0, -y, 0]} castShadow>
        <boxGeometry args={[width + bar * 2, bar, FRAME_DEPTH]} />
      </mesh>
      <mesh material={material} position={[-x, 0, 0]} castShadow>
        <boxGeometry args={[bar, height, FRAME_DEPTH]} />
      </mesh>
      <mesh material={material} position={[x, 0, 0]} castShadow>
        <boxGeometry args={[bar, height, FRAME_DEPTH]} />
      </mesh>
    </group>
  )
}
