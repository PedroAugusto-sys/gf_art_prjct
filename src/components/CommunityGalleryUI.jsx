import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'

/**
 * UI para publicação de obras comunitárias.
 * Aparece quando o jogador está próximo de um quadro vazio na v1.
 */
export function CommunityGalleryUI() {
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const fileInputRef = useRef(null)

  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const addCommunityArtwork = useGameStore((s) => s.addCommunityArtwork)
  const annexCount = useGameStore((s) => s.annexCount)
  const playerName = useGameStore((s) => s.playerName)

  const isHost = isRoomHost() || isMultiplayerOffline()
  const canPublish = isHost || communityArtworks.length < 4 // Limite básico

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })

      const maxSize = 480
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const dataUrl = canvas.toBlob(
        (blob) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const artwork = {
              id: `community-${Date.now()}`,
              dataUrl: reader.result,
              title: title || 'Sem título',
              author: author || playerName,
              authorId: playerName,
              timestamp: Date.now(),
            }

            addCommunityArtwork(artwork)
            publishGalleryState({
              annexCount,
              artworks: [...communityArtworks, artwork],
            })

            setTitle('')
            setAuthor('')
            setShowUpload(false)
            setUploading(false)
          }
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.85
      )
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setUploading(false)
    }
  }

  return (
    <AnimatePresence>
      {showUpload && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 shadow-2xl"
          >
            <h2 className="mb-6 text-2xl font-semibold text-white">Publicar obra</h2>

            <div className="mb-4">
              <label className="mb-2 block text-sm text-white/70">Título da obra</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dê um nome à sua obra"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/40"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm text-white/70">Seu nome (opcional)</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={playerName || 'Anônimo'}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/40"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !canPublish}
                className="flex-1 rounded-lg bg-white px-6 py-3 font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {uploading ? 'Processando...' : 'Escolher imagem'}
              </button>
              <button
                onClick={() => setShowUpload(false)}
                className="rounded-lg border border-white/30 px-6 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Cancelar
              </button>
            </div>

            {!canPublish && (
              <p className="mt-4 text-xs text-amber-300">
                Limite de obras atingido nesta sala.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
