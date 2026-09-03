import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'

import { useGameStore } from '../store'
import Vegetation from './Vegetation'
import {
  ROOM,
  HALF_W,
  HALF_D,
  PILLAR_POSITIONS,
  BENCH_POSITIONS,
  GARDEN_BEDS,
  BED_HEIGHT,
  POTS,
  FACADE,
  DOORS,
  INDOOR_VEGETATION,
  OUTDOOR_VEGETATION,
} from '../data/museumLayout'

/**
 * MuseumEnvironment: geometria, colisoes, jardim e iluminacao da sala.
 *
 * A parede sul e uma fachada de vidro: o painel central segura a obra e as
 * duas laterais abrem para o jardim externo.
 *
 * Todo <Instances> leva frustumCulled={false}. Sem isso o drei calcula a
 * esfera delimitadora com as matrizes ainda zeradas e o lote inteiro
 * (pilares, bancos, vegetacao) desaparece ao andar pela sala.
 */
export default function MuseumEnvironment() {
  const isMobile = useGameStore((s) => s.isMobile)

  const materials = useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.85, metalness: 0.05 }),
      wall: new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.95 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#e8e5df', roughness: 1 }),
      skylight: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#fff8ec',
        emissiveIntensity: 0.9,
        roughness: 1,
      }),
      pillar: new THREE.MeshStandardMaterial({ color: '#efeae1', roughness: 0.7 }),
      benchWood: new THREE.MeshStandardMaterial({ color: '#5a4634', roughness: 0.6 }),
      bedRim: new THREE.MeshStandardMaterial({ color: '#cfc7b8', roughness: 0.9 }),
      grass: new THREE.MeshStandardMaterial({ color: '#5f8a4a', roughness: 1 }),
      glass: new THREE.MeshStandardMaterial({
        color: '#dcebf2',
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
      mullion: new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.5, metalness: 0.4 }),
      lawn: new THREE.MeshStandardMaterial({ color: '#6f9a52', roughness: 1 }),
    }),
    []
  )

  const pillarGeo = useMemo(() => new THREE.BoxGeometry(1, ROOM.height, 1), [])
  const benchGeo = useMemo(() => new THREE.BoxGeometry(2.4, 0.5, 0.8), [])
  const potGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.22, 0.5, 10), [])
  const potPlantGeo = useMemo(() => new THREE.IcosahedronGeometry(0.34, 1), [])

  const shadowMapSize = isMobile ? 1024 : 2048

  return (
    <group>
      {/* ============ ILUMINACAO ============ */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#eaf3ff', '#b9b2a5', 0.7]} />
      <directionalLight
        position={[18, 26, 22]}
        intensity={1.15}
        color="#fff6e6"
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      {/* Preenchimento frio vindo da fachada de vidro */}
      <directionalLight position={[0, 6, 26]} intensity={0.35} color="#dceaff" />

      {/* ============ JARDIM EXTERNO ============ */}
      <mesh
        material={materials.lawn}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow
      >
        <planeGeometry args={[240, 240]} />
      </mesh>
      <Vegetation
        trunks={OUTDOOR_VEGETATION.trunks}
        canopy={OUTDOOR_VEGETATION.canopy}
        shrubs={OUTDOOR_VEGETATION.shrubs}
        castShadow={!isMobile}
      />

      {/* ============ ESTRUTURA + COLISOES ============ */}
      <RigidBody type="fixed" colliders={false}>
        {/* Piso */}
        <mesh
          material={materials.floor}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          receiveShadow
        >
          <planeGeometry args={[ROOM.width, ROOM.depth]} />
        </mesh>
        <CuboidCollider args={[HALF_W, 0.1, HALF_D]} position={[0, -0.1, 0]} />

        {/* Teto + faixas luminosas */}
        <mesh material={materials.ceiling} rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, 0]}>
          <planeGeometry args={[ROOM.width, ROOM.depth]} />
        </mesh>
        {[-6, 0, 6].map((x) => (
          <mesh
            key={`skylight-${x}`}
            material={materials.skylight}
            rotation={[Math.PI / 2, 0, 0]}
            position={[x, ROOM.height - 0.05, 0]}
          >
            <planeGeometry args={[1.6, ROOM.depth - 6]} />
          </mesh>
        ))}

        {/* Parede Norte (z-) */}
        <mesh material={materials.wall} position={[0, ROOM.height / 2, -HALF_D]} receiveShadow>
          <boxGeometry args={[ROOM.width, ROOM.height, ROOM.wallThickness]} />
        </mesh>
        <CuboidCollider
          args={[HALF_W, ROOM.height / 2, ROOM.wallThickness / 2]}
          position={[0, ROOM.height / 2, -HALF_D]}
        />

        {/* Parede Leste (x+) */}
        <mesh material={materials.wall} position={[HALF_W, ROOM.height / 2, 0]} receiveShadow>
          <boxGeometry args={[ROOM.wallThickness, ROOM.height, ROOM.depth]} />
        </mesh>
        <CuboidCollider
          args={[ROOM.wallThickness / 2, ROOM.height / 2, HALF_D]}
          position={[HALF_W, ROOM.height / 2, 0]}
        />

        {/* Parede Oeste (x-) */}
        <mesh material={materials.wall} position={[-HALF_W, ROOM.height / 2, 0]} receiveShadow>
          <boxGeometry args={[ROOM.wallThickness, ROOM.height, ROOM.depth]} />
        </mesh>
        <CuboidCollider
          args={[ROOM.wallThickness / 2, ROOM.height / 2, HALF_D]}
          position={[-HALF_W, ROOM.height / 2, 0]}
        />

        {/*
         * Parede Sul, montada a partir de DOORS / FACADE (museumLayout.js).
         *
         *   [baia de vidro]  [porta]  [painel central]  [porta]  [baia de vidro]
         *    -14 a -4.55              -2.45 a 2.45               4.55 a 14
         *
         * O painel central e solido e sustenta a obra da parede sul; as baias
         * laterais sao envidracadas e abrem para o jardim. As duas aberturas de
         * porta sao os unicos trechos sem colisao ate a altura da verga: quem
         * fecha essa faixa e o RigidBody cinematico das folhas (Door.jsx).
         */}

        {/* Painel central solido */}
        <mesh material={materials.wall} position={[0, ROOM.height / 2, HALF_D]} receiveShadow>
          <boxGeometry args={[FACADE.centerPanelWidth, ROOM.height, ROOM.wallThickness]} />
        </mesh>
        <CuboidCollider
          args={[FACADE.centerPanelWidth / 2, ROOM.height / 2, ROOM.wallThickness / 2]}
          position={[0, ROOM.height / 2, HALF_D]}
        />

        {/* Vergas: fecham o trecho acima de cada porta, da altura do vao ao teto */}
        {DOORS.centers.map((px) => {
          const h = ROOM.height - DOORS.height
          const y = DOORS.height + h / 2
          return (
            <group key={`lintel-${px}`}>
              <mesh material={materials.wall} position={[px, y, HALF_D]} receiveShadow>
                <boxGeometry args={[DOORS.width, h, ROOM.wallThickness]} />
              </mesh>
              <CuboidCollider
                args={[DOORS.width / 2, h / 2, ROOM.wallThickness / 2]}
                position={[px, y, HALF_D]}
              />
            </group>
          )
        })}

        {/* Baias envidracadas: vidro, montantes, travessa e colisao */}
        {[-1, 1].map((side) => (
          <group key={`bay-${side}`}>
            <mesh
              material={materials.glass}
              position={[side * FACADE.bayCenter, ROOM.height / 2, HALF_D]}
            >
              <boxGeometry args={[FACADE.bayWidth, ROOM.height, 0.08]} />
            </mesh>
            <mesh
              material={materials.mullion}
              position={[side * FACADE.bayCenter, 4, HALF_D]}
            >
              <boxGeometry args={[FACADE.bayWidth, 0.12, 0.18]} />
            </mesh>
            {FACADE.mullions.map((mx) => (
              <mesh
                key={`mullion-${side}-${mx}`}
                material={materials.mullion}
                position={[side * mx, ROOM.height / 2, HALF_D]}
              >
                <boxGeometry args={[0.12, ROOM.height, 0.18]} />
              </mesh>
            ))}
            {/* O vidro tambem barra o jogador */}
            <CuboidCollider
              args={[FACADE.bayWidth / 2, ROOM.height / 2, ROOM.wallThickness / 2]}
              position={[side * FACADE.bayCenter, ROOM.height / 2, HALF_D]}
            />
          </group>
        ))}

        {/* Colliders dos pilares (o visual e instanciado abaixo) */}
        {PILLAR_POSITIONS.map(([x, z], i) => (
          <CuboidCollider
            key={`pcol-${i}`}
            args={[0.5, ROOM.height / 2, 0.5]}
            position={[x, ROOM.height / 2, z]}
          />
        ))}

        {/* Colliders dos bancos */}
        {BENCH_POSITIONS.map((b, i) => (
          <CuboidCollider key={`bcol-${i}`} args={[1.2, 0.25, 0.4]} position={[b.pos[0], 0.25, b.pos[2]]} />
        ))}

        {/* Colliders dos canteiros e vasos */}
        {GARDEN_BEDS.map((bed) => (
          <CuboidCollider
            key={`bedcol-${bed.id}`}
            args={[bed.size[0] / 2, BED_HEIGHT / 2, bed.size[1] / 2]}
            position={[bed.pos[0], BED_HEIGHT / 2, bed.pos[1]]}
          />
        ))}
        {POTS.map((pot) => (
          <CuboidCollider key={`potcol-${pot.id}`} args={[0.3, 0.25, 0.3]} position={[pot.pos[0], 0.25, pot.pos[1]]} />
        ))}
      </RigidBody>

      {/* ============ PILARES (instanciados) ============ */}
      <Instances
        geometry={pillarGeo}
        material={materials.pillar}
        limit={64}
        frustumCulled={false}
        castShadow
        receiveShadow
      >
        {PILLAR_POSITIONS.map(([x, z], i) => (
          <Instance key={`pillar-${i}`} position={[x, ROOM.height / 2, z]} />
        ))}
      </Instances>

      {/* ============ BANCOS (instanciados) ============ */}
      <Instances
        geometry={benchGeo}
        material={materials.benchWood}
        limit={32}
        frustumCulled={false}
        castShadow
        receiveShadow
      >
        {BENCH_POSITIONS.map((b, i) => (
          <Instance key={`bench-${i}`} position={[b.pos[0], 0.25, b.pos[2]]} rotation={[0, b.rotY, 0]} />
        ))}
      </Instances>

      {/* ============ CANTEIROS AJARDINADOS ============ */}
      {GARDEN_BEDS.map((bed) => (
        <group key={bed.id} position={[bed.pos[0], 0, bed.pos[1]]}>
          <mesh material={materials.bedRim} position={[0, BED_HEIGHT / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[bed.size[0], BED_HEIGHT, bed.size[1]]} />
          </mesh>
          <mesh material={materials.grass} position={[0, BED_HEIGHT + 0.02, 0]} receiveShadow>
            <boxGeometry args={[bed.size[0] - 0.28, 0.06, bed.size[1] - 0.28]} />
          </mesh>
        </group>
      ))}

      {/* ============ VASOS AO LADO DOS BANCOS ============ */}
      <Instances geometry={potGeo} material={materials.bedRim} limit={32} frustumCulled={false} castShadow>
        {POTS.map((pot) => (
          <Instance key={pot.id} position={[pot.pos[0], 0.25, pot.pos[1]]} />
        ))}
      </Instances>
      <Instances geometry={potPlantGeo} material={materials.grass} limit={32} frustumCulled={false} castShadow>
        {POTS.map((pot) => (
          <Instance key={`${pot.id}-plant`} position={[pot.pos[0], 0.62, pot.pos[1]]} />
        ))}
      </Instances>

      {/* ============ ARVORES E ARBUSTOS INTERNOS ============ */}
      <Vegetation
        trunks={INDOOR_VEGETATION.trunks}
        canopy={INDOOR_VEGETATION.canopy}
        shrubs={INDOOR_VEGETATION.shrubs}
      />
    </group>
  )
}
