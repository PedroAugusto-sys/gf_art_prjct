/**
 * Registro de versoes do museu.
 * Cada versao playable usa um roomCode Playroom distinto (trocar versao = trocar de sala).
 */

export const VERSIONS = [
  {
    id: 'v0',
    title: 'Inicial',
    dateLabel: 'Início',
    blurb: 'Versão inicial: blockout sem paredes/pilares/árvores, NPCs instáveis e multiplayer.',
    roomCode: 'gf-museu-v0',
    status: 'playable', // playable | coming
    flags: { legacyNpcs: true, prototypeScene: true },
  },
  {
    id: 'v1',
    title: 'Atual',
    dateLabel: 'Agora',
    blurb: 'Indisponível por enquanto — em breve.',
    roomCode: 'gf-museu-v1',
    status: 'coming',
    flags: { legacyNpcs: false, prototypeScene: false },
  },
  {
    id: 'v2',
    title: 'Próxima',
    dateLabel: 'Em breve',
    blurb: 'Próxima atualização — ainda não disponível.',
    roomCode: 'gf-museu-v2',
    status: 'coming',
    flags: {},
  },
  {
    id: 'v3',
    title: 'Futuro',
    dateLabel: 'Futuro',
    blurb: 'Marcos futuros do projeto.',
    roomCode: 'gf-museu-v3',
    status: 'coming',
    flags: {},
  },
]

export const DEFAULT_VERSION_ID = 'v0'

export function getPlayableVersions() {
  return VERSIONS.filter((v) => v.status === 'playable')
}

export function getVersionById(id) {
  const found = VERSIONS.find((v) => v.id === id)
  if (found) return found
  return VERSIONS.find((v) => v.status === 'playable') || VERSIONS[0]
}

/** Sempre devolve uma versão jogável (ignora coming). */
export function resolvePlayableVersion(id) {
  const found = VERSIONS.find((v) => v.id === id)
  if (found?.status === 'playable') return found
  return getVersionById(DEFAULT_VERSION_ID)
}

export function getVersionByRoomCode(code) {
  if (!code) return null
  const normalized = String(code).trim().toLowerCase()
  const match = VERSIONS.find((v) => v.roomCode.toLowerCase() === normalized)
  if (match) return match
  // Links antigos: cair na unica versao jogavel
  if (normalized === 'gf-museu' || normalized === 'rgf-museu' || normalized === 'gf-museu-v1') {
    return getVersionById(DEFAULT_VERSION_ID)
  }
  return null
}

/** Lê #r=CODE da URL atual. */
export function parseRoomCodeFromHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  if (!hash) return null
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw.includes('=') ? raw : `r=${raw}`)
  const code = params.get('r')
  return code ? code.trim() : null
}

export function buildInviteUrl(roomCode) {
  if (typeof window === 'undefined') return `/#r=${roomCode}`
  return `${window.location.origin}/#r=${encodeURIComponent(roomCode)}`
}

export function versionFromUrl() {
  const code = parseRoomCodeFromHash()
  let v = code ? getVersionByRoomCode(code) : null
  if (!v || v.status !== 'playable') v = getVersionById(DEFAULT_VERSION_ID)
  return v
}
