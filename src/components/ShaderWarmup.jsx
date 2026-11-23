import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Compila os shaders dos anexos (nascem ocultos) enquanto o menu está na tela.
 * Sem isso, o primeiro frame visível da sala nova recompila o museu inteiro.
 */
export default function ShaderWarmup() {
  const { gl, scene, camera } = useThree()
  const done = useRef(false)

  useLayoutEffect(() => {
    if (done.current) return
    done.current = true
    const hidden = []
    scene.traverse((obj) => {
      if (!obj.visible) {
        hidden.push(obj)
        obj.visible = true
      }
    })
    scene.updateMatrixWorld(true)
    gl.compile(scene, camera)
    for (const obj of hidden) obj.visible = false
  }, [gl, scene, camera])

  return null
}
