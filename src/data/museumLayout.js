import artworksData from './artworks.json'

/**
 * Layout do museu em um unico lugar.
 *
 * MuseumEnvironment desenha a partir daqui, e os NPCs usam a mesma lista de
 * obstaculos e os mesmos pontos de observacao. Assim cenario e IA nunca
 * saem de sincronia.
 */

// ---------- Dimensoes da sala (metros) ----------
export const ROOM = {
  width: 28, // eixo X: de -14 a 14
  depth: 38, // eixo Z: de -19 a 19
  height: 8,
  wallThickness: 0.4,
}
export const HALF_W = ROOM.width / 2
export const HALF_D = ROOM.depth / 2

// ---------- Estrutura ----------
export const PILLAR_POSITIONS = [
  [-9, -12], [-9, -4], [-9, 4], [-9, 12],
  [9, -12], [9, -4], [9, 4], [9, 12],
]

export const BENCH_POSITIONS = [
  { pos: [0, 0, -8], rotY: 0 },
  { pos: [0, 0, 2], rotY: 0 },
  { pos: [0, 0, 12], rotY: 0 },
]

// ---------- Canteiros ajardinados ----------
export const BED_HEIGHT = 0.45

export const GARDEN_BEDS = [
  { id: 'bed-nw', pos: [-4.6, -6], size: [3.2, 3.2], seed: 11 },
  { id: 'bed-ne', pos: [4.6, -6], size: [3.2, 3.2], seed: 27 },
  { id: 'bed-sw', pos: [-4.6, 6], size: [3.2, 3.2], seed: 43 },
  { id: 'bed-se', pos: [4.6, 6], size: [3.2, 3.2], seed: 59 },
  { id: 'bed-c1', pos: [-11.5, -16.5], size: [2.6, 2.6], seed: 71 },
  { id: 'bed-c2', pos: [11.5, -16.5], size: [2.6, 2.6], seed: 83 },
  { id: 'bed-c3', pos: [-11.5, 16.5], size: [2.6, 2.6], seed: 97 },
  { id: 'bed-c4', pos: [11.5, 16.5], size: [2.6, 2.6], seed: 109 },
]

// Vasos ao lado dos bancos (ficam dentro do raio de desvio do proprio banco)
export const POTS = BENCH_POSITIONS.flatMap((b, i) =>
  [-1, 1].map((side) => ({
    id: `pot-${i}-${side}`,
    pos: [b.pos[0] + side * 1.65, b.pos[2]],
  }))
)

// ---------- Portas da entrada (parede sul) ----------
// Fonte unica de verdade: a geometria da parede, as folhas de vidro e a
// navegacao dos NPCs derivam daqui. Antes cada arquivo tinha a sua propria
// copia dessas medidas e elas acabaram divergindo, deixando a folha enterrada
// na alvenaria.
export const DOORS = {
  centers: [-3.5, 3.5], // centro de cada abertura em X
  width: 2.1,           // vao livre (duas folhas de 1.05)
  height: 2.3,          // do piso ate a verga
}
export const DOOR_HALF = DOORS.width / 2

/** [inicio, fim] em X de cada abertura. */
export const DOOR_SPANS = DOORS.centers.map((cx) => [cx - DOOR_HALF, cx + DOOR_HALF])

// ---------- Fachada de vidro (parede sul) ----------
// O painel central sustenta a obra da parede sul; as baias de vidro ocupam o
// que sobra entre a abertura mais externa e o canto da sala.
const CENTER_HALF = Math.min(...DOORS.centers.map(Math.abs)) - DOOR_HALF // 2.45
const BAY_START = Math.max(...DOORS.centers) + DOOR_HALF                 // 4.55

export const FACADE = {
  centerPanelWidth: CENTER_HALF * 2,        // 4.9 -> [-2.45, 2.45]
  bayCenter: (BAY_START + HALF_W) / 2,      // 9.275
  bayWidth: HALF_W - BAY_START,             // 9.45 -> [4.55, 14]
  mullions: [5.75, 8.5, 11.25],             // dentro da baia
}

// ---------- Obstaculos para a navegacao dos NPCs ----------
// Circulos simples: e o suficiente para o desvio tangencial usado no NPC.
// Raios ajustados para respeitar todos os objetos fisicos da cena:
//   Pilar   1.0 x 1.0 m  -> raio de desvio 0.85 m (NPC passa rente mas nao encosta)
//   Banco   2.4 x 0.8 m  -> modelado como dois obstaculos (centro + vasos laterais)
//             raio do banco reduzido para 0.65 para nao bloquear o corredor inteiro
//   Vaso    r=0.3 m       -> obstaculo proprio, raio de desvio 0.65 m
//   Canteiro: raio amplo para evitar que NPCs cortam pelos canteiros
export const NPC_OBSTACLES = [
  // Pilares
  ...PILLAR_POSITIONS.map(([x, z]) => ({ x, z, r: 0.85 })),

  // Bancos (apenas o corpo central — vasos sao obstaculos separados abaixo)
  ...BENCH_POSITIONS.map((b) => ({ x: b.pos[0], z: b.pos[2], r: 1.65 })),

  // Vasos ao lado dos bancos (pos: [benchX ± 1.65, benchZ])
  ...POTS.map((p) => ({ x: p.pos[0], z: p.pos[1], r: 0.65 })),

  // Canteiros ajardinados
  ...GARDEN_BEDS.map((b) => ({
    x: b.pos[0],
    z: b.pos[1],
    r: Math.max(b.size[0], b.size[1]) * 0.62 + 0.45,
  })),
]

