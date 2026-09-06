/**
 * Registro de versoes do museu.
 * Cada versao playable usa um roomCode Playroom distinto (trocar versao = trocar de sala).
 *
 * --- Apresentacao publica (timeline) ---
 * So versoes com timelineVisible: true aparecem na régua do menu.
 * Hoje so a v0 fica visivel (apresentacao gradual).
 *
 * Para restaurar a régua completa no futuro:
 * 1. Defina timelineVisible: true em v1, v2, v3 (e demais).
 * 2. Quando uma versao estiver pronta, mude status para 'playable'.
 * 3. VersionTimeline volta a mostrar a faixa horizontal entre os pontos.
 * NAO apague as entradas abaixo — so ajuste as flags.
 */

export const VERSIONS = [
  {
    id: 'v0',
    title: 'Inicial',
    dateLabel: 'Início',
    blurb: '',
    roomCode: 'gf-museu-v0',
    status: 'playable', // playable | coming
    timelineVisible: true,
    flags: { legacyNpcs: true, prototypeScene: true },
  },
  {
    id: 'v1',
    title: 'Atual',
    dateLabel: 'Agora',
    blurb: 'Indisponível por enquanto — em breve.',
    roomCode: 'gf-museu-v1',
    status: 'coming',
    timelineVisible: false,
    flags: { legacyNpcs: false, prototypeScene: false },
  },
  {
    id: 'v2',
    title: 'Próxima',
    dateLabel: 'Em breve',
    blurb: 'Próxima atualização — ainda não disponível.',
    roomCode: 'gf-museu-v2',
    status: 'coming',
    timelineVisible: false,
    flags: {},
  },
  {
    id: 'v3',
    title: 'Futuro',
    dateLabel: 'Futuro',
    blurb: 'Marcos futuros do projeto.',
    roomCode: 'gf-museu-v3',
    status: 'coming',
    timelineVisible: false,
    flags: {},
  },
]

export const DEFAULT_VERSION_ID = 'v0'

/** Versões exibidas na régua do menu (apresentação). */
export function getTimelineVersions() {
  return VERSIONS.filter((v) => v.timelineVisible)
}

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
