import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { playerPosRef } from '../systems/proximityRefs'
import { publishPose, isMultiplayerConnected, POSE_INTERVAL_MS } from '../systems/multiplayer'

// ---------- Constantes de locomocao ----------
const WALK_SPEED = 5 // metros/segundo
const EYE_HEIGHT = 0.8 // deslocamento da camera acima do centro da capsula
const LOOK_SENSITIVITY = 0.0025 // sensibilidade do arraste (mobile)
const PITCH_LIMIT = Math.PI / 2 - 0.1 // trava o olhar para cima/baixo

// ---------- Limites do mundo (fora daqui e vazio infinito) ----------
// A sala tem 28 x 38; acrescentamos margem para o jardim/estacionamento externos.
const WORLD_BOUNDS = { minX: -50, maxX: 50, minZ: -30, maxZ: 60 }
const SPAWN_POS = { x: 0, y: 2, z: 12 } // posicao inicial padrao

// Vetores reutilizados (evita alocar objetos a cada frame -> melhor GC/performance)
const frontVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()
const direction = new THREE.Vector3()
const worldUp = new THREE.Vector3(0, 1, 0)
const camEuler = new THREE.Euler()

/**
 * Player: corpo fisico em primeira pessoa.
 *
 * Estrategia: RigidBody DINAMICO com rotacoes travadas + CapsuleCollider.
 * - Colisoes com paredes/pilares sao resolvidas automaticamente pelo Rapier.
 * - A gravidade (definida em <Physics>) mantem o jogador no chao.
 * - A cada frame definimos a velocidade horizontal (setLinvel) a partir da entrada,
 *   preservando a componente Y (gravidade/pulos futuros).
 *
 * Movimento: W/S no look da camera (XZ), A/D no vetor direito — padrao FPS.
 *
 * Look:
 * - Desktop: <PointerLockControls> controla a camera diretamente com o mouse.
 * - Mobile: aplicamos yaw/pitch manualmente a partir do arraste do dedo (store.look).
 */
