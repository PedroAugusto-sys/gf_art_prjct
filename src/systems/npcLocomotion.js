/**
 * Passo dos visitantes sobre a grade andável.
 *
 * O caminho vem do A*. O passo nunca teleporta: se a parede bloqueia,
 * o visitante escorrega no eixo livre ou fica parado e pede outra rota.
 * O snap para a célula mais próxima empurrava o corpo para trás e
 * produzia o tremor contra a parede.
 */

import { findPath, isWalkable, nearestWalkable } from './navgrid.js'
import {
  claimIdleSpot,
  claimViewingSpot,
  releaseSpot,
  separationForce,
  updateAgent,
} from './crowd.js'
import { DOORS, HALF_D } from '../data/museumLayout.js'
import { SPEECH_DELAY_MAX, SPEECH_DELAY_MIN } from './npcDialogue.js'

export const WALK_SPEED = 1.2
export const ARRIVE_RADIUS = 0.45
export const ARRIVE_FINAL = 0.4

const STUCK_INTERVAL = 1.2
const STUCK_MIN_PROGRESS = 0.3
const STUCK_MAX_RETRIES = 2
const VIEW_MIN = 8
const VIEW_MAX = 15
const REST_MIN = 3
const REST_MAX = 7
const DOOR_LEFT_X = DOORS.centers[0]
const DOOR_RIGHT_X = DOORS.centers[1]
const DOOR_CORRIDOR_W = DOORS.width * 0.6
const SEPARATION_RADIUS = 0.9

const _sep = { x: 0, z: 0 }

export function createWalker(entrySide = 1) {
  return {
    mode: 'walking',
    route: [],
    look: null,
    lastArtId: null,
    until: 0,
    started: false,
    avoidSide: entrySide < 0 ? -1 : 1,
    stuckCheckAt: 0,
    stuckX: 0,
    stuckZ: 0,
    stuckRetries: 0,
    leavingAt: 0,
    goal: null,
    speechText: null,
    speechUntil: 0,
    speechCooldownUntil: 0,
    speechArmedAt: 0,
  }
}

function insideGallery(z) {
  return z < HALF_D - 0.5
}

/** O destino final mora numa célula andável. O ponto cru, se cair na parede, fica para trás. */
export function walkableGoal(x, z) {
  if (!insideGallery(z) || isWalkable(x, z)) return { x, z }
  return nearestWalkable(x, z)
}

export function buildWalkerRoute(state, position, targetX, targetZ, entrySide = 1) {
  const goal = walkableGoal(targetX, targetZ)
  state.goal = goal
  const route = []
  const outside = position.z > HALF_D - 0.5
  const doorX = entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X

  if (outside) {
    route.push({ x: doorX, z: HALF_D + 1.8 })
    route.push({ x: doorX, z: HALF_D - 1.0 })
  }

  const sx = outside ? doorX : position.x
  const sz = outside ? HALF_D - 1.0 : position.z
  const path = findPath(sx, sz, goal.x, goal.z) || []
  for (const node of path) {
    if (Math.hypot(node.x - position.x, node.z - position.z) < ARRIVE_RADIUS * 0.6) continue
    route.push({ x: node.x, z: node.z })
  }

  const last = route[route.length - 1]
  if (!last || Math.hypot(last.x - goal.x, last.z - goal.z) > 0.25) {
    route.push({ x: goal.x, z: goal.z, final: true })
  } else {
    last.final = true
    last.x = goal.x
    last.z = goal.z
  }
  state.route = route
}

function buildExitRoute(state, position, entrySide) {
  releaseSpot(state.npcId)
  const doorX = entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X
  const route = []
  const path = findPath(position.x, position.z, doorX, HALF_D - 1.0) || []
  for (const node of path) route.push({ x: node.x, z: node.z })
  route.push({ x: doorX, z: HALF_D - 0.3 })
  route.push({ x: doorX, z: HALF_D + 2.5, final: true })
  state.route = route
  state.look = null
  state.goal = { x: doorX, z: HALF_D + 2.5 }
  state.leavingAt = state.leavingAt || 0
}

function chooseNextVisit(state, position, time) {
  const where = { x: position.x, z: position.z }
  let spot =
    claimViewingSpot(state.npcId, { ...where, avoidArtId: state.lastArtId }) ||
    claimIdleSpot(state.npcId, where)

  if (spot) {
    const goal = walkableGoal(spot.x, spot.z)
    const outside = position.z > HALF_D - 0.5
    const fromX = outside ? (state.entrySide < 0 ? DOOR_LEFT_X : DOOR_RIGHT_X) : position.x
    const fromZ = outside ? HALF_D - 1.0 : position.z
    const path = findPath(fromX, fromZ, goal.x, goal.z)
    if (!path) {
      releaseSpot(state.npcId)
      spot = null
    }
  }

  if (!spot) {
    state.mode = 'walking'
    state.route = []
    state.until = time + 1.2
    return
  }

  buildWalkerRoute(state, position, spot.x, spot.z, state.entrySide)
  state.mode = 'walking'
  state.look = spot.look
  state.lastArtId = spot.artId
  state.stuckCheckAt = time + STUCK_INTERVAL
  state.stuckX = position.x
  state.stuckZ = position.z
  state.stuckRetries = 0
}

function constrainMove(position, state) {
  if (!insideGallery(position.z) || state.mode === 'exiting') return false
  const nearDoor =
    Math.abs(position.x - DOOR_LEFT_X) < DOOR_CORRIDOR_W ||
    Math.abs(position.x - DOOR_RIGHT_X) < DOOR_CORRIDOR_W
  if ((state.mode === 'leaving' || state.mode === 'exiting') && nearDoor) return false
  return true
}

