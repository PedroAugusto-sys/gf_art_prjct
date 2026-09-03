/**
 * Door: par de folhas de vidro que abrem por aproximacao.
 *
 * Geometria (derivada de DOORS em museumLayout.js, unica fonte de medidas):
 *   Cada abertura tem DOORS.width de vao livre, dividido em duas folhas.
 *   O pivo de cada folha fica na QUINA EXTERNA do vao:
 *     folha esquerda -> pivo em centerX - metadeDoVao
 *     folha direita  -> pivo em centerX + metadeDoVao
 *   Fechadas, as duas se encontram no centro; abertas, giram 90 graus para
 *   fora, na direcao do estacionamento.
 *
 * Fisica:
 *   RigidBody "kinematicPosition" com CuboidCollider proprio. A cada frame o
 *   corpo recebe posicao e rotacao novas, entao a folha empurra o jogador de
 *   verdade em vez de ser atravessada.
 *
 * Rotacao em torno do pivo (giro de a em torno de Y no three.js):
 *   x' =  x*cos(a) + z*sin(a)
 *   z' = -x*sin(a) + z*cos(a)
 * Com o deslocamento inicial (-openDir*meiaFolha, 0) isso da:
 *   cx = pivoX - openDir*meiaFolha*cos(a)
 *   cz = pivoZ + openDir*meiaFolha*sin(a)
 * O sinal de cz precisa ser positivo. Com o sinal invertido a dobradica nao
 * fica parada: a folha varre um arco espelhado e se descola do batente.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { playerPosRef, npcPosMap } from '../systems/proximityRefs'
import { sim } from '../systems/simClock'
import { DOORS } from '../data/museumLayout'

// ---------- Dimensoes ----------
const LEAF_W = DOORS.width / 2   // largura de cada folha
const LEAF_H = DOORS.height - 0.02
const LEAF_T = 0.07
// Deslocamento da folha para dentro da sala (eixo -Z).
// Evita Z-fighting com a face interior da parede quando fechada.
// Deve ser >= metade da espessura da folha (0.035) + pequena folga.
const LEAF_INSET = LEAF_T / 2 + 0.04   // ~0.075 m para dentro

// ---------- Comportamento ----------
const TRIGGER_DIST = 5.5
const OPEN_ANGLE = Math.PI / 2
const ANIM_SPEED = 4.0
const CLOSE_DELAY = 2.8

// ---------- Materiais ----------
const glassMat = new THREE.MeshStandardMaterial({
  color: '#c4dff0',
  roughness: 0.03,
  metalness: 0.1,
  transparent: true,
  opacity: 0.42,
  side: THREE.DoubleSide,
})
const frameMat = new THREE.MeshStandardMaterial({
  color: '#3a3d40',
  roughness: 0.5,
  metalness: 0.45,
})

const leafGeo = new THREE.BoxGeometry(LEAF_W, LEAF_H, LEAF_T)
const frameHGeo = new THREE.BoxGeometry(DOORS.width + 0.16, 0.1, LEAF_T + 0.08)
const frameVGeo = new THREE.BoxGeometry(0.08, LEAF_H + 0.12, LEAF_T + 0.08)

const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()

/** Alguem (jogador ou visitante) esta perto do vao? */
function someoneNear(centerX, wallZ) {
  const [px, , pz] = playerPosRef.current
  if (Math.hypot(px - centerX, pz - wallZ) < TRIGGER_DIST) return true
  for (const [nx, nz] of npcPosMap.values()) {
    if (Math.hypot(nx - centerX, nz - wallZ) < TRIGGER_DIST) return true
  }
  return false
}

/**
 * Uma folha com dobradica no pivo.
 * openDir: -1 gira para oeste, +1 para leste.
 */
function DoorLeaf({ pivotX, wallZ, openDir, centerX }) {
  const bodyRef = useRef(null)
  const meshRef = useRef(null)
  const angle = useRef(0)
  const lastNear = useRef(-999)

  const half = LEAF_W / 2
  // A folha fica LEAF_INSET metros para dentro da sala na posicao fechada.
  // O pivo (dobradica) esta na face interior da parede.
  const pivotZ = wallZ - LEAF_INSET
  const closedX = pivotX - openDir * half

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = sim.time

    if (someoneNear(centerX, wallZ)) lastNear.current = now

    const target = now - lastNear.current < CLOSE_DELAY ? OPEN_ANGLE * openDir : 0
    angle.current += (target - angle.current) * Math.min(1, ANIM_SPEED * dt)

    const a = angle.current
    // Rotacao em torno do pivo (na face interior da parede)
    const cx = pivotX - openDir * Math.cos(a) * half
    const cz = pivotZ + openDir * Math.sin(a) * half

    if (meshRef.current) {
      meshRef.current.position.set(cx, LEAF_H / 2, cz)
      meshRef.current.rotation.y = a
    }

    const body = bodyRef.current
    if (body) {
      _quat.setFromEuler(_euler.set(0, a, 0))
      body.setNextKinematicTranslation({ x: cx, y: LEAF_H / 2, z: cz })
      body.setNextKinematicRotation({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w })
    }
  })

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[closedX, LEAF_H / 2, pivotZ]}
      >
        <CuboidCollider args={[LEAF_W / 2, LEAF_H / 2, LEAF_T / 2]} />
      </RigidBody>

      <mesh
        ref={meshRef}
        geometry={leafGeo}
        material={glassMat}
        position={[closedX, LEAF_H / 2, pivotZ]}
      />
    </>
  )
}

/**
 * Porta dupla com caixilho.
 * Sem montante central: seria um poste fixo no meio da passagem, bem em cima
 * da linha por onde os visitantes entram.
 */
export default function DoubleDoor({ centerX, wallZ }) {
  const halfOpening = DOORS.width / 2
  // O caixilho fica na face interior da parede (mesmo plano das folhas fechadas)
  const frameZ = wallZ - LEAF_INSET

  return (
    <group>
      {/* Verga do caixilho */}
      <mesh geometry={frameHGeo} material={frameMat} position={[centerX, LEAF_H + 0.05, frameZ]} />
      {/* Montantes nas quinas do vao */}
      <mesh
        geometry={frameVGeo}
        material={frameMat}
        position={[centerX - halfOpening - 0.04, LEAF_H / 2, frameZ]}
      />
      <mesh
        geometry={frameVGeo}
        material={frameMat}
        position={[centerX + halfOpening + 0.04, LEAF_H / 2, frameZ]}
      />

      <DoorLeaf pivotX={centerX - halfOpening} wallZ={wallZ} openDir={-1} centerX={centerX} />
      <DoorLeaf pivotX={centerX + halfOpening} wallZ={wallZ} openDir={1} centerX={centerX} />
    </group>
  )
}
