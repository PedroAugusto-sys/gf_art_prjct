/**
 * Multiplayer via Playroom Kit (Netlify estático, sem backend próprio).
 * Cada versão do museu usa um roomCode distinto.
 *
 * Importante: insertCoin() so pode ser chamado com sucesso uma vez por carga
 * da pagina. Chamar de novo (ex.: apos ESC) trava a Promise — por isso
 * mantemos a sessao e so republicamos identidade no re-entrar.
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

let connected = false
let offline = false
/** true apos o primeiro insertCoin (ok ou falha offline) nesta carga. */
let sessionBooted = false
let activeRoomCode = null

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
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
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

  // Offline na mesma sala: reentra sem novo insertCoin
  if (sessionBooted && activeRoomCode === code && offline) {
    publishIdentity(identity)
    return { ok: false, offline: true, roomCode: code }
  }

  // Troca de sala depois do primeiro boot: insertCoin de novo trava — recarrega
  if (sessionBooted && activeRoomCode && activeRoomCode !== code) {
    if (typeof window !== 'undefined') {
      const next = `#r=${encodeURIComponent(code)}`
      window.location.hash = next
      window.location.reload()
    }
    // Pagina vai recarregar; nao desbloqueia o botao
    return new Promise(() => {})
  }

  const opts = {
    skipLobby: true,
    roomCode: code,
    maxPlayersPerRoom: MAX_PLAYERS,
  }
  const gameId = import.meta.env.VITE_PLAYROOM_GAME_ID
  if (gameId) opts.gameId = gameId

  try {
    await withTimeout(insertCoin(opts), INSERT_COIN_TIMEOUT_MS, 'insertCoin')
    sessionBooted = true
    connected = true
    offline = false
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
    sessionBooted = true
    connected = false
    offline = true
    activeRoomCode = code
    return { ok: false, offline: true, error: err, roomCode: code }
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
 * Volta ao menu: NAO derruba a sessao Playroom.
 * insertCoin nao pode ser chamado de novo sem reload.
 */
export function resetMultiplayerSession() {
  // Mantem sessionBooted, activeRoomCode e flags de conexao.
}
