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
  getState as roomGetState,
  onPlayerJoin,
} from 'playroomkit'
import { DEFAULT_VERSION_ID, getVersionById, museumLocationHash } from '../data/versions'
import { packGallery, unpackGallery, staleImageKeys } from './galleryPayload.js'

export const MAX_PLAYERS = 10
export const POSE_INTERVAL_MS = 100
export const NPC_SNAPSHOT_MS = 180

const INSERT_COIN_TIMEOUT_MS = 12000
const PLAYROOM_DOCS_URL = 'https://docs.joinplayroom.com/usage/getting-started'
let hasWarnedMissingGameId = false // Avisa apenas uma vez por sessão
let hasWarnedWebSocketBlocked = false

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
let playroomGuardInstalled = false

function playroomEmitterNoise(message, stack) {
  const msg = String(message || '')
  if (!msg.includes('Unhandled error')) return false
  const frame = String(stack || '')
  return frame.includes('WebSocket') || frame.includes('.emit') || msg.includes('undefined')
}

/** O SDK joga "Unhandled error. (undefined)" quando o socket recusa um estado. Não deixa isso encher o console. */
function installPlayroomErrorGuard() {
  if (playroomGuardInstalled || typeof window === 'undefined') return
  playroomGuardInstalled = true
  window.addEventListener('error', (event) => {
    if (!playroomEmitterNoise(event.message, event.error?.stack)) return
    event.preventDefault()
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const msg = reason && typeof reason === 'object' ? reason.message : reason
    const stack = reason && typeof reason === 'object' ? reason.stack : ''
    if (!playroomEmitterNoise(msg, stack)) return
    event.preventDefault()
  })
}

installPlayroomErrorGuard()

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

export function playroomGameId() {
  const id = import.meta.env.VITE_PLAYROOM_GAME_ID
  return typeof id === 'string' ? id.trim() : ''
}

/** O hash `r` precisa ser `R` + sala antes do insertCoin, senão o SDK corta a primeira letra. */
export function alignPlayroomRoomHash(roomCode) {
  if (typeof window === 'undefined') return
  const next = museumLocationHash(roomCode)
  const url = `${window.location.pathname}${window.location.search}${next}`
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
    window.history.replaceState(null, '', url)
  }
}

