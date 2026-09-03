import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import {
  claimViewingSpot,
  claimIdleSpot,
  releaseSpot,
  updateAgent,
  removeAgent,
  separationForce,
} from '../systems/crowd'
import { findPath, nearestWalkable } from '../systems/navgrid'
import { useVisitorStore } from '../systems/visitorFlow'
import { npcPosMap } from '../systems/proximityRefs'
import { sim, advanceSim } from '../systems/simClock'
import { NPC_OBSTACLES, WALK_BOUNDS, HALF_D, DOORS } from '../data/museumLayout'

// ---------- Locomocao ----------
const WALK_SPEED = 1.2
const ARRIVE_RADIUS = 0.55   // raio de chegada ao waypoint intermediario
const ARRIVE_FINAL = 0.35    // raio de chegada ao destino final
const TURN_SPEED = 6
const STEP_FREQ = 7.4
const SEPARATION_RADIUS = 0.95
const NPC_BODY_RADIUS = 0.28 // raio do corpo, usado na colisao e no desvio
const AVOID_LOOKAHEAD = 3.0  // distancia de antecipacao do desvio de obstaculo
const AVOID_STRENGTH = 2.2
const EXIT_DESPAWN_Z = 32    // z alem do estacionamento: remove o NPC
const LEAVING_TIMEOUT = 40   // s: se nao conseguiu sair, despawn forcado

// Centros das portas derivados da fonte unica em museumLayout.js
const DOOR_LEFT_X  = DOORS.centers[0]
const DOOR_RIGHT_X = DOORS.centers[1]
// Corredor da porta: zona em que o clamp de Z e suspenso para o NPC sair
const DOOR_CORRIDOR_W = DOORS.width * 0.6

// Deteccao de travamento
const STUCK_INTERVAL = 1.8      // s entre checagens
const STUCK_MIN_PROGRESS = 0.22 // m: abaixo disso considera-se preso
const STUCK_MAX_RETRIES = 3     // apos isso, escolhe novo destino


// ---------- Tempos ----------
const VIEW_MIN = 8
const VIEW_MAX = 15
const REST_MIN = 3
const REST_MAX = 7

const DEFAULT_APPEARANCE = {
  skin: '#c4a484',
  hair: '#2c1b10',
  shirt: '#6b7280',
  pants: '#3f3f46',
  shoes: '#1f1f1f',
}

// ---------- Geometrias compartilhadas ----------
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

// ---------- Cache de materiais ----------
const materialCache = new Map()
function sharedMaterial(color, roughness = 0.8, side = THREE.FrontSide) {
  const key = `${color}|${roughness}|${side}`
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, side }))
  }
  return materialCache.get(key)
}

