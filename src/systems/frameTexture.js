import * as THREE from 'three'

/** Quadro de catálogo, sem obra enviada por um visitante. */
export function isExampleArtwork(artwork) {
  if (!artwork) return false
  if (artwork.example === true) return true
  return /\(exemplo\)\s*$/i.test(String(artwork.title || ''))
}

/**
 * Fontes da imagem, da mais confiável para a menos.
 * O data URL pinta no quadro sem CORS. A URL do servidor vem depois.
 */
export function artworkImageSources(record) {
  if (!record) return []
  const list = []
  const push = (url) => {
    if (typeof url === 'string' && url && !list.includes(url)) list.push(url)
  }
  push(record.dataUrl)
  push(record.url)
  push(record.imagePath)
  return list
}

export function resolveArtworkUrl(url) {
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('blob:') || /^https?:/i.test(url)) return url
  // Arquivo do próprio site (o catálogo em public/). O servidor de upload
  // só entra em caminhos que não são da aplicação.
  if (url.startsWith('/assets/')) return url
  const env = import.meta.env
  const base = (env && env.VITE_ART_SERVER_URL) || 'http://localhost:3001'
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

/** data: e blob: não levam crossOrigin. Um header CORS ausente derruba a textura e o <img> do painel continua. */
export function textureRequest(url) {
  const src = resolveArtworkUrl(url)
  const remote = /^https?:/i.test(src)
  return { src, crossOrigin: remote ? 'anonymous' : null }
}

const MAT_COLOR = '#2a2a2a'

/**
 * object-fit: contain. A imagem inteira cabe no quadro, com passe-partout
 * nas sobras. Nada é cortado e nada é esticado.
 */
export function containRect(imageWidth, imageHeight, frameWidth, frameHeight) {
  const iw = Math.max(1, imageWidth)
  const ih = Math.max(1, imageHeight)
  const fw = Math.max(0.001, frameWidth)
  const fh = Math.max(0.001, frameHeight)
  const imageAspect = iw / ih
  const frameAspect = fw / fh
  if (imageAspect > frameAspect) {
    const h = fw / imageAspect
    return { x: 0, y: (fh - h) / 2, w: fw, h }
  }
  const w = fh * imageAspect
  return { x: (fw - w) / 2, y: 0, w, h: fh }
}

function paintContain(image, frameWidth, frameHeight) {
  const canvas = document.createElement('canvas')
  const pxW = 1024
  const pxH = Math.max(1, Math.round(pxW * (frameHeight / Math.max(0.001, frameWidth))))
  canvas.width = pxW
  canvas.height = pxH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = MAT_COLOR
  ctx.fillRect(0, 0, pxW, pxH)
  const rect = containRect(image.naturalWidth || image.width, image.naturalHeight || image.height, pxW, pxH)
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export function loadFrameTexture(url, frameWidth, frameHeight) {
  const request = textureRequest(url)
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (request.crossOrigin) img.crossOrigin = request.crossOrigin
    img.onload = () => {
      resolve(paintContain(img, frameWidth, frameHeight))
    }
    img.onerror = () => reject(new Error('texture'))
    img.src = request.src
  })
}

export async function loadFirstFrameTexture(sources, frameWidth, frameHeight) {
  for (const url of sources || []) {
    if (!url) continue
    try {
      return await loadFrameTexture(url, frameWidth, frameHeight)
    } catch {
      // A URL remota pode falhar por CORS. A próxima fonte, em geral o data URL, segue.
    }
  }
  return null
}
