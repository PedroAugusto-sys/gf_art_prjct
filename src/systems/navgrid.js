/**
 * navgrid.js — Grade de navegacao 2D gerada automaticamente a partir dos obstaculos.
 *
 * Por que substituir o grafo desenhado a mao?
 * Varios arcos cruzavam bancos e canteiros. O A* devolvia esses caminhos,
 * o push de colisao jogava o NPC para fora do obstaculo e o steering o
 * empurrava de volta — oscillacao que travava sempre nos mesmos pontos.
 *
 * Esta grade e construida UMA VEZ no carregamento:
 *   - Celulas de CELL_SIZE metros dentro de WALK_BOUNDS
 *   - Celula caminhavel quando seu centro livra todos os circulos de
 *     obstaculo.r + NPC_BODY_RADIUS (margem do corpo do visitante)
 *   - A*: 8 vizinhos, heuristica octil, sem corte de quina
 *     (a diagonal so e valida se os dois ortogonais adjacentes estiverem livres)
 *   - Suavizacao por string pulling: reduz o caminho em escada para
 *     segmentos retos enquanto a reta estiver livre de obstaculos
 *
 * API publica:
 *   findPath(x0, z0, x1, z1) -> Array<{x,z}>  ou  null se sem caminho
 *   nearestWalkable(x, z)    -> {x, z}
 *   isWalkable(x, z)         -> boolean
 */

import { NPC_OBSTACLES, WALK_BOUNDS } from '../data/museumLayout'

// ---------- Parametros da grade ----------
export const CELL_SIZE = 0.4
const NPC_MARGIN = 0.28          // raio do corpo — mesma constante de NPC.jsx
const SAMPLE_STEP = 0.2         // amostragem do string pulling

// ---------- Limites em indices ----------
const minX = WALK_BOUNDS.minX
const minZ = WALK_BOUNDS.minZ
const COLS = Math.ceil((WALK_BOUNDS.maxX - minX) / CELL_SIZE)
const ROWS = Math.ceil((WALK_BOUNDS.maxZ - minZ) / CELL_SIZE)

// ---------- Conversoes ----------
function toIdx(col, row) { return row * COLS + col }
function colOf(x) { return Math.floor((x - minX) / CELL_SIZE) }
function rowOf(z) { return Math.floor((z - minZ) / CELL_SIZE) }
function cellX(col) { return minX + col * CELL_SIZE + CELL_SIZE / 2 }
function cellZ(row) { return minZ + row * CELL_SIZE + CELL_SIZE / 2 }

// ---------- Mapa de caminhabilidade ----------
function buildWalkable() {
  const map = new Uint8Array(COLS * ROWS)   // 0 = bloqueado, 1 = livre
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = cellX(c)
      const cz = cellZ(r)
      let free = true
      for (const obs of NPC_OBSTACLES) {
        if (Math.hypot(cx - obs.x, cz - obs.z) < obs.r + NPC_MARGIN) {
          free = false
          break
        }
      }
      map[toIdx(c, r)] = free ? 1 : 0
    }
  }
  return map
}

const WALKABLE = buildWalkable()

export function isWalkable(x, z) {
  const c = colOf(x); const r = rowOf(z)
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false
  return WALKABLE[toIdx(c, r)] === 1
}

/** Celula livre mais proxima de (x, z). Busca em espiral ate raio 8. */
export function nearestWalkable(x, z) {
  const bc = Math.max(0, Math.min(COLS - 1, colOf(x)))
  const br = Math.max(0, Math.min(ROWS - 1, rowOf(z)))
  if (WALKABLE[toIdx(bc, br)]) return { x: cellX(bc), z: cellZ(br) }
  for (let radius = 1; radius <= 8; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue
        const c = bc + dc; const r = br + dr
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue
        if (WALKABLE[toIdx(c, r)]) return { x: cellX(c), z: cellZ(r) }
      }
    }
  }
  return { x, z } // fallback: posicao original
}

// ---------- Heuristica octil ----------
// Penalidade de diagonal = sqrt(2) ~ 1.414
const D1 = 1, D2 = Math.SQRT2
function heuristic(c0, r0, c1, r1) {
  const dc = Math.abs(c1 - c0), dr = Math.abs(r1 - r0)
  return D1 * (dc + dr) + (D2 - 2 * D1) * Math.min(dc, dr)
}

// 8 direcoes: [dc, dr, custo]
const DIRS = [
  [1, 0, D1], [-1, 0, D1], [0, 1, D1], [0, -1, D1],
  [1, 1, D2], [1, -1, D2], [-1, 1, D2], [-1, -1, D2],
]

