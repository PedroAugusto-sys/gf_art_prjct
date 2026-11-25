import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'

import {
  claimViewingSpot,
  claimIdleSpot,
  releaseSpot,
  updateAgent,
  removeAgent,
  separationForce,
} from '../systems/crowd'
import { findPath, isWalkable, nearestWalkable } from '../systems/navgrid'
import { createWalker, tickWalker } from '../systems/npcLocomotion'
import { useVisitorStore } from '../systems/visitorFlow'
import { npcPosMap, playerPosRef } from '../systems/proximityRefs'
import { segmentIndoors } from '../systems/roomClearance'
import { CROWD_QUALITY } from '../systems/crowdQuality'
import { sim, advanceSim } from '../systems/simClock'
import { NPC_OBSTACLES, WALK_BOUNDS, HALF_D, DOORS } from '../data/museumLayout'
import {
  pickPositiveLine,
  canStartSpeech,
  markSpeechStarted,
  SPEECH_DURATION,
  SPEECH_COOLDOWN,
  SPEECH_CHANCE,
  SPEECH_DELAY_MIN,
  SPEECH_DELAY_MAX,
} from '../systems/npcDialogue'
import VisitorModel, { BlobShadow } from './VisitorModel'
import { DEFAULT_APPEARANCE } from '../systems/appearance'
import { useGameStore } from '../store'

function isLegacyNpcs() {
  return !!useGameStore.getState().getVersionFlags()?.legacyNpcs
}

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

const DEFAULT_APPEARANCE_FALLBACK = DEFAULT_APPEARANCE

