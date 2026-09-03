/**
 * Parking: estacionamento externo em frente ao museu.
 *
 * Fica ao sul da fachada de vidro (z > HALF_D). Layout:
 *   - Calcada de concreto entre a fachada e o estacionamento (~3 m)
 *   - Duas fileiras de vagas separadas por uma faixa central de acesso
 *   - Carros procedurais simples (corpo + janelas + rodas)
 *   - Faixas de demarcacao pintadas no asfalto
 *   - Algumas arvores / canteiros nas bordas
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { HALF_D } from '../data/museumLayout'

// ---------- Medidas ----------
const SIDEWALK_Z  = HALF_D + 0.02       // inicio da calcada (rente a parede sul)
const SIDEWALK_D  = 3.8                 // profundidade da calcada
const LOT_Z       = SIDEWALK_Z + SIDEWALK_D  // inicio do asfalto
const LOT_D       = 22                  // profundidade do lote
const LOT_W       = 30                  // largura do lote
const LANE_W      = 6.5                 // faixa central de acesso (entre fileiras)
const SPOT_W      = 2.6                 // largura de uma vaga
const SPOT_D      = 5.2                 // profundidade de uma vaga
const SPOTS_PER_ROW = 5                 // vagas por fileira

// ---------- Materiais ----------
const asphaltMat  = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 1 })
const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#c8c2b8', roughness: 0.95 })
const lineMat     = new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 1 })
const curb        = new THREE.MeshStandardMaterial({ color: '#b0a898', roughness: 0.9 })

// Cores dos carros
const CAR_COLORS = [
  '#c0392b', '#2471a3', '#1e8449', '#d4ac0d', '#7d3c98',
  '#1a1a1a', '#f0f0f0', '#e67e22', '#2e4057', '#a04000',
  '#95a5a6', '#5d6d7e', '#c0392b', '#148f77', '#283747',
]

function makeRandom(seed) {
  let s = (seed * 1664525 + 1013904223) & 0xffffffff
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return ((s >>> 0) / 0xffffffff)
  }
}

// Geometrias dos carros (compartilhadas)
const bodyGeo    = new THREE.BoxGeometry(1.8, 0.72, 4.0)
const cabinGeo   = new THREE.BoxGeometry(1.6, 0.6,  2.4)
const windowMat  = new THREE.MeshStandardMaterial({ color: '#4a8eb5', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.7 })
const wheelGeo   = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14)
const wheelMat   = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 })
const hubGeo     = new THREE.CylinderGeometry(0.14, 0.14, 0.23, 10)
const hubMat     = new THREE.MeshStandardMaterial({ color: '#aaaaaa', roughness: 0.4, metalness: 0.6 })

function Car({ x, z, rotY, colorIndex, rand }) {
  const bodyColor = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CAR_COLORS[colorIndex % CAR_COLORS.length], roughness: 0.35, metalness: 0.25 }),
    [colorIndex]
  )
  const cabinOffset = 0.1 + rand() * 0.3 // varia a posicao do teto
  return (
    <group position={[x, 0.36, z]} rotation={[0, rotY, 0]}>
      {/* Corpo */}
      <mesh geometry={bodyGeo} material={bodyColor} castShadow receiveShadow />
      {/* Cabine / teto */}
      <mesh geometry={cabinGeo} material={bodyColor} position={[0, 0.66, -cabinOffset]} castShadow />
      {/* Janelas (para-brisa frontal e traseiro, simplificados) */}
      <mesh position={[0, 0.66, -cabinOffset + 1.18]} rotation={[0.22, 0, 0]}>
        <planeGeometry args={[1.5, 0.52]} />
        <primitive object={windowMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.66, -cabinOffset - 1.18]} rotation={[-0.22, 0, 0]}>
        <planeGeometry args={[1.5, 0.52]} />
        <primitive object={windowMat} attach="material" />
      </mesh>
      {/* Rodas (4): rotacionadas 90 graus no eixo Z para parecer laterais */}
      {[[-0.92, -0.24, 1.4], [0.92, -0.24, 1.4], [-0.92, -0.24, -1.4], [0.92, -0.24, -1.4]].map(([wx, wy, wz], i) => (
        <group key={i} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
          <mesh geometry={wheelGeo} material={wheelMat} />
          <mesh geometry={hubGeo} material={hubMat} />
        </group>
      ))}
    </group>
  )
}

// Geometria das faixas de demarcacao (reutilizada)
const stripeGeo = new THREE.PlaneGeometry(0.12, SPOT_D - 0.2)

