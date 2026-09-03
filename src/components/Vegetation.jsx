import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Vegetacao low-poly desenhada com instancing: todos os troncos saem em uma
 * draw call, todas as copas em outra, todos os arbustos em uma terceira.
 *
 * A cor vem por instancia, entao os materiais base sao brancos.
 *
 * frustumCulled={false} e obrigatorio: o <Instances> do drei calcula a esfera
 * delimitadora antes das matrizes existirem, e sem isso o lote inteiro some
 * assim que o centro dele sai do campo de visao.
 */

const trunkGeometry = new THREE.CylinderGeometry(0.055, 0.09, 1, 7)
const canopyGeometry = new THREE.IcosahedronGeometry(1, 1)
const shrubGeometry = new THREE.IcosahedronGeometry(1, 1)

export default function Vegetation({ trunks, canopy, shrubs, castShadow = true }) {
  const materials = useMemo(
    () => ({
      trunk: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
      canopy: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }),
      shrub: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }),
    }),
    []
  )

  return (
    <group>
      <Instances
        geometry={trunkGeometry}
        material={materials.trunk}
        limit={400}
        frustumCulled={false}
        castShadow={castShadow}
      >
        {trunks.map((t) => (
          <Instance key={t.key} position={t.position} scale={t.scale} color={t.color} />
        ))}
      </Instances>

      <Instances
        geometry={canopyGeometry}
        material={materials.canopy}
        limit={600}
        frustumCulled={false}
        castShadow={castShadow}
      >
        {canopy.map((c) => (
          <Instance
            key={c.key}
            position={c.position}
            scale={c.scale}
            rotation={c.rotation}
            color={c.color}
          />
        ))}
      </Instances>

      <Instances
        geometry={shrubGeometry}
        material={materials.shrub}
        limit={400}
        frustumCulled={false}
        castShadow={castShadow}
      >
        {shrubs.map((s) => (
          <Instance key={s.key} position={s.position} scale={s.scale} color={s.color} />
        ))}
      </Instances>
    </group>
  )
}