// (geometrias e corpo movidos para VisitorModel.jsx)

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
function useVisitorBrain(groupRef, npcId, entrySide, leaving, motion, onReachedExit, slot) {
  const brain = useRef(createWalker(entrySide))
  const yaw = useRef(0) // Modelo aponta para +Z quando yaw=0
  const separation = useRef({ x: 0, z: 0 })
  const aiFrame = useRef(slot || 0)
  const aiTime = useRef(0)
  const simStamp = useRef(-1)

  useEffect(() => () => removeAgent(npcId), [npcId])

  /**
   * Monta a rota ate (targetX, targetZ).
   * Versao atual: A* na grade.
   * Versao inicial (legacy): linha reta / poucos waypoints grosseiros (pode atravessar obstaculos).
   */
  const buildRoute = (position, targetX, targetZ) => {
    const outside = position.z > HALF_D - 0.5
    const route = []
    const legacy = isLegacyNpcs()

    if (outside) {
      const doorX = entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X
      route.push({ x: doorX, z: HALF_D + 1.8 })
      route.push({ x: doorX, z: HALF_D - 1.0 })
    }

    if (legacy) {
      // Pathing "bugado": vai direto (e às vezes um desvio aleatório que corta canteiros)
      if (Math.random() < 0.45) {
        route.push({
          x: (position.x + targetX) / 2 + (Math.random() - 0.5) * 6,
          z: (position.z + targetZ) / 2 + (Math.random() - 0.5) * 4,
        })
      }
      route.push({ x: targetX, z: targetZ, final: true })
      brain.current.route = route
      return
    }

    const sx = outside ? (entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X) : position.x
    const sz = outside ? HALF_D - 1.0 : position.z
    const path = findPath(sx, sz, targetX, targetZ) || []

    for (const node of path) {
      if (Math.hypot(node.x - position.x, node.z - position.z) < ARRIVE_RADIUS * 0.8) continue
      route.push({ x: node.x, z: node.z })
    }

    route.push({ x: targetX, z: targetZ, final: true })
    brain.current.route = route
  }

  /** Rota de saida: ate a frente da porta e depois para fora do mapa. */
  const buildExitRoute = (position) => {
    releaseSpot(npcId)
    const doorX = entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X
    const legacy = isLegacyNpcs()
    const route = []

    if (legacy) {
      // Bug historico: vai ate perto da porta mas o clamp de Z impede sair
      route.push({ x: doorX, z: HALF_D - 1.5 })
      route.push({ x: doorX, z: HALF_D - 0.5, final: true })
    } else {
      const path = findPath(position.x, position.z, doorX, HALF_D - 1.0) || []
      for (const p of path) route.push({ x: p.x, z: p.z })
      route.push({ x: doorX, z: HALF_D - 0.3 })
      route.push({ x: doorX, z: HALF_D + 2.5, final: true })
    }

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

    // O relógio da simulação é a mesma fonte do detector de preso.
    // Somar o delta cru do frame (e ainda cortar em 0,1) fazia o corpo
    // andar menos do que o tempo pedia quando o quadro caía.
    const now = sim.time
    if (simStamp.current < 0) simStamp.current = now
    const elapsed = Math.max(0, now - simStamp.current)
    simStamp.current = now
    aiTime.current += elapsed
    aiFrame.current += 1
    if (!isLegacyNpcs() && aiFrame.current % CROWD_QUALITY.aiStride !== 0) return

    const dt = Math.min(isLegacyNpcs() ? delta : aiTime.current, 0.25)
    aiTime.current = 0
    const time = sim.time // relogio monotonico: imune a troca de aba
    const position = group.position
    const state = brain.current

    if (!isLegacyNpcs()) {
      const result = tickWalker(state, position, dt, time, { npcId, leaving, entrySide })
      if (result.despawn) {
        onReachedExit()
        return
      }
      if (result.faceX !== null && (Math.abs(result.faceX) > 1e-4 || Math.abs(result.faceZ) > 1e-4)) {
        const desired = Math.atan2(result.faceX, result.faceZ)
        yaw.current += shortestAngle(yaw.current, desired) * Math.min(1, TURN_SPEED * dt)
        group.rotation.y = yaw.current
      }
      motion.current.walking = result.moving
      motion.current.viewing = state.mode === 'viewing'
      motion.current.speech = state.speechText
      motion.current.yaw = yaw.current
      return
    }

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
      // NPC sai andando para +Z (norte), então yaw deve ser 0 (modelo aponta para +Z)
      group.rotation.y = 0
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
            // Agenda fala positiva ao observar obra (desligado na versao inicial)
            if (state.mode === 'viewing' && !isLegacyNpcs()) {
              state.speechArmedAt =
                time + SPEECH_DELAY_MIN + Math.random() * (SPEECH_DELAY_MAX - SPEECH_DELAY_MIN)
            }
          }
        }
      } else {
        moving = true
        let dirX = dx / dist
        let dirZ = dz / dist
        let steerX = dirX
        let steerZ = dirZ

        // --- Colisao / desvio: desligado no prototipo (sem obstaculos visuais) ---
        if (!isLegacyNpcs() && position.z < HALF_D - 0.5) {
          for (let oi = 0; oi < NPC_OBSTACLES.length; oi++) {
            const obs = NPC_OBSTACLES[oi]
            const ox = obs.x - position.x
            const oz = obs.z - position.z
            const along = ox * dirX + oz * dirZ
            if (along <= 0 || along > AVOID_LOOKAHEAD) continue

            const clearance = obs.r + NPC_BODY_RADIUS
            const lateral = ox * -dirZ + oz * dirX
            const absLat = lateral < 0 ? -lateral : lateral
            if (absLat > clearance) continue

            const push = (clearance - absLat) / clearance
            const side = absLat < 0.05 ? state.avoidSide : lateral > 0 ? -1 : 1
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

    // ---------- Detector de travamento (desligado no legado) ----------
    if (!isLegacyNpcs() && moving && time >= state.stuckCheckAt) {
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

    // ---------- Colisao rigida (somente dentro da sala; desligada no prototipo) ----------
    const insideRoom = position.z < HALF_D - 0.5
    if (insideRoom && !isLegacyNpcs()) {
      for (let oi = 0; oi < NPC_OBSTACLES.length; oi++) {
        const obs = NPC_OBSTACLES[oi]
        const ox = position.x - obs.x
        const oz = position.z - obs.z
        const dist2 = ox * ox + oz * oz
        const minDist = obs.r + NPC_BODY_RADIUS
        const minDist2 = minDist * minDist
        if (dist2 < minDist2 && dist2 > 1e-10) {
          const dist = Math.sqrt(dist2)
          const push = (minDist - dist) / dist
          position.x += ox * push
          position.z += oz * push
        }
      }

      position.x = Math.max(WALK_BOUNDS.minX, Math.min(WALK_BOUNDS.maxX, position.x))

      // Versao inicial: sempre clampa Z (recria a armadilha na porta).
      // Versao atual: a grade inclui os anexos abertos e libera a porta na saída.
      const legacy = isLegacyNpcs()
      const isSaindo = state.mode === 'leaving' || state.mode === 'exiting'
      const nearDoor =
        Math.abs(position.x - DOOR_LEFT_X) < DOOR_CORRIDOR_W ||
        Math.abs(position.x - DOOR_RIGHT_X) < DOOR_CORRIDOR_W
      if (legacy) {
        position.z = Math.max(WALK_BOUNDS.minZ, Math.min(WALK_BOUNDS.maxZ, position.z))
      } else if (!(isSaindo && nearDoor) && !isWalkable(position.x, position.z)) {
        const back = nearestWalkable(position.x, position.z)
        position.x = back.x
        position.z = back.z
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

    // ---------- Fala positiva (uma tentativa ao atingir o delay) ----------
    if (
      !isLegacyNpcs() &&
      state.mode === 'viewing' &&
      state.speechArmedAt > 0 &&
      time >= state.speechArmedAt
    ) {
      state.speechArmedAt = 0
      if (
        time >= state.speechCooldownUntil &&
        !state.speechText &&
        canStartSpeech(time) &&
        Math.random() < SPEECH_CHANCE
      ) {
        state.speechText = pickPositiveLine(state.lastArtId)
        state.speechUntil = time + SPEECH_DURATION
        markSpeechStarted(time)
      }
    }
    if (state.speechText && time >= state.speechUntil) {
      state.speechText = null
      state.speechCooldownUntil = time + SPEECH_COOLDOWN
    }
    motion.current.speech = state.speechText
    motion.current.yaw = yaw.current
  })
}

function slotOf(id) {
  let hash = 0
  const text = String(id)
  for (let i = 0; i < text.length; i++) hash = (hash + text.charCodeAt(i) * (i + 1)) % 97
  return hash
}

function labelsNear(position, speech, personName) {
  const [px, , pz] = playerPosRef.current
  const dist = Math.hypot(position.x - px, position.z - pz)
  if (dist > CROWD_QUALITY.nameRange) return { name: null, speech: null }
  if (!segmentIndoors(px, pz, position.x, position.z)) return { name: null, speech: null }
  return {
    name: personName,
    speech: speech && dist <= CROWD_QUALITY.speechRange ? speech : null,
  }
}

// ---------- Um visitante simulado neste cliente ----------
function HostVisitorNPC({ id, name, appearance, outfit, scale, entrySide, leaving, spawn }) {
  const despawn = useVisitorStore((s) => s.despawn)
  const group = useRef(null)
  const motion = useRef({ walking: true, viewing: false, speech: null, yaw: Math.PI })
  const [bubble, setBubble] = useState(null)
  const [showName, setShowName] = useState(false)
  const lastBubble = useRef(null)
  const lastName = useRef(false)
  const frameN = useRef(0)

  useVisitorBrain(group, id, entrySide, leaving, motion, () => despawn(id), slotOf(id))

  useFrame(() => {
    const g = group.current
    if (!g) return
    let entry = npcPosMap.get(id)
    if (!entry) {
      entry = [0, 0]
      npcPosMap.set(id, entry)
    }
    entry[0] = g.position.x
    entry[1] = g.position.z

    frameN.current++
    if (frameN.current % 8 !== 0) return
    const visible = labelsNear(g.position, motion.current.speech || null, name)
    if (visible.speech !== lastBubble.current) {
      lastBubble.current = visible.speech
      setBubble(visible.speech)
    }
    const named = !!visible.name && !isLegacyNpcs()
    if (named !== lastName.current) {
      lastName.current = named
      setShowName(named)
    }
  })

  useEffect(() => () => {
    npcPosMap.delete(id)
  }, [id])

  return (
    <>
      <BlobShadow target={group} />
      <group ref={group} position={spawn} scale={scale}>
        <VisitorModel
          appearance={appearance || DEFAULT_APPEARANCE_FALLBACK}
          outfit={outfit}
          motion={motion}
          name={showName ? name : null}
          speech={isLegacyNpcs() ? null : bubble}
        />
      </group>
    </>
  )
}

/**
 * Cada cliente simula a própria multidão. Nada disso entra no Playroom:
 * o estado da sala continua sendo só pose dos jogadores e obras.
 */
export function VisitorFlowTicker() {
  const tick = useVisitorStore((s) => s.tick)
  const init = useVisitorStore((s) => s.init)

  useFrame((_, delta) => {
    const t = advanceSim(delta)
    if (!useVisitorStore.getState()._initialized) init(t)
    tick(t)
  })

  return null
}

export default function VisitorLayer() {
  const visitors = useVisitorStore((s) => s.visitors)

  return (
    <>
      {visitors.map((v) => (
        <HostVisitorNPC
          key={v.key}
          id={v.id}
          name={v.name}
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
