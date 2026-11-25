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
    blurb: '',
    roomCode: 'gf-museu-v1',
    status: 'playable',
    timelineVisible: true,
    flags: { legacyNpcs: false, prototypeScene: false, communityGallery: true },
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

export const DEFAULT_VERSION_ID = 'v1'

/** Versões exibidas na régua do menu (apresentação). */
export function getTimelineVersions() {
  return VERSIONS.filter((v) => v.timelineVisible)
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

/**
 * O Playroom lê o hash `r` e descarta o primeiro caractere (o R que ele mesmo grava).
 * Um link `#r=gf-museu-v1` entra na sala `f-museu-v1`, diferente de quem entrou
 * sem hash e usou o roomCode inteiro. Por isso a sala conhecida vem de `m` ou
 * de `?r=`, e o hash `r` só vale se for `R` + um código nosso.
 */
export function normalizeRoomCode(raw) {
  if (!raw) return null
  let code = String(raw).trim()
  try {
    code = decodeURIComponent(code)
  } catch {
    /* mantém o texto cru */
  }
  if (!code) return null
  if (code.startsWith('R') && getVersionByRoomCode(code.slice(1))) return code.slice(1)
  if (getVersionByRoomCode(code)) return code
  return null
}

export function readRoomCodeFromLocation(loc = {}) {
  const hash = loc.hash || ''
  const search = loc.search || ''
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const candidates = [hashParams.get('m'), query.get('m'), query.get('r'), hashParams.get('r')]
  for (let i = 0; i < candidates.length; i++) {
    const code = normalizeRoomCode(candidates[i])
    if (code) return code
  }
  return null
}

/** Hash que o Playroom e o museu leem como a mesma sala. */
export function museumLocationHash(roomCode) {
  const params = new URLSearchParams()
  params.set('m', roomCode)
  params.set('r', `R${roomCode}`)
  return `#${params.toString()}`
}

/** Lê a sala da URL. Aceita o hash antigo e também `?r=`. */
export function parseRoomCodeFromHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  const search = typeof window !== 'undefined' && (hash === window.location.hash || hash === undefined)
    ? window.location.search
    : ''
  return readRoomCodeFromLocation({ hash, search })
}

export function buildInviteUrl(roomCode) {
  const query = `?r=${encodeURIComponent(roomCode)}`
  if (typeof window === 'undefined') return `/${query}`
  return `${window.location.origin}/${query}`
}

export function versionFromUrl() {
  const loc = typeof window !== 'undefined' ? window.location : { hash: '', search: '' }
  const code = readRoomCodeFromLocation(loc)
  let v = code ? getVersionByRoomCode(code) : null
  if (!v || v.status !== 'playable') v = getVersionById(DEFAULT_VERSION_ID)
  return v
}