function reloadForRoom(code) {
  if (typeof window === 'undefined') return new Promise(() => {})
  alignPlayroomRoomHash(code)
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

  alignPlayroomRoomHash(code)

  const opts = {
    skipLobby: true,
    roomCode: code,
    maxPlayersPerRoom: MAX_PLAYERS,
  }
  // O lobby gera um nome aleatório (President48) e grava no perfil.
  // O apelido digitado entra no perfil já na entrada, senão os outros
  // jogadores só enxergam esse nome automático.
  const typedName = String(identity?.name || '').trim()
  if (typedName) {
    opts.profile = { name: typedName }
  }
  const gameId = playroomGameId()
  if (gameId) {
    opts.gameId = gameId
  } else if (!hasWarnedMissingGameId && typeof console !== 'undefined') {
    // Avisa apenas uma vez por sessão (não spam a cada entrada)
    hasWarnedMissingGameId = true
    console.info(
      `%c[multiplayer] Playroom em modo desenvolvimento%c
      
✓ Funcionando com limite de DAU (Daily Active Users)
      
Para PRODUÇÃO (DAU ilimitado):
1. Crie conta gratuita: https://app.joinplayroom.com
2. Crie novo jogo no dashboard
3. Copie o Game ID
4. Configure VITE_PLAYROOM_GAME_ID no arquivo .env (veja .env.example)

Documentação: ${PLAYROOM_DOCS_URL}`,
      'color: #16a34a; font-weight: bold',
      'color: inherit; font-weight: normal'
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
    alignPlayroomRoomHash(code)
    return {
      ok: true,
      offline: false,
      roomCode: code,
      reason: gameId ? null : 'missing-game-id',
    }
  } catch (err) {
    // Modo offline silencioso com melhor diagnóstico
    if (typeof console !== 'undefined' && !hasWarnedMissingGameId) {
      // Detecta erro de WebSocket bloqueado (adblock/extensão)
      const isWebSocketBlocked = 
        err?.message?.includes('WebSocket') ||
        err?.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
        err?.message?.includes('net::ERR')
      
      if (isWebSocketBlocked && !hasWarnedWebSocketBlocked) {
        hasWarnedWebSocketBlocked = true
        console.warn(
          `%c[multiplayer] WebSocket bloqueado%c
          
⚠️ Conexão multiplayer falhou (possíveis causas):
  • Bloqueador de anúncios ativo (ex: uBlock, AdBlock)
  • Extensão de privacidade bloqueando WebSockets
  • Firewall/proxy corporativo
  
💡 Solução:
  • Desative bloqueadores para este site
  • Ou use navegação privada/anônima
  • Ou adicione exceção para joinplayroom.com
  
✓ O museu continua funcionando em modo solo`,
          'color: #eab308; font-weight: bold',
          'color: inherit; font-weight: normal'
        )
      } else {
        console.info('[multiplayer] Modo solo (Playroom indisponível)')
      }
    }
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
    return {
      ok: false,
      offline: true,
      error: err,
      roomCode: code,
      reason: gameId ? 'connection-failed' : 'missing-game-id',
    }
  } finally {
    bootPromise = null
  }
}

/** Apelido que os outros veem. O digitado vence; o do Playroom só entra se estiver vazio. */
export function remoteDisplayName(player) {
  try {
    const nick = String(player.getState('nick') || '').trim()
    if (nick) return nick
    const legacy = String(player.getState('name') || '').trim()
    if (legacy) return legacy
    const profile = String(player.getProfile()?.name || '').trim()
    return profile || 'Visitante'
  } catch {
    return 'Visitante'
  }
}

export function publishIdentity(identity) {
  if (offline) return
  if (!sessionBooted && !connected) return
  try {
    const me = myPlayer()
    const name = String(identity?.name || '').trim()
    if (name) {
      me.setState('nick', name, true)
      me.setState('name', name, true)
      try {
        const current = me.getState('profile')
        const base = current && typeof current === 'object' ? current : {}
        me.setState('profile', { ...base, name }, true)
      } catch {
        // O apelido em nick continua valendo para quem lê o estado.
      }
    }
    me.setState('appearance', identity.appearance, true)
    me.setState('outfit', identity.outfit, true)
    me.setState('scale', identity.scale, true)
  } catch (e) {
    // Falha silenciosa - modo offline ou estado não disponível
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

function readChunk(key) {
  try {
    return roomGetState(key)
  } catch {
    return undefined
  }
}

export function readGalleryMeta() {
  if (!connected || offline) return null
  try {
    return roomGetState('gallery') || null
  } catch {
    return null
  }
}

export function readSharedGallery() {
  const meta = readGalleryMeta()
  if (!meta) return null
  return unpackGallery(meta, readChunk)
}

export function publishGalleryState(gallery) {
  if (!connected || offline || !gallery) return
  try {
    const prev = readGalleryMeta()
    const packed = packGallery(gallery)
    for (const chunk of packed.chunks) {
      try {
        roomSetState(chunk.key, chunk.value, true)
      } catch {
        /* um pedaço recusado não pode impedir os outros */
      }
    }
    try {
      roomSetState('gallery', packed.meta, true)
    } catch {
      /* ignore */
    }
    for (const key of staleImageKeys(prev, packed.meta)) {
      try {
        roomSetState(key, '', true)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export function subscribeGalleryState(callback) {
  if (!connected || offline) return () => {}
  try {
    const unsubscribe = onPlayerJoin((state) => {
      // Quando o estado mudar, notifica o callback
      try {
        const gallery = readSharedGallery()
        if (gallery) callback(gallery)
      } catch {
        /* ignore */
      }
    })
    
    // Carrega estado inicial imediatamente
    try {
      const gallery = readSharedGallery()
      if (gallery) callback(gallery)
    } catch {
      /* ignore */
    }
    
    return unsubscribe
  } catch {
    return () => {}
  }
}

export function getInitialGalleryState() {
  return readSharedGallery()
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
