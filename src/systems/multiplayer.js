/**
 * Multiplayer via Playroom Kit (Netlify estático, sem backend próprio).
 * Cada versão do museu usa um roomCode distinto.
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

let connected = false
let offline = false
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

/**
 * Conecta à sala da versao. Se o roomCode mudar, força nova conexao.
 * @param {{ name: string, appearance: object, outfit: string, scale: number[] }} identity
 * @param {string} roomCode
 */
export async function connectMultiplayer(identity, roomCode) {
  const code =
    roomCode ||
    getVersionById(DEFAULT_VERSION_ID).roomCode

  // Mesma sala ja conectada: so republica identidade
  if (connected && !offline && activeRoomCode === code) {
    publishIdentity(identity)
    return { ok: true, offline: false, roomCode: code }
  }

  // Troca de sala: zera estado local (Playroom mantem a sessao anterior no SDK;
  // insertCoin com outro roomCode cria/entra na sala pedida.)
  connected = false
  offline = false
  activeRoomCode = null

  const opts = {
    skipLobby: true,
    roomCode: code,
    maxPlayersPerRoom: MAX_PLAYERS,
  }
  const gameId = import.meta.env.VITE_PLAYROOM_GAME_ID
  if (gameId) opts.gameId = gameId

  try {
    await insertCoin(opts)
    connected = true
    offline = false
    activeRoomCode = code
    publishIdentity(identity)
    // Espelha o convite na URL sem recarregar
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
    return { ok: false, offline: true, error: err, roomCode: code }
  }
}

export function publishIdentity(identity) {
  if (!connected || offline) return
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

/** Volta ao menu: permite conectar de novo / trocar de sala. */
export function resetMultiplayerSession() {
  connected = false
  offline = false
  activeRoomCode = null
}
