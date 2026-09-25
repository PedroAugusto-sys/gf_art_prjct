/**
 * Texturas procedurais para paredes, bancos e vegetação.
 * Geradas em canvas para evitar arquivos de imagem externos.
 */

import * as THREE from 'three'

/**
 * Textura de parede - reboco com variação sutil
 */
export function createWallTexture() {
  try {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const baseColor = '#f2efe9'
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size)

    const imgData = ctx.getImageData(0, 0, size, size)
    const data = imgData.data

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8
      data[i] += noise
      data[i + 1] += noise
      data[i + 2] += noise
    }

    ctx.putImageData(imgData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)
    texture.needsUpdate = true
    return texture
  } catch {
    return null
  }
}

/**
 * Textura de madeira para bancos
 */
export function createWoodTexture() {
  try {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const baseColor = '#5a4634'
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = 'rgba(70, 50, 35, 0.3)'
    ctx.lineWidth = 2
    for (let i = 0; i < 20; i++) {
      const y = Math.random() * size
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y + (Math.random() - 0.5) * 20)
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 2)
    texture.needsUpdate = true
    return texture
  } catch {
    return null
  }
}

/**
 * Textura de casca de árvore
 */
export function createBarkTexture() {
  try {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const baseColor = '#6b4c31'
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size)

    const imgData = ctx.getImageData(0, 0, size, size)
    const data = imgData.data

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const noise = (Math.random() - 0.5) * 30
        const vertical = Math.sin(x * 0.1) * 10
        data[i] += noise + vertical
        data[i + 1] += noise + vertical
        data[i + 2] += noise + vertical
      }
    }

    ctx.putImageData(imgData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.needsUpdate = true
    return texture
  } catch {
    return null
  }
}

/**
 * Textura de folhagem
 */
export function createLeafTexture() {
  try {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const baseColor = '#5c8a44'
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size)

    const imgData = ctx.getImageData(0, 0, size, size)
    const data = imgData.data

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20
      data[i] += noise
      data[i + 1] += noise
      data[i + 2] += noise
    }

    ctx.putImageData(imgData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  } catch {
    return null
  }
}
