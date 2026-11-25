import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store'
import { playerPosRef } from '../systems/proximityRefs'
import { publishPose, isMultiplayerConnected, POSE_INTERVAL_MS } from '../systems/multiplayer'
import VisitorModel from './VisitorModel'
import { getAnnexRoomBounds } from '../data/museumLayout'
import { groundMoveAxes } from '../systems/groundMove'
import { avatarMetrics, firstPersonEyeY } from '../systems/avatarCamera'

// ---------- Constantes de locomocao ----------
const WALK_SPEED = 5 // metros/segundo
const LOOK_SENSITIVITY = 0.0025 // sensibilidade do arraste (mobile)
const PITCH_LIMIT = Math.PI / 2 - 0.1 // trava o olhar para cima/baixo

// O modelo aponta para +Z. A câmera olha para -Z local, então o corpo
// fica virado PI à frente do yaw da câmera.
const BODY_YAW_OFFSET = Math.PI

// ---------- Limites do mundo (fora daqui e vazio infinito) ----------
// A sala tem 28 x 38; acrescentamos margem para o jardim/estacionamento externos.
// A segunda sala anexa chega perto de z=-59. Sem essa folga o jogador
// é teletransportado de volta ao spawn no meio do corredor.
const WORLD_BOUNDS = {
  minX: -50,
  maxX: 50,
  minZ: Math.min(-30, getAnnexRoomBounds(1).minZ - 4),
  maxZ: 60,
}
const SPAWN_POS = { x: 0, y: 2, z: 8 } // entre os bancos, fora do tampo

// Vetores reutilizados (evita alocar objetos a cada frame -> melhor GC/performance)
const frontVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()
const direction = new THREE.Vector3()
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
export default function Player({ position = [0, 2, 8] }) {
  const bodyRef = useRef(null)
  const controlsRef = useRef(null)
  const visitorMotionRef = useRef({ walking: false, viewing: false })
  const visitorGroupRef = useRef(null)
  const headLookRef = useRef({ pitch: 0, yaw: 0 })
  const { camera, gl } = useThree()

  const isMobile = useGameStore((s) => s.isMobile)
  const playerAppearance = useGameStore((s) => s.playerAppearance)
  const playerOutfit = useGameStore((s) => s.playerOutfit)
  const playerScale = useGameStore((s) => s.playerScale)
  const metrics = avatarMetrics(playerScale)
  const facing = useRef(0)

  // Estado de teclado guardado em ref (nao precisa re-renderizar)
  const keys = useRef({ forward: false, backward: false, left: false, right: false })

  // ---------- Reset de posicao ----------
  const resetPosition = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    const stand = avatarMetrics(useGameStore.getState().playerScale).capsuleCenter
    body.setTranslation({ x: SPAWN_POS.x, y: stand, z: SPAWN_POS.z }, true)
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

    /** Ignora WASD/R enquanto o usuario digita (nick, etc.) ou o jogo nao comecou. */
    const shouldIgnoreKeyboard = () => {
      const { isStarted, isMovementPaused } = useGameStore.getState()
      if (!isStarted || isMovementPaused) return true
      const el = document.activeElement
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      return false
    }

    const onKeyDown = (e) => {
      if (shouldIgnoreKeyboard()) return

      if (e.code === 'KeyR') {
        resetPosition()
        return
      }
      const action = map[e.code]
      if (action) {
        keys.current[action] = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e) => {
      // Sempre libera teclas ao soltar (evita stuck se o foco mudou mid-press)
      const action = map[e.code]
      if (action) {
        keys.current[action] = false
        if (!shouldIgnoreKeyboard()) e.preventDefault()
      }
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

    // 1) Camera em primeira pessoa, na altura dos olhos
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

    const scale = useGameStore.getState().playerScale

    // A câmera fica nos olhos. Alt, Esc e o modal de publicar soltam o
    // mouse, mas não mudam a posição nem o yaw que já estava salvo.
    let lookYaw = facing.current
    let lookPitch = pitch.current
    if (mobile) {
      const look = useGameStore.getState().consumeLook()
      if (look.x !== 0 || look.y !== 0) {
        yaw.current -= look.x * LOOK_SENSITIVITY
        pitch.current -= look.y * LOOK_SENSITIVITY
        pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current))
      }
      lookYaw = yaw.current
      lookPitch = pitch.current
      facing.current = lookYaw
      camera.rotation.set(lookPitch, lookYaw, 0, 'YXZ')
    } else if (isPointerLocked) {
      camEuler.setFromQuaternion(camera.quaternion, 'YXZ')
      lookYaw = camEuler.y
      lookPitch = camEuler.x
      facing.current = lookYaw
      pitch.current = lookPitch
    } else {
      camera.rotation.set(lookPitch, lookYaw, 0, 'YXZ')
    }

    camera.position.set(t.x, firstPersonEyeY(t.y, scale), t.z)

    // O modelo olha para +Z; a câmera olha para -Z. Sem esse PI o corpo
    // fica de costas para o movimento e as pernas parecem ficar para trás.
    const bodyYaw = lookYaw + BODY_YAW_OFFSET
    if (visitorGroupRef.current) visitorGroupRef.current.rotation.y = bodyYaw
    headLookRef.current.pitch = lookPitch
    headLookRef.current.yaw = 0

    // Sync pose mesmo quando pausado (outros veem o avatar parado, de frente)
    const publishNow = () => {
      if (!isMultiplayerConnected()) return
      const now = performance.now()
      if (now - lastPosePub.current < POSE_INTERVAL_MS) return
      lastPosePub.current = now
      publishPose({
        x: t.x,
        z: t.z,
        yaw: bodyYaw,
        pitch: lookPitch,
        walking: wasMoving.current,
      })
    }

    // 3) Se pausado (modal / nao iniciado) ou mouse livre no desktop: zera o plano XZ
    const linvel = body.linvel()
    if (isMovementPaused || (!mobile && !isPointerLocked)) {
      body.setLinvel({ x: 0, y: linvel.y, z: 0 }, true)
      wasMoving.current = false
      visitorMotionRef.current.walking = false
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

    // 5) Rumo no chão só pelo yaw. O vetor de visão inteiro zera
    //    (e o fallback antigo andava para trás) com o olhar no limite.
    const axes = groundMoveAxes(lookYaw)
    frontVector.set(axes.forwardX, 0, axes.forwardZ)
    sideVector.set(axes.rightX, 0, axes.rightZ)

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
    visitorMotionRef.current.walking = wasMoving.current

    publishNow()
  })

  return (
    <>
      <RigidBody
        key={`${metrics.sx.toFixed(2)}-${metrics.sy.toFixed(2)}`}
        ref={bodyRef}
        colliders={false}
        enabledRotations={[false, false, false]}
        mass={1}
        position={[position[0], metrics.capsuleCenter, position[2]]}
        linearDamping={0.15}
        friction={0}
        canSleep={false}
        type="dynamic"
      >
        <CapsuleCollider args={[metrics.half, metrics.radius]} />

        {playerAppearance && (
          <group ref={visitorGroupRef} position={[0, -metrics.capsuleCenter, 0]} visible={false}>
            <group scale={playerScale}>
              <VisitorModel
                appearance={playerAppearance}
                outfit={playerOutfit}
                motion={visitorMotionRef}
                hideHead
                headLook={headLookRef}
              />
            </group>
          </group>
        )}
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