export default function Player({ position = [0, 2, 12] }) {
  const bodyRef = useRef(null)
  const controlsRef = useRef(null)
  const { camera, gl } = useThree()

  const isMobile = useGameStore((s) => s.isMobile)

  // Estado de teclado guardado em ref (nao precisa re-renderizar)
  const keys = useRef({ forward: false, backward: false, left: false, right: false })

  // ---------- Reset de posicao ----------
  const resetPosition = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    body.setTranslation({ x: SPAWN_POS.x, y: SPAWN_POS.y, z: SPAWN_POS.z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }, [])

  // Angulos de camera para o modo mobile (yaw = horizontal, pitch = vertical)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const lastPosePub = useRef(0)
  const wasMoving = useRef(false)

  // ---------- Teclado (apenas desktop) ----------
  useEffect(() => {
    if (isMobile) return
    const map = {
      KeyW: 'forward',
      ArrowUp: 'forward',
      KeyS: 'backward',
      ArrowDown: 'backward',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
    }
    const onKeyDown = (e) => {
      // Tecla R: reseta posicao do jogador
      if (e.code === 'KeyR') { resetPosition(); return }
      const action = map[e.code]
      if (action) { keys.current[action] = true; e.preventDefault() }
    }
    const onKeyUp = (e) => {
      const action = map[e.code]
      if (action) { keys.current[action] = false; e.preventDefault() }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isMobile, resetPosition])

  // ---------- Pointer Lock: silencia a promise interna do three ----------
  // O PointerLockControls chama domElement.requestPointerLock() sem tratar o
  // retorno. Nos navegadores em que esse metodo devolve uma Promise, uma
  // recusa vira "Uncaught (in promise) SecurityError" no console. O store ja
  // evita pedir o lock fora de hora; aqui garantimos que uma recusa residual
  // nao polua o console.
  useEffect(() => {
    const el = gl?.domElement
    if (!el || el.__pointerLockPatched) return
    const original = el.requestPointerLock
    if (typeof original !== 'function') return

    el.__pointerLockPatched = true
    el.requestPointerLock = function patched(...args) {
      let result
      try {
        result = original.apply(this, args)
      } catch {
        return undefined
      }
      if (result && typeof result.catch === 'function') result.catch(() => {})
      return result
    }

    return () => {
      el.requestPointerLock = original
      delete el.__pointerLockPatched
    }
  }, [gl])

  // ---------- Pointer Lock: API exposta ao store (desktop) ----------
  useEffect(() => {
    if (isMobile) return
    const lock = () => {
      const controls = controlsRef.current
      if (controls && !controls.isLocked) controls.lock()
    }
    const unlock = () => {
      const controls = controlsRef.current
      if (controls && controls.isLocked) controls.unlock()
    }
    useGameStore.getState().registerPointerControls(lock, unlock)
    return () => useGameStore.getState().registerPointerControls(null, null)
  }, [isMobile])

  // ---------- Loop principal ----------
  // Usamos setLinvel (velocidade), que ja e independente de framerate; nao precisamos de delta.
  useFrame(() => {
    const body = bodyRef.current
    if (!body) return

    const { isMovementPaused, isMobile: mobile, isPointerLocked } = useGameStore.getState()

    // 1) Camera acompanha o corpo (altura dos olhos)
    const t = body.translation()

    // Barreira de mundo: se saiu dos limites, teleporta de volta ao spawn
    if (
      t.x < WORLD_BOUNDS.minX || t.x > WORLD_BOUNDS.maxX ||
      t.z < WORLD_BOUNDS.minZ || t.z > WORLD_BOUNDS.maxZ ||
      t.y < -4 // caiu pelo chao
    ) {
      resetPosition()
      return
    }

    playerPosRef.current[0] = t.x
    playerPosRef.current[1] = t.y
    playerPosRef.current[2] = t.z

    camera.position.set(t.x, t.y + EYE_HEIGHT, t.z)

    // Sync pose mesmo quando pausado (outros veem o avatar parado)
    const publishNow = () => {
      if (!isMultiplayerConnected()) return
      const now = performance.now()
      if (now - lastPosePub.current < POSE_INTERVAL_MS) return
      lastPosePub.current = now
      let lookYaw = yaw.current
      let lookPitch = pitch.current
      if (!mobile) {
        camEuler.setFromQuaternion(camera.quaternion, 'YXZ')
        lookYaw = camEuler.y
        lookPitch = camEuler.x
      }
      publishPose({
        x: t.x,
        z: t.z,
        yaw: lookYaw,
        pitch: lookPitch,
        walking: wasMoving.current,
      })
    }

    // 2) Look no mobile: consome o delta de arraste e aplica a camera
    if (mobile) {
      const look = useGameStore.getState().consumeLook()
      if (look.x !== 0 || look.y !== 0) {
        yaw.current -= look.x * LOOK_SENSITIVITY
        pitch.current -= look.y * LOOK_SENSITIVITY
        pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current))
      }
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
    }

    // 3) Se pausado (modal / nao iniciado) ou mouse livre no desktop: zera o plano XZ
    const linvel = body.linvel()
    if (isMovementPaused || (!mobile && !isPointerLocked)) {
      body.setLinvel({ x: 0, y: linvel.y, z: 0 }, true)
      wasMoving.current = false
      publishNow()
      return
    }

    // 4) Le a entrada (mobile = joystick; desktop = WASD)
    //    inputForward: +1 = andar para onde a camera olha
    //    inputRight:   +1 = strafe para a direita da camera
    let inputForward = 0
    let inputRight = 0
    if (mobile) {
      const m = useGameStore.getState().movement
      inputRight = m.x
      inputForward = m.y // joystick para cima (y+) = frente
    } else {
      const k = keys.current
      inputForward = (k.forward ? 1 : 0) - (k.backward ? 1 : 0)
      inputRight = (k.right ? 1 : 0) - (k.left ? 1 : 0)
    }

    // 5) Direcao no referencial da camera, projetada no chao (ignora pitch)
    camera.getWorldDirection(frontVector)
    frontVector.y = 0
    if (frontVector.lengthSq() > 1e-6) frontVector.normalize()
    else frontVector.set(0, 0, -1)

    sideVector.crossVectors(frontVector, worldUp)
    if (sideVector.lengthSq() > 1e-6) sideVector.normalize()

    direction
      .copy(frontVector)
      .multiplyScalar(inputForward)
      .addScaledVector(sideVector, inputRight)

    // Normaliza so quando ha magnitude > 1 (diagonais no teclado); no joystick preserva a intensidade
    if (direction.lengthSq() > 1) direction.normalize()

    direction.multiplyScalar(WALK_SPEED)

    // 6) Aplica velocidade preservando a gravidade (Y)
    body.setLinvel({ x: direction.x, y: linvel.y, z: direction.z }, true)
    wasMoving.current = direction.lengthSq() > 0.01
    publishNow()
  })

  return (
    <>
      <RigidBody
        ref={bodyRef}
        colliders={false}
        // Corpo dinamico com rotacoes travadas: nao tomba, mas colide com o mundo.
        enabledRotations={[false, false, false]}
        mass={1}
        position={position}
        linearDamping={0.15}
        friction={0}
        canSleep={false}
        type="dynamic"
      >
        {/* CapsuleCollider(args=[meiaAltura, raio]) -> altura total ~ 2m */}
        <CapsuleCollider args={[0.6, 0.4]} />
      </RigidBody>

      {/*
        selector aponta para um alvo dummy (nunca o document).
        Sem isso o drei relocka o mouse em QUALQUER click da pagina.
        Lock/unlock e disparado pelo store a partir de gestos (Entrar, Fechar, overlay).
      */}
      {!isMobile && (
        <PointerLockControls
          ref={controlsRef}
          selector="#pointer-lock-target"
          pointerSpeed={1.2}
          onLock={() => useGameStore.getState().setPointerLocked(true)}
          onUnlock={() => useGameStore.getState().setPointerLocked(false)}
        />
      )}
    </>
  )
}
