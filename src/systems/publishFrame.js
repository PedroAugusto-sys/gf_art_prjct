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

const SYNC_BUDGET = 180000

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

/**
 * Reduz a imagem antes do envio e da textura.
 * O lado maior fica em no máximo 2048 px. Se o data URL ainda for grande
 * demais para a sala, a qualidade (e, se precisar, o tamanho) desce até caber.
 */
export function resizeImageToDataUrl(file, maxSize = 2048) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'))
      img.onload = async () => {
        try {
          let edge = maxSize
          let quality = 0.82
          let dataUrl = ''
          let blob = null
          for (let attempt = 0; attempt < 8; attempt++) {
            const canvas = drawScaled(img, edge)
            blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality))
            if (!blob) throw new Error('Failed to create blob')
            dataUrl = await blobToDataUrl(blob)
            if (dataUrl.length <= SYNC_BUDGET) break
            if (quality > 0.5) quality -= 0.12
            else edge = Math.round(edge * 0.75)
            if (edge < 640) break
          }
          const resized = new File([blob], 'obra.webp', { type: 'image/webp' })
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
    const resized = await resizeImageToDataUrl(file, 2048)
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