// Limites de caminhada (recuo das paredes)
export const WALK_BOUNDS = {
  minX: -HALF_W + 1.2,
  maxX: HALF_W - 1.2,
  minZ: -HALF_D + 1.2,
  maxZ: HALF_D - 1.2,
}

// ---------- Pontos de observacao das obras ----------
// Derivados do artworks.json: normal da parede = [sin(ry), cos(ry)].
// Duas vagas por obra -> no maximo 2 NPCs analisando a mesma arte ao mesmo tempo.
const VIEW_DISTANCE = 3
const SLOT_OFFSET = 1

export const ART_VIEWING_SPOTS = (artworksData.artworks || []).flatMap((art) => {
  const ry = art.rotation?.[1] ?? 0
  const nx = Math.sin(ry)
  const nz = Math.cos(ry)
  const tx = Math.cos(ry)
  const tz = -Math.sin(ry)
  const [ax, , az] = art.position

  return [-1, 1].map((side) => ({
    key: `${art.id}::${side}`,
    artId: art.id,
    x: ax + nx * VIEW_DISTANCE + tx * SLOT_OFFSET * side,
    z: az + nz * VIEW_DISTANCE + tz * SLOT_OFFSET * side,
    look: [ax, 2.2, az],
  }))
})

// Pontos de descanso: usados quando todas as vagas de obra estao ocupadas.
export const IDLE_SPOTS = [
  [-7, 0], [7, 0], [-7, 10], [7, -10],
  [0, 6], [0, -3], [-11, 8], [11, -3],
  [-7, -16], [7, 16],
]

// ---------- Elenco de visitantes ----------
export const NPC_ROSTER = [
  {
    id: 'npc-1', position: [-7, 0, 14], scale: 1.0, outfit: 'shirt',
    appearance: { skin: '#c4a484', hair: '#2c1b10', shirt: '#4a6fa5', pants: '#3a3f4a', shoes: '#1f1f1f' },
  },
  {
    id: 'npc-2', position: [7, 0, 14], scale: 0.94, outfit: 'dress',
    appearance: { skin: '#8d5a3b', hair: '#151515', shirt: '#a8574a', pants: '#a8574a', shoes: '#2b2420' },
  },
  {
    id: 'npc-3', position: [-7, 0, -14], scale: 1.03, outfit: 'coat',
    appearance: { skin: '#e0bb96', hair: '#6b4423', shirt: '#5c6b4a', pants: '#2f3340', shoes: '#222222' },
  },
  {
    id: 'npc-4', position: [7, 0, -14], scale: 0.97, outfit: 'shirt',
    appearance: { skin: '#a9714b', hair: '#241a12', shirt: '#d8cfc0', pants: '#44506b', shoes: '#1a1a1a' },
  },
  {
    id: 'npc-5', position: [-11, 0, 0], scale: 1.05, outfit: 'shirt',
    appearance: { skin: '#f0d0b0', hair: '#8a6a3f', shirt: '#7a5c8f', pants: '#33383f', shoes: '#2b2b2b' },
  },
  {
    id: 'npc-6', position: [11, 0, 0], scale: 0.92, outfit: 'dress',
    appearance: { skin: '#6f4526', hair: '#101010', shirt: '#4f8073', pants: '#4f8073', shoes: '#26201c' },
  },
  {
    id: 'npc-7', position: [-2, 0, 10], scale: 1.0, outfit: 'coat',
    appearance: { skin: '#d2a679', hair: '#3d2b1f', shirt: '#2f4858', pants: '#3b3b42', shoes: '#191919' },
  },
  {
    id: 'npc-8', position: [2, 0, -2], scale: 0.99, outfit: 'shirt',
    appearance: { skin: '#bb8a63', hair: '#4a3520', shirt: '#c2703d', pants: '#3f4550', shoes: '#232323' },
  },
  {
    id: 'npc-9', position: [-6, 0, 0], scale: 1.02, outfit: 'shirt',
    appearance: { skin: '#9c6a45', hair: '#1c1c1c', shirt: '#5b6c8c', pants: '#2c2f36', shoes: '#1d1d1d' },
  },
  {
    id: 'npc-10', position: [6, 0, -12], scale: 0.95, outfit: 'dress',
    appearance: { skin: '#e6c6a2', hair: '#a06a35', shirt: '#8c6f9e', pants: '#8c6f9e', shoes: '#2a2a2a' },
  },
]

// ---------- Vegetacao (gerada de forma deterministica) ----------
function makeRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const CANOPY_COLORS = ['#4f7a3a', '#5c8a44', '#426b34', '#6b9450', '#3d6b3f']
const TRUNK_COLORS = ['#6b4c31', '#5a3f28', '#75563a']
const SHRUB_COLORS = ['#5b8a45', '#4a7539', '#6d9b52']
const FLOWER_COLORS = ['#d97b6c', '#e0b04a', '#c96fa0', '#e8e0d2']

