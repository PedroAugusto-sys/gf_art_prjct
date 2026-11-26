import { useGameStore } from '../store'
import { publishGalleryState } from './multiplayer'
import { getSessionToken, uploadArtwork } from './temporaryArtworks'

export function getStableAuthorId() {
  if (typeof localStorage === 'undefined') return 'author-local'
  let authorId = localStorage.getItem('gf-author-id')
  if (!authorId) {
    authorId = `author-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    localStorage.setItem('gf-author-id', authorId)
  }
  return authorId
}

const SYNC_BUDGET = 150 * 1024
const MAX_EDGE = 1024

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

function drawScaled(img, maxEdge) {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

function encodeCanvas(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((webp) => {
      if (webp) {
        resolve({ blob: webp, type: 'image/webp', name: 'obra.webp' })
        return
      }
      canvas.toBlob((jpeg) => {
        if (jpeg) resolve({ blob: jpeg, type: 'image/jpeg', name: 'obra.jpg' })
        else reject(new Error('Failed to create blob'))
      }, 'image/jpeg', quality)
    }, 'image/webp', quality)
  })
}

/**
 * Reduz a imagem antes de sincronizar.
 * O lado maior fica em no máximo 1024 px, qualidade cerca de 0,7,
 * e o data URL fica abaixo de ~150 KB para caber na sala em pedaços.
 */
export function resizeImageToDataUrl(file, maxSize = MAX_EDGE) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'))
      img.onload = async () => {
        try {
          let edge = Math.min(maxSize, MAX_EDGE)
          let quality = 0.7
          let dataUrl = ''
          let encoded = null
          for (let attempt = 0; attempt < 10; attempt++) {
            const canvas = drawScaled(img, edge)
            encoded = await encodeCanvas(canvas, quality)
            dataUrl = await blobToDataUrl(encoded.blob)
            if (dataUrl.length <= SYNC_BUDGET) break
            if (quality > 0.4) quality = Math.round((quality - 0.1) * 10) / 10
            else edge = Math.round(edge * 0.8)
            if (edge < 320) break
          }
          const resized = new File([encoded.blob], encoded.name, { type: encoded.type })
          resolve({ dataUrl, file: resized })
        } catch (err) {
          reject(err)
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export function canEditArtwork(artwork) {
  if (!artwork) return false
  const mine = getStableAuthorId()
  if (artwork.authorId && artwork.authorId === mine) return true
  if (typeof localStorage === 'undefined') return false
  try {
    const backup = JSON.parse(localStorage.getItem('gf-my-artworks') || '[]')
    return backup.some((art) => art.id === artwork.id || (artwork.frameId && art.frameId === artwork.frameId))
  } catch {
    return false
  }
}

function rememberLocally(artwork) {
  if (typeof localStorage === 'undefined') return
  try {
    const backup = JSON.parse(localStorage.getItem('gf-my-artworks') || '[]')
    const existing = backup.findIndex((art) => art.frameId === artwork.frameId)
    if (existing >= 0) backup[existing] = artwork
    else backup.push(artwork)
    localStorage.setItem('gf-my-artworks', JSON.stringify(backup))
  } catch {
    // localStorage pode estar cheio ou bloqueado
  }
}

/**
 * Grava a obra no quadro. O data URL fica sempre presente, então o quadro
 * pinta mesmo quando o servidor de upload não responde ou não envia CORS.
 */
export async function publishImageOnFrame({ file, frameId, title, description, existing, playerName }) {
  const hasFile = file && String(file.type || '').startsWith('image/')
  if (!hasFile && !existing) {
    throw new Error('Por favor selecione uma imagem')
  }
  let dataUrl = existing?.dataUrl || null
  let uploadFile = null
  if (hasFile) {
    const resized = await resizeImageToDataUrl(file, MAX_EDGE)
    dataUrl = resized.dataUrl
    uploadFile = resized.file
  }
  const authorId = existing?.authorId || getStableAuthorId()
  const sessionToken = getSessionToken()
  let uploaded = null
  if (uploadFile && sessionToken) {
    try {
      uploaded = await uploadArtwork(uploadFile, frameId, title || 'Sem título')
    } catch {
      uploaded = null
    }
  }

  const artwork = {
    id: existing?.id || uploaded?.id || `community-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    frameId,
    dataUrl,
    url: hasFile ? uploaded?.url || null : existing?.url || null,
    title: (title || '').trim() || (existing?.title || '').trim() || (uploaded?.title || '').trim(),
    description: (description || '').trim(),
    author: (existing?.author || uploaded?.author || playerName || 'Anônimo').trim() || 'Anônimo',
    authorId,
    authorToken: sessionToken || existing?.authorToken || undefined,
    timestamp: Date.now(),
    isTemporary: !!uploaded || !!existing?.isTemporary,
  }

  rememberLocally(artwork)

  const store = useGameStore.getState()
  if (existing?.id) store.updateCommunityArtwork(existing.id, artwork)
  else store.addCommunityArtwork(artwork)

  publishGalleryState({
    annexCount: useGameStore.getState().annexCount,
    artworks: useGameStore.getState().communityArtworks,
  })

  return artwork
}
