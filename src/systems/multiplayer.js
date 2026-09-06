/**
 * Multiplayer via Playroom Kit (Netlify estático, sem backend próprio).
 * Cada versão do museu usa um roomCode distinto.
 *
 * Importante: insertCoin() so pode ser chamado com sucesso uma vez por carga
 * da pagina. Chamar de novo apos sucesso trava a Promise — por isso, com
 * sessao online, so republicamos identidade no re-entrar (ESC).
 *
 * Se insertCoin falhar ou estourar timeout local, NAO marcamos sessionBooted:
 * a proxima tentativa pode chamar insertCoin de novo. Se o timeout local
 * disparou com a Promise ainda pendente, a proxima tentativa faz reload
 * (segundo insertCoin travaria).
 */

import {
  insertCoin,
  myPlayer,
  isHost as playroomIsHost,
  setState as roomSetState,
} from 'playroomkit'
import { DEFAULT_VERSION_ID, getVersionById } from '../data/versions'

export const MAX_PLAYERS = 10
export const POSE_INTERVAL_MS = 100
export const NPC_SNAPSHOT_MS = 180

const INSERT_COIN_TIMEOUT_MS = 12000
const PLAYROOM_GAME_ID_DOCS = 'https://docs.joinplayroom.com/errors/no-game-id'

let connected = false
let offline = false
/** true apenas apos insertCoin com sucesso nesta carga. */
let sessionBooted = false
let activeRoomCode = null
/**
 * true se o timeout local disparou enquanto insertCoin ainda pode estar
 * pendente — um segundo insertCoin nesta carga travaria; precisa reload.
 */
let insertCoinPossiblyPending = false
/** Promise em voo do boot atual (evita double-call enquanto waiting). */
let bootPromise = null

export function isMultiplayerConnected() {
  return connected && !offline
}

export function isMultiplayerOffline() {
  return offline
}

export function getActiveRoomCode() {
  return activeRoomCode
}

export function isRoomHost() {
  if (offline || !connected) return true
  try {
    return playroomIsHost()
  } catch {
    return true
  }
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    let settled = false
    const t = setTimeout(() => {
      if (settled) return
      settled = true
      const err = new Error(`${label} timeout (${ms}ms)`)
      err.isTimeout = true
      reject(err)
    }, ms)
    promise.then(
      (v) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

function reloadForRoom(code) {
  if (typeof window === 'undefined') return new Promise(() => {})
  const next = `#r=${encodeURIComponent(code)}`
  window.location.hash = next
  window.location.reload()
  return new Promise(() => {})
}

/**
 * Conecta à sala da versao. Se o roomCode mudar apos ja ter bootado, recarrega.
 * @param {{ name: string, appearance: object, outfit: string, scale: number[] }} identity
 * @param {string} roomCode
 */
export async function connectMultiplayer(identity, roomCode) {
  const code =
    roomCode ||
    getVersionById(DEFAULT_VERSION_ID).roomCode

  // Sessao ja ativa na mesma sala (inclui retorno do menu ESC): so atualiza nick
  if (sessionBooted && activeRoomCode === code && !offline) {
    connected = true
    publishIdentity(identity)
    return { ok: true, offline: false, roomCode: code }
  }

  // Timeout anterior deixou insertCoin possivelmente pendente — reload seguro
  if (insertCoinPossiblyPending) {
    return reloadForRoom(code)
  }

  // Troca de sala depois do primeiro boot ok: insertCoin de novo trava — recarrega
  if (sessionBooted && activeRoomCode && activeRoomCode !== code) {
    return reloadForRoom(code)
  }

  // Boot ja em andamento (double-click): espera o mesmo promise
  if (bootPromise) {
    try {
      await bootPromise
      if (connected && !offline && activeRoomCode === code) {
        publishIdentity(identity)
        return { ok: true, offline: false, roomCode: code }
      }
    } catch {
      /* cai no fluxo abaixo / offline */
    }
    if (insertCoinPossiblyPending) {
      return reloadForRoom(code)
    }
    if (offline) {
      return { ok: false, offline: true, roomCode: code }
    }
  }

  const opts = {
    skipLobby: true,
    roomCode: code,
    maxPlayersPerRoom: MAX_PLAYERS,
  }
  const gameId = import.meta.env.VITE_PLAYROOM_GAME_ID
  if (gameId) {
    opts.gameId = gameId
  } else if (typeof console !== 'undefined') {
    console.warn(
      `[multiplayer] VITE_PLAYROOM_GAME_ID nao definido. Playroom pode limitar DAU. Veja ${PLAYROOM_GAME_ID_DOCS}`
    )
  }

  const run = (async () => {
    await withTimeout(insertCoin(opts), INSERT_COIN_TIMEOUT_MS, 'insertCoin')
  })()
  bootPromise = run

  try {
    await run
    sessionBooted = true
    connected = true
    offline = false
    insertCoinPossiblyPending = false
    activeRoomCode = code
    publishIdentity(identity)
    if (typeof window !== 'undefined') {
      const next = `#r=${encodeURIComponent(code)}`
      if (window.location.hash !== next) {
        window.history.replaceState(null, '', next)
      }
    }
    return { ok: true, offline: false, roomCode: code }
  } catch (err) {
    console.warn('[multiplayer] Playroom indisponível, modo offline:', err)
    connected = false
    offline = true
    activeRoomCode = code
    // Timeout local: insertCoin pode ainda estar rodando — nao chamar de novo
    if (err?.isTimeout) {
      insertCoinPossiblyPending = true
      // Nao setar sessionBooted; proxima tentativa = reload
    } else {
      // Rejeicao real do SDK: permite retry de insertCoin nesta carga
      insertCoinPossiblyPending = false
      sessionBooted = false
    }
    return { ok: false, offline: true, error: err, roomCode: code }
  } finally {
    bootPromise = null
  }
}

export function publishIdentity(identity) {
  if (offline) return
  if (!sessionBooted && !connected) return
  try {
    const me = myPlayer()
    me.setState('name', identity.name, true)
    me.setState('appearance', identity.appearance, true)
    me.setState('outfit', identity.outfit, true)
    me.setState('scale', identity.scale, true)
  } catch (e) {
    console.warn('[multiplayer] falha ao publicar identidade', e)
  }
}

export function publishPose(pose) {
  if (!connected || offline) return
  try {
    myPlayer().setState('pose', pose, false)
  } catch {
    /* ignore */
  }
}

export function publishViewingArt(artId) {
  if (!connected || offline) return
  try {
    myPlayer().setState('viewingArtId', artId ?? null, true)
  } catch {
    /* ignore */
  }
}

export function publishNpcs(snapshot) {
  if (!connected || offline) return
  try {
    roomSetState('npcs', snapshot, false)
  } catch {
    /* ignore */
  }
}

export function getLocalPlayer() {
  if (!connected || offline) return null
  try {
    return myPlayer()
  } catch {
    return null
  }
}

/**
 * Volta ao menu: NAO derruba a sessao Playroom se estiver online.
 * insertCoin nao pode ser chamado de novo com sucesso sem reload.
 * Se estiver offline (falha limpa), limpa o flag para a UI permitir retry.
 */
export function resetMultiplayerSession() {
  if (offline && !sessionBooted && !insertCoinPossiblyPending) {
    offline = false
    activeRoomCode = null
  }
}
