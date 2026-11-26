import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { FRAME_DEPTH } from './FrameBorder'

/** Perto o bastante para ler a plaquinha, e um pouco além do alcance do E. */
const NEAR_DISTANCE = 4

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * Plaquinha sob o quadro. O Html do drei aplica scale() no elemento absoluto.
 * Sem largura explícita, o shrink-to-fit cai na palavra mais longa e o título
 * empilha uma palavra por linha. inline-block + max-content segura a largura
 * em px, antes do scale, então o tamanho não muda com a tela nem com o DPR.
 */
export default function ArtworkTitlePlate({ meshRef, width, height, title, author, enabled = true, children }) {
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  const pos = useRef(new THREE.Vector3())

  useFrame(({ camera }) => {
    const mesh = meshRef?.current
    if (!mesh || !enabled) {
      if (nearRef.current) {
        nearRef.current = false
        setNear(false)
      }
      return
    }
    mesh.getWorldPosition(pos.current)
    const next = camera.position.distanceTo(pos.current) < NEAR_DISTANCE
    if (next !== nearRef.current) {
      nearRef.current = next
      setNear(next)
    }
  })

  if (!enabled || !near) return null

  const label = oneLine(title) || 'Obra'
  const by = oneLine(author)

  return (
    <Html
      position={[0, -height / 2 - 0.32, FRAME_DEPTH + 0.02]}
      distanceFactor={10}
      zIndexRange={[30, 0]}
      pointerEvents="none"
      style={{ pointerEvents: 'none' }}
    >
      {/* O scale do drei fica no pai e a origem é o canto. Este deslocamento
          centraliza a plaquinha no ponto do quadro. */}
      <div style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
        <div
          style={{
            display: 'inline-block',
            boxSizing: 'border-box',
            width: 'max-content',
            minWidth: '160px',
            maxWidth: '340px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.78)',
            color: 'white',
            textAlign: 'center',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: '13px',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              wordBreak: 'keep-all',
              overflowWrap: 'normal',
            }}
          >
            {label}
          </div>
          {by ? (
            <div
              style={{
                marginTop: '2px',
                opacity: 0.8,
                fontSize: '11px',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
              }}
            >
              {by}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </Html>
  )
}
