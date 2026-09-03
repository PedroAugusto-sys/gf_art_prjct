/**
 * navgrid.js — Grade de navegacao 2D gerada a partir dos obstaculos.
 *
 * Grade de CELL_SIZE metros, A* com min-heap binario (O(log n) por insercao/extracao),
 * string pulling por visibilidade de segmento.
 *
 * A grade e construida UMA VEZ no carregamento; findPath aloca estruturas
 * reutilizaveis para nao pressionar o GC.
 */

import { NPC_OBSTACLES, WALK_BOUNDS } from '../data/museumLayout'

// ---------- Parametros ----------
const CELL_SIZE  = 0.5           // resolucao: 0.5m da menos celulas que 0.4m (grade 28% menor)
const NPC_MARGIN = 0.30          // raio do corpo + folga
const SAMPLE_STEP = 0.35         // passo do string pulling (era 0.2, muito fino)

// ---------- Grade ----------
const minX = WALK_BOUNDS.minX
const minZ = WALK_BOUNDS.minZ
const COLS = Math.ceil((WALK_BOUNDS.maxX - minX) / CELL_SIZE) + 1
const ROWS = Math.ceil((WALK_BOUNDS.maxZ - minZ) / CELL_SIZE) + 1
const TOTAL = COLS * ROWS

function toIdx(c, r)  { return r * COLS + c }
function colOf(x)     { return Math.max(0, Math.min(COLS - 1, Math.floor((x - minX) / CELL_SIZE))) }
function rowOf(z)     { return Math.max(0, Math.min(ROWS - 1, Math.floor((z - minZ) / CELL_SIZE))) }
function cellX(c)     { return minX + c * CELL_SIZE + CELL_SIZE * 0.5 }
function cellZ(r)     { return minZ + r * CELL_SIZE + CELL_SIZE * 0.5 }

// Uint8Array: 0 = bloqueado, 1 = livre
const WALKABLE = new Uint8Array(TOTAL)
;(function buildWalkable() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = cellX(c)
      const cz = cellZ(r)
      let free = true
      for (let o = 0; o < NPC_OBSTACLES.length; o++) {
        const obs = NPC_OBSTACLES[o]
        const dx = cx - obs.x, dz = cz - obs.z
        if (dx * dx + dz * dz < (obs.r + NPC_MARGIN) ** 2) { free = false; break }
      }
      WALKABLE[toIdx(c, r)] = free ? 1 : 0
    }
  }
})()

// ---------- nearestWalkable ----------
export function nearestWalkable(x, z) {
  const bc = colOf(x), br = rowOf(z)
  if (WALKABLE[toIdx(bc, br)]) return { x: cellX(bc), z: cellZ(br) }
  for (let rad = 1; rad <= 10; rad++) {
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad; dr <= rad; dr++) {
        if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue
        const c = bc + dc, r = br + dr
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue
        if (WALKABLE[toIdx(c, r)]) return { x: cellX(c), z: cellZ(r) }
      }
    }
  }
  return { x, z }
}

// ---------- Min-heap binario ----------
// Armazena { key, f } — key = toIdx(c,r)
function heapPush(heap, key, f) {
  heap.push({ key, f })
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent].f <= heap[i].f) break
    const tmp = heap[parent]; heap[parent] = heap[i]; heap[i] = tmp
    i = parent
  }
}

function heapPop(heap) {
  const top = heap[0]
  const last = heap.pop()
  if (heap.length > 0) {
    heap[0] = last
    let i = 0
    for (;;) {
      const l = 2 * i + 1, r = 2 * i + 2
      let s = i
      if (l < heap.length && heap[l].f < heap[s].f) s = l
      if (r < heap.length && heap[r].f < heap[s].f) s = r
      if (s === i) break
      const tmp = heap[s]; heap[s] = heap[i]; heap[i] = tmp
      i = s
    }
  }
  return top
}

// ---------- Buffers reutilizaveis (evita alocar Maps a cada findPath) ----------
const gBuf    = new Float32Array(TOTAL)  // g-score; Infinity = nao visitado
const fBuf    = new Float32Array(TOTAL)  // f-score
const cameFrom = new Int32Array(TOTAL)   // indice do predecessor (-1 = nenhum)
let   epoch   = 0                        // incrementado a cada findPath para "zerar" buffers
const visitedEpoch = new Uint32Array(TOTAL) // guarda o epoch em que o no foi inicializado

// 8 direcoes precomputadas: [dc, dr, custo]
const D1 = 1, D2 = Math.SQRT2
const DIRS = [
  1, 0, D1,   -1, 0, D1,   0, 1, D1,   0, -1, D1,
  1, 1, D2,   1,-1, D2,   -1, 1, D2,   -1,-1, D2,
]