function shortestAngle(from, to) {
  let delta = to - from
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

// ---------- Cerebro principal ----------
/**
 * Modo de vida de um visitante:
 *  'walking' -> seguindo a rota atual (entrada ou proxima obra)
 *  'viewing' -> parado na frente de uma obra
 *  'resting' -> parado num ponto neutro
 *  'leaving' -> seguindo a rota de volta ate a porta
 *  'exiting' -> ja passou da porta, anda em linha reta ate sumir
 *
 * A rota (`route`) e SEMPRE uma lista de pontos que termina no destino exato.
 * Antes, a rota continha apenas nos do grafo: quando o NPC ja estava no no
 * mais proximo do alvo, o A* devolvia um caminho de tamanho 1, a fila ficava
 * vazia e o NPC travava para sempre no modo 'visiting'. Terminar a rota no
 * ponto exato elimina esse estado morto e faz o visitante parar de fato na
 * frente da obra, e nao no waypoint do corredor.
 */
function useVisitorBrain(groupRef, npcId, entrySide, leaving, motion, onReachedExit) {
  const brain = useRef({
    mode: 'walking',
    route: [],
    look: null,
    lastArtId: null,
    until: 0,
    started: false,
    // Lado preferido de desvio: evita que dois NPCs escolham o mesmo lado
    avoidSide: entrySide,
    // Detector de travamento
    stuckCheckAt: 0,
    stuckX: 0,
    stuckZ: 0,
    stuckRetries: 0,
    // Timestamp em que entrou em 'leaving' (para timeout de despawn)
    leavingAt: 0,
  })
  const yaw = useRef(Math.PI) // entra olhando para o norte (para dentro do museu)
  const separation = useRef({ x: 0, z: 0 })

  useEffect(() => () => removeAgent(npcId), [npcId])

  /**
   * Monta a rota completa ate (targetX, targetZ) usando a grade de navegacao.
   * Se o ponto de partida ou chegada estiver bloqueado, usa o mais proximo livre.
   */
  const buildRoute = (position, targetX, targetZ) => {
    const outside = position.z > HALF_D - 0.5
    const route = []

    // Fora do predio: alinha com a porta antes de entrar.
    if (outside) {
      const doorX = entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X
      route.push({ x: doorX, z: HALF_D + 1.8 })
      route.push({ x: doorX, z: HALF_D - 1.0 })
    }

    // A* na grade
    const sx = outside ? (entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X) : position.x
    const sz = outside ? HALF_D - 1.0 : position.z
    const path = findPath(sx, sz, targetX, targetZ) || []

    for (const node of path) {
      // Pula pontos desnecessariamente proximos do ponto de partida.
      if (Math.hypot(node.x - position.x, node.z - position.z) < ARRIVE_RADIUS * 0.8) continue
      route.push({ x: node.x, z: node.z })
    }

    // O ultimo ponto e sempre o destino exato.
    route.push({ x: targetX, z: targetZ, final: true })
    brain.current.route = route
  }

  /** Rota de saida: ate a frente da porta e depois para fora do mapa. */
  const buildExitRoute = (position) => {
    releaseSpot(npcId) // libera vaga imediatamente para outros NPCs
    const doorX = entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X
    const path = findPath(position.x, position.z, doorX, HALF_D - 1.0) || []
    const route = path.map((p) => ({ x: p.x, z: p.z }))
    // Ponto dentro do vao (sem colisao de parede)
    route.push({ x: doorX, z: HALF_D - 0.3 })
    // Ponto fora do predio — o exiting cuida do restante em linha reta
    route.push({ x: doorX, z: HALF_D + 2.5, final: true })
    brain.current.route = route
    brain.current.look = null
    brain.current.leavingAt = sim.time
  }

  /** Reserva a proxima vaga e monta a rota ate ela. */
  const chooseNextVisit = (position, time) => {
    const state = brain.current
    const where = { x: position.x, z: position.z }

    const spot =
      claimViewingSpot(npcId, { ...where, avoidArtId: state.lastArtId }) ||
      claimIdleSpot(npcId, where)

    // Galeria lotada: espera um pouco e tenta de novo (antes isso repetia a
    // cada frame e o visitante ficava plantado no lugar).
    if (!spot) {
      state.until = time + 1.5
      return
    }

    buildRoute(position, spot.x, spot.z)
    state.mode = 'walking'
    state.look = spot.look
    state.lastArtId = spot.artId
    state.stuckCheckAt = time + STUCK_INTERVAL
    state.stuckX = position.x
    state.stuckZ = position.z
  }

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const dt = Math.min(delta, 0.05)
    const time = sim.time // relogio monotonico: imune a troca de aba
    const position = group.position
    const state = brain.current

    // Primeira rota: do estacionamento ate a primeira obra.
    if (!state.started) {
      state.started = true
      chooseNextVisit(position, time)
    }

    // Fim da vida util: passa a caminhar para a saida.
    if (leaving && state.mode !== 'leaving' && state.mode !== 'exiting') {
      state.mode = 'leaving'
      buildExitRoute(position) // tambem chama releaseSpot internamente
    }

    // Timeout de seguranca: se o NPC ficou preso em 'leaving' por tempo demais,
    // teleporta-o para fora para evitar fantasmas ocupando o mapa indefinidamente.
    if (state.mode === 'leaving' && state.leavingAt > 0 &&
        time - state.leavingAt > LEAVING_TIMEOUT) {
      onReachedExit()
      return
    }

    let moving = false
    let faceX = null
    let faceZ = null

    // ---------- Modo 'exiting': linha reta para fora, sem colisao ----------
    if (state.mode === 'exiting') {
      position.z += WALK_SPEED * dt
      motion.current.walking = true
      motion.current.viewing = false
      group.rotation.y = 0 // de costas para o museu
      updateAgent(npcId, position.x, position.z)
      if (position.z > EXIT_DESPAWN_Z) onReachedExit()
      return
    }

    // ---------- Percurso pela rota ----------
    if (state.route.length > 0) {
      const wp = state.route[0]
      const dx = wp.x - position.x
      const dz = wp.z - position.z
      const dist = Math.hypot(dx, dz)
      const radius = wp.final ? ARRIVE_FINAL : ARRIVE_RADIUS

      if (dist < radius) {
        state.route.shift()
        if (state.route.length === 0) {
          if (state.mode === 'leaving') {
            state.mode = 'exiting'
          } else {
            state.mode = state.look ? 'viewing' : 'resting'
            state.until =
              time +
              (state.look
                ? VIEW_MIN + Math.random() * (VIEW_MAX - VIEW_MIN)
                : REST_MIN + Math.random() * (REST_MAX - REST_MIN))
          }
        }
      } else {
        moving = true
        let dirX = dx / dist
        let dirZ = dz / dist
        let steerX = dirX
        let steerZ = dirZ

        // --- Desvio tangencial de obstaculos ---
        // A rota do grafo passa pelos corredores, mas o ultimo trecho ate a
        // vaga da obra e livre; sem isso o visitante entra reto no canteiro.
        const insideRoom = position.z < HALF_D - 0.5
        if (insideRoom) {
          for (const obs of NPC_OBSTACLES) {
            const ox = obs.x - position.x
            const oz = obs.z - position.z
            const along = ox * dirX + oz * dirZ
            if (along <= 0 || along > AVOID_LOOKAHEAD) continue

            const clearance = obs.r + NPC_BODY_RADIUS
            const lateral = ox * -dirZ + oz * dirX
            if (Math.abs(lateral) > clearance) continue

            const push = (clearance - Math.abs(lateral)) / clearance
            const side = Math.abs(lateral) < 0.05 ? state.avoidSide : lateral > 0 ? -1 : 1
            steerX += -dirZ * side * push * AVOID_STRENGTH
            steerZ += dirX * side * push * AVOID_STRENGTH
          }
        }

        // --- Separacao entre visitantes ---
        const sep = separationForce(
          npcId, position.x, position.z, SEPARATION_RADIUS, separation.current
        )
        // Projeta a separacao na perpendicular a marcha: os dois se desviam
        // de lado em vez de frearem de frente um para o outro.
        const perpX = -dirZ
        const perpZ = dirX
        const perpDot = sep.x * perpX + sep.z * perpZ
        steerX += perpX * perpDot * 1.6
        steerZ += perpZ * perpDot * 1.6

        // Encontro frontal: cada um cede para o seu lado preferido.
        // (a versao anterior reutilizava steerX ja modificado na linha seguinte,
        //  o que produzia um vetor de desvio invalido)
        if (sep.x * dirX + sep.z * dirZ < -0.3) {
          const cedeX = -dirZ * state.avoidSide
          const cedeZ = dirX * state.avoidSide
          steerX += cedeX * 0.9
          steerZ += cedeZ * 0.9
        }

        const len = Math.hypot(steerX, steerZ)
        if (len > 1e-4) {
          steerX /= len
          steerZ /= len
        } else {
          steerX = dirX
          steerZ = dirZ
        }

        position.x += steerX * WALK_SPEED * dt
        position.z += steerZ * WALK_SPEED * dt
        faceX = steerX
        faceZ = steerZ
      }
    } else if (state.mode === 'viewing' || state.mode === 'resting') {
      if (time >= state.until) {
        if (leaving) {
          state.mode = 'leaving'
          buildExitRoute(position)
        } else {
          chooseNextVisit(position, time)
        }
      }
    } else if (state.mode === 'walking' && time >= state.until) {
      // Rota vazia caminhando: acontece quando todas as vagas estavam
      // reservadas na ultima tentativa. Espera o intervalo e tenta de novo.
      chooseNextVisit(position, time)
    }

    // ---------- Detector de travamento ----------
    if (moving && time >= state.stuckCheckAt) {
      const progress = Math.hypot(position.x - state.stuckX, position.z - state.stuckZ)
      if (progress < STUCK_MIN_PROGRESS) {
        state.stuckRetries++
        state.avoidSide *= -1
        if (state.stuckRetries >= STUCK_MAX_RETRIES) {
          // Muitos bloqueios seguidos: escolhe destino novo
          state.stuckRetries = 0
          if (leaving) {
            buildExitRoute(position)
          } else {
            chooseNextVisit(position, time)
          }
        } else {
          // Tenta recalcular a rota para o mesmo alvo com novo lado de desvio
          const target = state.route[state.route.length - 1]
          if (target) buildRoute(position, target.x, target.z)
        }
      } else {
        state.stuckRetries = 0
      }
      state.stuckCheckAt = time + STUCK_INTERVAL
      state.stuckX = position.x
      state.stuckZ = position.z
    }

    // ---------- Parado: encara a obra e mantem distancia dos vizinhos ----------
    if (!moving) {
      if (state.look) {
        faceX = state.look[0] - position.x
        faceZ = state.look[2] - position.z
      }
      const sep = separationForce(npcId, position.x, position.z, 0.55, separation.current)
      position.x += sep.x * dt * 0.85
      position.z += sep.z * dt * 0.85
    }

    // ---------- Colisao rigida (somente dentro da sala) ----------
    const insideRoom = position.z < HALF_D - 0.5
    if (insideRoom) {
      for (const obs of NPC_OBSTACLES) {
        const ox = position.x - obs.x
        const oz = position.z - obs.z
        const dist = Math.hypot(ox, oz)
        const minDist = obs.r + NPC_BODY_RADIUS
        if (dist < minDist && dist > 1e-5) {
          const push = (minDist - dist) / dist
          position.x += ox * push
          position.z += oz * push
        }
      }

      position.x = Math.max(WALK_BOUNDS.minX, Math.min(WALK_BOUNDS.maxX, position.x))

      // O clamp de Z so se aplica se o NPC NAO estiver saindo.
      // NPCs em 'leaving'/'exiting' que estao no corredor da porta precisam
      // ultrapassar HALF_D sem serem puxados de volta.
      const isSaindo = state.mode === 'leaving' || state.mode === 'exiting'
      const nearDoor = Math.abs(position.x - DOOR_LEFT_X)  < DOOR_CORRIDOR_W ||
                       Math.abs(position.x - DOOR_RIGHT_X) < DOOR_CORRIDOR_W
      if (!(isSaindo && nearDoor)) {
        position.z = Math.max(WALK_BOUNDS.minZ, Math.min(WALK_BOUNDS.maxZ, position.z))
      }
    }

    if (faceX !== null && (Math.abs(faceX) > 1e-4 || Math.abs(faceZ) > 1e-4)) {
      const desired = Math.atan2(faceX, faceZ)
      yaw.current += shortestAngle(yaw.current, desired) * Math.min(1, TURN_SPEED * dt)
      group.rotation.y = yaw.current
    }

    updateAgent(npcId, position.x, position.z)
    motion.current.walking = moving
    motion.current.viewing = state.mode === 'viewing'
  })
}