export default function Parking() {
  const rand = useMemo(() => makeRandom(4242), [])

  // Gera layout das vagas: 2 fileiras (norte e sul do lote), 5 vagas cada
  const rows = useMemo(() => {
    const r = makeRandom(7777)
    const result = []

    // Fileira norte (proxima a calcada): carros apontam para o sul (rotY = 0)
    const rowNorthZ = LOT_Z + SPOT_D / 2 + 0.5
    // Fileira sul: carros apontam para o norte (rotY = Math.PI)
    const rowSouthZ = LOT_Z + SPOT_D * 1.5 + LANE_W + 0.5

    const startX = -(SPOTS_PER_ROW * SPOT_W) / 2 + SPOT_W / 2

    for (let i = 0; i < SPOTS_PER_ROW; i++) {
      const x = startX + i * SPOT_W
      const occupied = r() > 0.32 // ~68% das vagas ocupadas
      result.push({
        x, zRow: rowNorthZ, rotY: 0, occupied,
        colorIdx: Math.floor(r() * CAR_COLORS.length),
        rand: makeRandom(i * 100 + 1),
      })
      const occ2 = r() > 0.28
      result.push({
        x, zRow: rowSouthZ, rotY: Math.PI, occupied: occ2,
        colorIdx: Math.floor(r() * CAR_COLORS.length),
        rand: makeRandom(i * 100 + 51),
      })
    }
    return result
  }, [])

  const stripeXPositions = useMemo(() => {
    const xs = []
    const startX = -(SPOTS_PER_ROW * SPOT_W) / 2
    for (let i = 0; i <= SPOTS_PER_ROW; i++) xs.push(startX + i * SPOT_W)
    return xs
  }, [])

  return (
    <group>
      {/* ---- Calcada ---- */}
      <mesh
        material={sidewalkMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, SIDEWALK_Z + SIDEWALK_D / 2]}
        receiveShadow
      >
        <planeGeometry args={[LOT_W, SIDEWALK_D]} />
      </mesh>
      {/* Meio-fio */}
      <mesh material={curb} position={[0, 0.08, LOT_Z - 0.1]}>
        <boxGeometry args={[LOT_W, 0.14, 0.2]} />
      </mesh>

      {/* ---- Asfalto ---- */}
      <mesh
        material={asphaltMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, LOT_Z + LOT_D / 2]}
        receiveShadow
      >
        <planeGeometry args={[LOT_W, LOT_D]} />
      </mesh>

      {/* ---- Faixas de demarcacao norte ---- */}
      {stripeXPositions.map((sx, i) => (
        <mesh
          key={`sn-${i}`}
          geometry={stripeGeo}
          material={lineMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[sx, 0.03, LOT_Z + SPOT_D / 2 + 0.5]}
        />
      ))}
      {/* ---- Faixas demarcacao sul ---- */}
      {stripeXPositions.map((sx, i) => (
        <mesh
          key={`ss-${i}`}
          geometry={stripeGeo}
          material={lineMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[sx, 0.03, LOT_Z + SPOT_D * 1.5 + LANE_W + 0.5]}
        />
      ))}

      {/* ---- Faixa de acesso central (seta de sentido) ---- */}
      <mesh
        material={lineMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, LOT_Z + SPOT_D + LANE_W / 2 + 0.5]}
      >
        <planeGeometry args={[0.3, LANE_W - 1]} />
      </mesh>

      {/* ---- Carros ---- */}
      {rows.map((row, i) =>
        row.occupied ? (
          <Car
            key={i}
            x={row.x}
            z={row.zRow}
            rotY={row.rotY}
            colorIndex={row.colorIdx}
            rand={row.rand}
          />
        ) : null
      )}

      {/* ---- Canteiros nas bordas do estacionamento ---- */}
      {[[-LOT_W / 2 + 1, LOT_Z + LOT_D / 2], [LOT_W / 2 - 1, LOT_Z + LOT_D / 2]].map(([bx, bz], i) => (
        <group key={`pb-${i}`}>
          <mesh material={sidewalkMat} position={[bx, 0.15, bz]}>
            <boxGeometry args={[1.8, 0.3, LOT_D - 1]} />
          </mesh>
          <mesh
            material={new THREE.MeshStandardMaterial({ color: '#5f8a4a', roughness: 1 })}
            position={[bx, 0.31, bz]}
          >
            <boxGeometry args={[1.6, 0.08, LOT_D - 1.4]} />
          </mesh>
        </group>
      ))}

      {/* ---- Muro / guard-rail no fundo ---- */}
      <mesh material={sidewalkMat} position={[0, 0.4, LOT_Z + LOT_D + 0.15]}>
        <boxGeometry args={[LOT_W, 0.8, 0.3]} />
      </mesh>
    </group>
  )
}
