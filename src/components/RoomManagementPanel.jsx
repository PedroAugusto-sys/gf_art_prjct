import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store'
import { publishGalleryState, isRoomHost, isMultiplayerOffline } from '../systems/multiplayer'

/**
 * Painel para gerenciar salas anexas.
 * Ativado com a tecla 'R' quando na v1.
 */
export function RoomManagementPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const annexCount = useGameStore((s) => s.annexCount)
  const setAnnexCount = useGameStore((s) => s.setAnnexCount)
  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const isStarted = useGameStore((s) => s.isStarted)
  const getVersionFlags = useGameStore((s) => s.getVersionFlags)

  const hasCommunityGallery = getVersionFlags()?.communityGallery ?? false
  const isHost = isRoomHost() || isMultiplayerOffline()
  const canAddRoom = annexCount < 2 && isHost

  useEffect(() => {
    if (!isStarted || !hasCommunityGallery) return

    const handleKey = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isStarted, hasCommunityGallery])

  const handleAddRoom = () => {
    if (!canAddRoom) return

    const newCount = annexCount + 1
    setAnnexCount(newCount)

    publishGalleryState({
      annexCount: newCount,
      artworks: communityArtworks,
    })
  }

  if (!hasCommunityGallery || !isStarted) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-md rounded-2xl bg-neutral-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-semibold text-white">Gerenciar salas</h2>

            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                <span className="text-white/80">Sala principal</span>
                <span className="text-sm text-green-400">Ativa</span>
              </div>

              {Array.from({ length: annexCount }, (_, i) => (
                <div
                  key={`annex-${i}`}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3"
                >
                  <span className="text-white/80">Sala anexa {i + 1}</span>
                  <span className="text-sm text-green-400">Ativa</span>
                </div>
              ))}
            </div>

            {canAddRoom && (
              <button
                onClick={handleAddRoom}
                className="mb-4 w-full rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 5.25a.75.75 0 01.75.75v5.25H18a.75.75 0 010 1.5h-5.25V18a.75.75 0 01-1.5 0v-5.25H6a.75.75 0 010-1.5h5.25V6a.75.75 0 01.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                Adicionar nova sala ({annexCount}/2)
              </button>
            )}

            {!canAddRoom && annexCount >= 2 && (
              <p className="mb-4 text-sm text-amber-300">
                Limite máximo de salas atingido (2 anexas).
              </p>
            )}

            {!isHost && (
              <p className="mb-4 text-sm text-white/60">
                Apenas o anfitrião pode criar novas salas.
              </p>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className="w-full rounded-lg border border-white/30 px-6 py-2 font-medium text-white transition hover:bg-white/10"
            >
              Fechar
            </button>

            <p className="mt-4 text-center text-xs text-white/50">Pressione R para abrir/fechar</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