// ---------- Corpo articulado ----------
function VisitorBody({ appearance = DEFAULT_APPEARANCE, outfit = 'shirt', motion }) {
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
    const walking = motion.current.walking
    const viewing = motion.current.viewing
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
      head.current.rotation.x = viewing ? Math.sin(time * 0.3) * 0.08 : 0
    }
  })

  return (
    <group>
      <group ref={torso}>
        <mesh geometry={GEO.pelvis} material={mats.pants} position={[0, 0.95, 0]} castShadow />
        <mesh geometry={GEO.torso} material={mats.shirt} position={[0, 1.26, 0]} castShadow />
        {outfit === 'dress' && (
          <mesh geometry={GEO.skirt} material={mats.outerwear} position={[0, 0.86, 0]} castShadow />
        )}
        {outfit === 'coat' && (
          <mesh geometry={GEO.coat} material={mats.outerwear} position={[0, 1.06, 0]} castShadow />
        )}
        <mesh geometry={GEO.joint} material={mats.shirt} position={[-0.19, 1.44, 0]} />
        <mesh geometry={GEO.joint} material={mats.shirt} position={[0.19, 1.44, 0]} />
        <mesh geometry={GEO.neck} material={mats.skin} position={[0, 1.55, 0]} />
        <group ref={head} position={[0, 1.68, 0]}>
          <mesh geometry={GEO.head} material={mats.skin} castShadow />
          <mesh geometry={GEO.hair} material={mats.hair} position={[0, 0.012, 0]} />
        </group>
        <group ref={leftArm} position={[-0.21, 1.43, 0]}>
          <mesh geometry={GEO.upperArm} material={mats.shirt} position={[0, -0.125, 0]} castShadow />
          <group ref={leftElbow} position={[0, -0.25, 0]}>
            <mesh geometry={GEO.foreArm} material={mats.skin} position={[0, -0.12, 0]} />
            <mesh geometry={GEO.hand} material={mats.skin} position={[0, -0.25, 0]} />
          </group>
        </group>
        <group ref={rightArm} position={[0.21, 1.43, 0]}>
          <mesh geometry={GEO.upperArm} material={mats.shirt} position={[0, -0.125, 0]} castShadow />
          <group ref={rightElbow} position={[0, -0.25, 0]}>
            <mesh geometry={GEO.foreArm} material={mats.skin} position={[0, -0.12, 0]} />
            <mesh geometry={GEO.hand} material={mats.skin} position={[0, -0.25, 0]} />
          </group>
        </group>
      </group>

      <group ref={leftLeg} position={[-0.1, 0.9, 0]}>
        <mesh geometry={GEO.thigh} material={mats.pants} position={[0, -0.22, 0]} castShadow />
        <group ref={leftKnee} position={[0, -0.45, 0]}>
          <mesh geometry={GEO.shin} material={mats.pants} position={[0, -0.18, 0]} castShadow />
          <mesh geometry={GEO.foot} material={mats.shoes} position={[0, -0.38, 0.06]} />
        </group>
      </group>
      <group ref={rightLeg} position={[0.1, 0.9, 0]}>
        <mesh geometry={GEO.thigh} material={mats.pants} position={[0, -0.22, 0]} castShadow />
        <group ref={rightKnee} position={[0, -0.45, 0]}>
          <mesh geometry={GEO.shin} material={mats.pants} position={[0, -0.18, 0]} castShadow />
          <mesh geometry={GEO.foot} material={mats.shoes} position={[0, -0.38, 0.06]} />
        </group>
      </group>
    </group>
  )
}