function makeTree({ x, z, baseY, height, seed }) {
  const rand = makeRandom(seed)
  const trunkHeight = height * 0.52
  const canopyRadius = height * 0.27

  const trunk = {
    key: `trunk-${x.toFixed(2)}-${z.toFixed(2)}-${seed}`,
    position: [x, baseY + trunkHeight / 2, z],
    scale: [height * 0.3, trunkHeight, height * 0.3],
    color: TRUNK_COLORS[Math.floor(rand() * TRUNK_COLORS.length)],
  }

  const canopy = []
  for (let i = 0; i < 3; i += 1) {
    const angle = rand() * Math.PI * 2
    const offset = canopyRadius * 0.45 * rand()
    const radius = canopyRadius * (0.62 + rand() * 0.34)
    canopy.push({
      key: `${trunk.key}-c${i}`,
      position: [
        x + Math.cos(angle) * offset,
        baseY + trunkHeight + canopyRadius * (0.45 + i * 0.4),
        z + Math.sin(angle) * offset,
      ],
      scale: [radius * (1 + rand() * 0.18), radius * (0.82 + rand() * 0.26), radius * (1 + rand() * 0.18)],
      rotation: [rand() * 0.6, rand() * Math.PI, rand() * 0.6],
      color: CANOPY_COLORS[Math.floor(rand() * CANOPY_COLORS.length)],
    })
  }

  return { trunk, canopy }
}

function buildIndoorVegetation() {
  const trunks = []
  const canopy = []
  const shrubs = []

  GARDEN_BEDS.forEach((bed) => {
    const rand = makeRandom(bed.seed)
    const [bx, bz] = bed.pos
    const large = bed.size[0] > 3
    const height = large ? 3.4 + rand() * 1.0 : 2.4 + rand() * 0.6

    const tree = makeTree({
      x: bx + (rand() - 0.5) * 0.4,
      z: bz + (rand() - 0.5) * 0.4,
      baseY: BED_HEIGHT,
      height,
      seed: bed.seed,
    })
    trunks.push(tree.trunk)
    canopy.push(...tree.canopy)

    const count = large ? 5 : 3
    const spread = bed.size[0] * 0.32
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + rand()
      const radius = 0.24 + rand() * 0.18
      const flower = rand() > 0.68
      shrubs.push({
        key: `${bed.id}-s${i}`,
        position: [
          bx + Math.cos(angle) * spread,
          BED_HEIGHT + radius * (flower ? 0.5 : 0.72),
          bz + Math.sin(angle) * spread,
        ],
        scale: flower ? [radius * 0.5, radius * 0.5, radius * 0.5] : [radius, radius * 0.8, radius],
        color: flower
          ? FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)]
          : SHRUB_COLORS[Math.floor(rand() * SHRUB_COLORS.length)],
      })
    }
  })

  return { trunks, canopy, shrubs }
}

function buildOutdoorVegetation() {
  const rand = makeRandom(2024)
  const trunks = []
  const canopy = []
  const shrubs = []

  const plant = (x, z) => {
    const height = 4.5 + rand() * 4.5
    const tree = makeTree({ x, z, baseY: 0, height, seed: Math.floor(rand() * 100000) + 3 })
    trunks.push(tree.trunk)
    canopy.push(...tree.canopy)
  }

  // Arvores espalhadas por todo o terreno
  let placed = 0
  let guard = 0
  while (placed < 26 && guard < 400) {
    guard += 1
    const x = (rand() - 0.5) * 110
    const z = (rand() - 0.5) * 110

    // Fora da area construida (a sala ocupa 28 x 38 no centro)
    if (Math.abs(x) < HALF_W + 4 && Math.abs(z) < HALF_D + 4) continue
    if (Math.hypot(x, z) > 58) continue

    plant(x, z)
    placed += 1
  }

  // Bosque adensado em frente a fachada de vidro, que e a vista principal
  for (let i = 0; i < 16; i += 1) {
    const x = -28 + (i / 15) * 56 + (rand() - 0.5) * 5
    const z = HALF_D + 6 + rand() * 16
    plant(x, z)
  }

  // Arbustos junto da fachada de vidro, para dar profundidade ao jardim
  for (let i = 0; i < 22; i += 1) {
    const x = -13 + (i / 21) * 26 + (rand() - 0.5) * 1.4
    const z = HALF_D + 2.6 + rand() * 2.4
    const radius = 0.5 + rand() * 0.45
    shrubs.push({
      key: `hedge-${i}`,
      position: [x, radius * 0.7, z],
      scale: [radius, radius * 0.78, radius],
      color: SHRUB_COLORS[Math.floor(rand() * SHRUB_COLORS.length)],
    })
  }

  return { trunks, canopy, shrubs }
}

export const INDOOR_VEGETATION = buildIndoorVegetation()
export const OUTDOOR_VEGETATION = buildOutdoorVegetation()
