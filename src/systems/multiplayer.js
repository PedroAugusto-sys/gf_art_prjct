/**
 * Multiplayer via Playroom Kit (Netlify estático, sem backend próprio).
 */

import {
  insertCoin,
  myPlayer,
  isHost as playroomIsHost,
  setState as roomSetState,
} from 'playroomkit'

export const ROOM_CODE = 'gf-museu'
export const MAX_PLAYERS = 10
export const POSE_INTERVAL_MS = 100
export const NPC_SNAPSHOT_MS = 180

let connected = false
let offline = false

export function isMultiplayerConnected() {
  return connected && !offline
}

export function isMultiplayerOffline() {
  return offline
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
 * Conecta à sala única do museu. Em falha, marca offline.
 * @param {{ name: string, appearance: object, outfit: string, scale: number[] }} identity
 */
export async function connectMultiplayer(identity) {
  if (connected) {
    publishIdentity(identity)
    return { ok: true, offline: false }
  }

  const opts = {
    skipLobby: true,
    roomCode: ROOM_CODE,
    maxPlayersPerRoom: MAX_PLAYERS,
  }
  const gameId = import.meta.env.VITE_PLAYROOM_GAME_ID
  if (gameId) opts.gameId = gameId

  try {
    await insertCoin(opts)
    connected = true
    offline = false
    publishIdentity(identity)
    return { ok: true, offline: false }
  } catch (err) {
    console.warn('[multiplayer] Playroom indisponível, modo offline:', err)
    connected = false
    offline = true
    return { ok: false, offline: true, error: err }
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