function h(c, r, gc, gr) {
  const dc = Math.abs(gc - c), dr = Math.abs(gr - r)
  return dc + dr + (D2 - 2) * Math.min(dc, dr)
}

function getG(idx) {
  return visitedEpoch[idx] === epoch ? gBuf[idx] : Infinity
}

function initNode(idx, g, f, from) {
  visitedEpoch[idx] = epoch
  gBuf[idx] = g
  fBuf[idx] = f
  cameFrom[idx] = from
}

// ---------- A* ----------
function astar(c0, r0, c1, r1) {
  epoch++
  if (epoch > 0xFFFFFFFE) epoch = 1  // evita overflow (improvavel)

  const startIdx = toIdx(c0, r0)
  const goalIdx  = toIdx(c1, r1)

  initNode(startIdx, 0, h(c0, r0, c1, r1), -1)

  const heap = []
  heapPush(heap, startIdx, h(c0, r0, c1, r1))

  while (heap.length > 0) {
    const { key: curIdx } = heapPop(heap)

    if (curIdx === goalIdx) {
      // Reconstroi o caminho
      const path = []
      let k = goalIdx
      while (k !== startIdx) {
        const c = k % COLS, r = (k / COLS) | 0
        path.push({ x: cellX(c), z: cellZ(r) })
        k = cameFrom[k]
      }
      path.reverse()
      return path
    }

    const curG = getG(curIdx)
    const cc = curIdx % COLS
    const cr = (curIdx / COLS) | 0

    for (let d = 0; d < 24; d += 3) {
      const dc = DIRS[d], dr = DIRS[d + 1], cost = DIRS[d + 2]
      const nc = cc + dc, nr = cr + dr
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue
      const nIdx = toIdx(nc, nr)
      if (!WALKABLE[nIdx]) continue

      // Sem corte de quina
      if (dc !== 0 && dr !== 0) {
        if (!WALKABLE[toIdx(cc + dc, cr)] || !WALKABLE[toIdx(cc, cr + dr)]) continue
      }

      const tentG = curG + cost
      if (tentG < getG(nIdx)) {
        initNode(nIdx, tentG, tentG + h(nc, nr, c1, r1), curIdx)
        heapPush(heap, nIdx, tentG + h(nc, nr, c1, r1))
      }
    }
  }
  return null
}

// ---------- String pulling ----------
function segmentFree(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0
  const len = Math.hypot(dx, dz)
  if (len < 1e-4) return true
  const invLen = 1 / len
  const udx = dx * invLen, udz = dz * invLen
  const steps = Math.ceil(len / SAMPLE_STEP)
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * len
    const x = x0 + udx * t, z = z0 + udz * t
    for (let o = 0; o < NPC_OBSTACLES.length; o++) {
      const obs = NPC_OBSTACLES[o]
      const ex = x - obs.x, ez = z - obs.z
      if (ex * ex + ez * ez < (obs.r + NPC_MARGIN) ** 2) return false
    }
  }
  return true
}

/**
 * String pulling classico (Funnel simplificado por visibilidade):
 * Percorre o caminho do fim para o inicio, pula pontos visiveis a partir
 * do ultimo ancora confirmado.
 */
function smooth(points, sx, sz) {
  const n = points.length
  if (n === 0) return points

  const result = []
  let anchorX = sx, anchorZ = sz
  let i = 0

  while (i < n) {
    // Encontra o ponto mais distante ainda visivel a partir da ancora
    let last = i
    for (let j = i; j < n; j++) {
      if (segmentFree(anchorX, anchorZ, points[j].x, points[j].z)) {
        last = j
      } else {
        break
      }
    }
    result.push(points[last])
    anchorX = points[last].x
    anchorZ = points[last].z
    i = last + 1
  }
  return result
}

// ---------- API publica ----------
export function findPath(x0, z0, x1, z1) {
  const c0 = colOf(x0), r0 = rowOf(z0)
  const c1 = colOf(x1), r1 = rowOf(z1)

  // Se a celula de origem ou destino estiver bloqueada, usa a mais proxima livre
  let sc = c0, sr = r0
  if (!WALKABLE[toIdx(sc, sr)]) {
    const p = nearestWalkable(x0, z0)
    sc = colOf(p.x); sr = rowOf(p.z)
  }
  let gc = c1, gr = r1
  if (!WALKABLE[toIdx(gc, gr)]) {
    const p = nearestWalkable(x1, z1)
    gc = colOf(p.x); gr = rowOf(p.z)
  }

  if (sc === gc && sr === gr) return [{ x: x1, z: z1 }]

  const raw = astar(sc, sr, gc, gr)
  if (!raw || raw.length === 0) return null

  return smooth(raw, x0, z0)
}
