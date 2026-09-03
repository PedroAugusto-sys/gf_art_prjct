import { useRef } from 'react'
import { useGameStore } from '../store'

const JOYSTICK_RADIUS = 60 // raio maximo do knob em pixels

/**
 * VirtualControls: overlay HTML de controles para MOBILE.
 *  - Esquerda: joystick virtual (andar). Escreve store.movement {x, y} em [-1, 1].
 *  - Direita: area de "olhar". Cada arraste do dedo acumula store.look (consumido pelo Player).
 *
 * Renderizado FORA do <Canvas> (e um overlay DOM). Usa Pointer Events, que unificam
 * mouse/touch/caneta. O container e pointer-events:none; apenas as duas zonas capturam toque.
 */
export default function VirtualControls() {
  const setMovement = useGameStore((s) => s.setMovement)
  const addLook = useGameStore((s) => s.addLook)

  // ----- Joystick -----
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const joyId = useRef(null)
  const center = useRef({ x: 0, y: 0 })

  const onJoyDown = (e) => {
    const rect = baseRef.current.getBoundingClientRect()
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    joyId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    updateJoy(e.clientX, e.clientY)
  }
  const onJoyMove = (e) => {
    if (joyId.current !== e.pointerId) return
    updateJoy(e.clientX, e.clientY)
  }
  const onJoyUp = (e) => {
    if (joyId.current !== e.pointerId) return
    joyId.current = null
    setMovement(0, 0)
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
  }
  const updateJoy = (clientX, clientY) => {
    let dx = clientX - center.current.x
    let dy = clientY - center.current.y
    const dist = Math.hypot(dx, dy)
    if (dist > JOYSTICK_RADIUS) {
      const k = JOYSTICK_RADIUS / dist
      dx *= k
      dy *= k
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    // Normaliza para [-1, 1]. Inverte Y para que "para cima" = frente.
    setMovement(dx / JOYSTICK_RADIUS, -dy / JOYSTICK_RADIUS)
  }

  // ----- Area de olhar (direita) -----
  const lookId = useRef(null)
  const lastLook = useRef({ x: 0, y: 0 })

  const onLookDown = (e) => {
    lookId.current = e.pointerId
    lastLook.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onLookMove = (e) => {
    if (lookId.current !== e.pointerId) return
    const dx = e.clientX - lastLook.current.x
    const dy = e.clientY - lastLook.current.y
    lastLook.current = { x: e.clientX, y: e.clientY }
    addLook(dx, dy)
  }
  const onLookUp = (e) => {
    if (lookId.current !== e.pointerId) return
    lookId.current = null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* Zona de olhar: metade direita da tela */}
      <div
        className="pointer-events-auto absolute right-0 top-0 h-full w-1/2"
        style={{ touchAction: 'none' }}
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      {/* Joystick: canto inferior esquerdo */}
      <div
        ref={baseRef}
        className="pointer-events-auto absolute bottom-10 left-8 flex items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm"
        style={{ width: 140, height: 140, touchAction: 'none' }}
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
      >
        <div
          ref={knobRef}
          className="rounded-full bg-white/70 shadow-lg"
          style={{ width: 64, height: 64, transition: 'transform 0.02s linear' }}
        />
      </div>
    </div>
  )
}