// ---------- A* ----------
function astar(c0, r0, c1, r1) {
  if (!WALKABLE[toIdx(c0, r0)] || !WALKABLE[toIdx(c1, r1)]) return null

  // Min-heap simples baseado em array ordenado (quantidade de nos e pequena)
  const open = new Map()
  const cameFrom = new Map()
  const gScore = new Map()

  const startKey = toIdx(c0, r0)
  const goalKey = toIdx(c1, r1)

  gScore.set(startKey, 0)
  open.set(startKey, heuristic(c0, r0, c1, r1))

  // Guarda col/row de cada chave para reconstrucao
  const colRow = new Map([[startKey, [c0, r0]]])

  while (open.size > 0) {
    // Extrai o no com menor f
    let curKey = -1, bestF = Infinity
    for (const [k, f] of open) { if (f < bestF) { bestF = f; curKey = k } }
    open.delete(curKey)

    if (curKey === goalKey) {
      // Reconstroi o caminho
      const path = []
      let k = goalKey
      while (k !== startKey) {
        const [c, r] = colRow.get(k)
        path.push({ x: cellX(c), z: cellZ(r) })
        k = cameFrom.get(k)
      }
      path.reverse()
      return path
    }

    const [cc, cr] = colRow.get(curKey)
    const curG = gScore.get(curKey)

    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc, nr = cr + dr
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
      if (!WALKABLE[toIdx(nc, nr)]) continue

      // Sem corte de quina: a diagonal so e valida se os dois ortogonais forem livres
      if (dc !== 0 && dr !== 0) {
        if (!WALKABLE[toIdx(cc + dc, cr)] || !WALKABLE[toIdx(cc, cr + dr)]) continue
      }

      const nk = toIdx(nc, nr)
      const tentG = curG + cost
      if (tentG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentG)
        cameFrom.set(nk, curKey)
        colRow.set(nk, [nc, nr])
        open.set(nk, tentG + heuristic(nc, nr, c1, r1))
      }
    }
  }
  return null // sem caminho
}

// ---------- String pulling ----------
/** Verifica se o segmento (x0,z0)-(x1,z1) esta livre de obstaculos. */
function segmentFree(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0
  const len = Math.hypot(dx, dz)
  if (len < 1e-4) return true
  const steps = Math.ceil(len / SAMPLE_STEP)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = x0 + dx * t, z = z0 + dz * t
    for (const obs of NPC_OBSTACLES) {
      if (Math.hypot(x - obs.x, z - obs.z) < obs.r + NPC_MARGIN) return false
    }
  }
  return true
}

function smooth(points, startX, startZ) {
  if (points.length <= 1) return points
  const result = []
  let ax = startX, az = startZ
  let i = points.length - 1
  while (i >= 0) {
    if (i === 0 || !segmentFree(ax, az, points[i].x, points[i].z)) {
      // Retrocede ate um ponto visivel
      const prev = i + 1 < points.length ? i + 1 : i
      result.push(points[prev])
      ax = points[prev].x
      az = points[prev].z
      i = prev - 1
    } else {
      i--
    }
  }
  result.reverse()
  return result
}

// ---------- API publica ----------
/**
 * Calcula o caminho de (x0,z0) ate (x1,z1).
 * Retorna array de pontos de mundo {x,z} ou null se sem caminho.
 */
export function findPath(x0, z0, x1, z1) {
  const c0 = Math.max(0, Math.min(COLS - 1, colOf(x0)))
  const r0 = Math.max(0, Math.min(ROWS - 1, rowOf(z0)))
  const c1 = Math.max(0, Math.min(COLS - 1, colOf(x1)))
  const r1 = Math.max(0, Math.min(ROWS - 1, rowOf(z1)))

  // Celula de origem bloqueada: parte da mais proxima livre
  const startFree = WALKABLE[toIdx(c0, r0)]
    ? { c: c0, r: r0 }
    : (() => { const p = nearestWalkable(x0, z0); return { c: colOf(p.x), r: rowOf(p.z) } })()

  const goalFree = WALKABLE[toIdx(c1, r1)]
    ? { c: c1, r: r1 }
    : (() => { const p = nearestWalkable(x1, z1); return { c: colOf(p.x), r: rowOf(p.z) } })()

  const raw = astar(startFree.c, startFree.r, goalFree.c, goalFree.r)
  if (!raw) return null

  // String pulling a partir da posicao real (nao da celula de origem)
  const smoothed = smooth(raw, x0, z0)
  return smoothed
}
