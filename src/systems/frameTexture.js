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

/** object-fit: cover. A imagem preenche o quadro sem esticar. */
export function coverPlacement(imageWidth, imageHeight, frameWidth, frameHeight) {
  const imageAspect = Math.max(1, imageWidth) / Math.max(1, imageHeight)
  const frameAspect = Math.max(0.001, frameWidth) / Math.max(0.001, frameHeight)
  if (imageAspect > frameAspect) {
    const repeatX = frameAspect / imageAspect
    return { repeatX, repeatY: 1, offsetX: (1 - repeatX) / 2, offsetY: 0 }
  }
  const repeatY = imageAspect / frameAspect
  return { repeatX: 1, repeatY, offsetX: 0, offsetY: (1 - repeatY) / 2 }
}

export function applyCover(texture, imageWidth, imageHeight, frameWidth, frameHeight) {
  const place = coverPlacement(imageWidth, imageHeight, frameWidth, frameHeight)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(place.repeatX, place.repeatY)
  texture.offset.set(place.offsetX, place.offsetY)
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
      const texture = new THREE.Texture(img)
      applyCover(
        texture,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        frameWidth,
        frameHeight,
      )
      resolve(texture)
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