/**
 * Um passo em direção ao waypoint. Não anda para trás e não entra em célula bloqueada.
 */
export function stepToward(x, z, dirX, dirZ, step, constrain) {
  if (step <= 1e-6) return { x, z, moved: false }
  const nx = x + dirX * step
  const nz = z + dirZ * step
  if (!constrain || isWalkable(nx, nz)) return { x: nx, z: nz, moved: true }
  if (Math.abs(dirX) > 0.08 && isWalkable(nx, z)) return { x: nx, z, moved: true }
  if (Math.abs(dirZ) > 0.08 && isWalkable(x, nz)) return { x, z: nz, moved: true }
  return { x, z, moved: false }
}

function pushApart(state, position, dirX, dirZ, constrain) {
  const sep = separationForce(state.npcId, position.x, position.z, SEPARATION_RADIUS, _sep)
  const perpX = -dirZ
  const perpZ = dirX
  const lateral = sep.x * perpX + sep.z * perpZ
  if (Math.abs(lateral) < 0.02) return
  const nx = position.x + perpX * lateral * 0.08
  const nz = position.z + perpZ * lateral * 0.08
  const forward = (nx - position.x) * dirX + (nz - position.z) * dirZ
  if (forward < -0.002) return
  if (constrain && !isWalkable(nx, nz)) return
  position.x = nx
  position.z = nz
}

/**
 * Avança um visitante. `position` é mutável ({ x, z } ou Vector3).
 * Devolve a direção que o corpo deve encarar, sempre rumo ao waypoint.
 */
export function tickWalker(state, position, dt, time, { npcId, leaving, entrySide }) {
  state.npcId = npcId
  state.entrySide = entrySide
  const stepDt = Math.min(dt, 0.05)

  if (!state.started) {
    state.started = true
    chooseNextVisit(state, position, time)
  }

  if (leaving && state.mode !== 'leaving' && state.mode !== 'exiting') {
    state.mode = 'leaving'
    state.leavingAt = time
    buildExitRoute(state, position, entrySide)
  }

  if (state.mode === 'leaving' && state.leavingAt > 0 && time - state.leavingAt > 40) {
    updateAgent(npcId, position.x, position.z)
    return { moving: false, faceX: null, faceZ: null, despawn: true }
  }

  // Uma vez, se nasceu dentro de um obstáculo. Sem isso o corpo fica
  // no canteiro e o passo seguinte não tem para onde ir.
  if (!state.grounded) {
    state.grounded = true
    if (insideGallery(position.z) && !isWalkable(position.x, position.z)) {
      const back = nearestWalkable(position.x, position.z)
      position.x = back.x
      position.z = back.z
      updateAgent(npcId, position.x, position.z)
      return { moving: false, blocked: false, faceX: null, faceZ: null, despawn: false }
    }
  }

  let moving = false
  let blocked = false
  let faceX = null
  let faceZ = null

  if (state.mode === 'exiting') {
    position.z += WALK_SPEED * stepDt
    moving = true
    faceX = 0
    faceZ = 1
    updateAgent(npcId, position.x, position.z)
    return {
      moving: true,
      blocked: false,
      faceX,
      faceZ,
      despawn: position.z > 32,
    }
  }

  if (state.route.length > 0) {
    const wp = state.route[0]
    let dx = wp.x - position.x
    let dz = wp.z - position.z
    let dist = Math.hypot(dx, dz)
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
          if (state.mode === 'viewing') {
            state.speechArmedAt =
              time + SPEECH_DELAY_MIN + Math.random() * (SPEECH_DELAY_MAX - SPEECH_DELAY_MIN)
          }
        }
      }
    } else {
      const dirX = dx / dist
      const dirZ = dz / dist
      faceX = dirX
      faceZ = dirZ
      const constrain = constrainMove(position, state)
      const moved = stepToward(position.x, position.z, dirX, dirZ, Math.min(WALK_SPEED * stepDt, dist), constrain)
      position.x = moved.x
      position.z = moved.z
      moving = moved.moved
      blocked = !moved.moved
      if (moved.moved) pushApart(state, position, dirX, dirZ, constrainMove(position, state))
    }
  } else if (state.mode === 'viewing' || state.mode === 'resting') {
    if (time >= state.until) {
      if (leaving) {
        state.mode = 'leaving'
        state.leavingAt = time
        buildExitRoute(state, position, entrySide)
      } else {
        chooseNextVisit(state, position, time)
      }
    }
  } else if (state.mode === 'walking' && time >= state.until) {
    chooseNextVisit(state, position, time)
  }

  const trying = state.route.length > 0 && (state.mode === 'walking' || state.mode === 'leaving')
  if (trying && time >= state.stuckCheckAt) {
    const progress = Math.hypot(position.x - state.stuckX, position.z - state.stuckZ)
    if (progress < STUCK_MIN_PROGRESS) {
      state.stuckRetries += 1
      const target = state.goal
      if (state.stuckRetries >= STUCK_MAX_RETRIES || !target) {
        state.stuckRetries = 0
        if (leaving || state.mode === 'leaving') buildExitRoute(state, position, entrySide)
        else chooseNextVisit(state, position, time)
      } else if (target) {
        buildWalkerRoute(state, position, target.x, target.z, entrySide)
      }
    } else {
      state.stuckRetries = 0
    }
    state.stuckCheckAt = time + STUCK_INTERVAL
    state.stuckX = position.x
    state.stuckZ = position.z
  }

  updateAgent(npcId, position.x, position.z)
  return { moving, blocked, faceX, faceZ, despawn: false }
}