// ---------- Componente de um visitante ----------
function VisitorNPC({ id, appearance, outfit, scale, entrySide, leaving, spawn }) {
  const despawn = useVisitorStore((s) => s.despawn)
  const group = useRef(null)
  const motion = useRef({ walking: true, viewing: false })

  // Escreve a posicao no Map global para as portas detectarem proximidade
  useFrame(() => {
    const g = group.current
    if (!g) return
    let entry = npcPosMap.get(id)
    if (!entry) { entry = [0, 0]; npcPosMap.set(id, entry) }
    entry[0] = g.position.x
    entry[1] = g.position.z
  })

  useEffect(() => {
    return () => { npcPosMap.delete(id) }
  }, [id])

  useVisitorBrain(group, id, entrySide, leaving, motion, () => despawn(id))

  return (
    <group ref={group} position={spawn} scale={scale}>
      <VisitorBody appearance={appearance} outfit={outfit} motion={motion} />
    </group>
  )
}

/**
 * Ticker global: atualiza o fluxo de visitantes a cada frame.
 * Renderizado UMA vez dentro do Canvas.
 */
export function VisitorFlowTicker() {
  const tick = useVisitorStore((s) => s.tick)
  const init = useVisitorStore((s) => s.init)

  useFrame((_, delta) => {
    // Unico ponto que avanca o relogio da simulacao. Renderizado no topo da
    // arvore para que os NPCs leiam sim.time ja atualizado no mesmo frame.
    const t = advanceSim(delta)
    init(t)
    tick(t)
  })

  return null
}

/**
 * Exportacao principal: renderiza todos os visitantes ativos.
 */
export default function VisitorLayer() {
  const visitors = useVisitorStore((s) => s.visitors)

  return (
    <>
      {visitors.map((v) => (
        <VisitorNPC
          key={v.key}
          id={v.id}
          appearance={v.appearance}
          outfit={v.outfit}
          scale={v.scale}
          entrySide={v.entrySide}
          leaving={v.leaving}
          spawn={v.spawn}
        />
      ))}
    </>
  )
}
