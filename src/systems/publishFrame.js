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

/** Reduz a imagem e devolve um data URL. O quadro 3D usa isso sem CORS. */
export function resizeImageToDataUrl(file, maxSize = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Não foi possível ler a imagem'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }
            const webpReader = new FileReader()
            webpReader.onerror = () => reject(new Error('Não foi possível ler a imagem'))
            webpReader.onloadend = () => resolve(webpReader.result)
            webpReader.readAsDataURL(blob)
          },
          'image/webp',
          0.75,
        )
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
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
export async function publishImageOnFrame({ file, frameId, title, existing, playerName }) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Por favor selecione uma imagem')
  }
  const dataUrl = await resizeImageToDataUrl(file, 480)
  const authorId = getStableAuthorId()
  const sessionToken = getSessionToken()
  let uploaded = null
  if (sessionToken) {
    try {
      uploaded = await uploadArtwork(file, frameId, title || 'Sem título')
    } catch {
      uploaded = null
    }
  }

  const artwork = {
    id: uploaded?.id || existing?.id || `community-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    frameId,
    dataUrl,
    url: uploaded?.url || null,
    title: (title || '').trim() || uploaded?.title || 'Sem título',
    author: uploaded?.author || playerName || 'Anônimo',
    authorId,
    authorToken: sessionToken || undefined,
    timestamp: uploaded?.timestamp || Date.now(),
    isTemporary: !!uploaded,
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
