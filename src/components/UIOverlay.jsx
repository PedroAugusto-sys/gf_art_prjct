import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store'
import VirtualControls from './VirtualControls'
import { generateAppearance, sanitizeNick } from '../systems/appearance'
import { connectMultiplayer } from '../systems/multiplayer'

/**
 * UIOverlay: interface HTML sobreposta ao Canvas.
 */
export default function UIOverlay() {
  const isMobile = useGameStore((s) => s.isMobile)
  const isStarted = useGameStore((s) => s.isStarted)
  const selectedArtwork = useGameStore((s) => s.selectedArtwork)
  const focusedArtwork = useGameStore((s) => s.focusedArtwork)
  const isPointerLocked = useGameStore((s) => s.isPointerLocked)
  const beginPlaying = useGameStore((s) => s.beginPlaying)
  const closeArtwork = useGameStore((s) => s.closeArtwork)
  const lockPointer = useGameStore((s) => s.lockPointer)
  const setPlayerIdentity = useGameStore((s) => s.setPlayerIdentity)
  const setMpStatus = useGameStore((s) => s.setMpStatus)

  const wantsResume = isStarted && !isMobile && !selectedArtwork && !isPointerLocked
  const [showResume, setShowResume] = useState(false)
  const [nick, setNick] = useState('')
  const [nickError, setNickError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!wantsResume) {
      setShowResume(false)
      return
    }
    const timer = setTimeout(() => setShowResume(true), 220)
    return () => clearTimeout(timer)
  }, [wantsResume])

  const handleEnter = async () => {
    const name = sanitizeNick(nick)
    if (!name) {
      setNickError('Digite um nick com 2 a 16 caracteres.')
      return
    }
    setNickError('')
    setJoining(true)

    const { appearance, outfit, scale } = generateAppearance()
    setPlayerIdentity({ name, appearance, outfit, scale })

    const result = await connectMultiplayer({ name, appearance, outfit, scale })
    setMpStatus({ ready: true, offline: result.offline })
    setJoining(false)
    beginPlaying()
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <button
        id="pointer-lock-target"
        type="button"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />

      {/* ============ TELA INICIAL ============ */}
      <AnimatePresence>
        {!isStarted && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center"
          >
            <h1 className="mb-3 text-4xl font-light tracking-wide text-white md:text-5xl">
              Museu de Arte Virtual
            </h1>
            <p className="mb-6 max-w-md px-6 text-sm text-white/70">
              {isMobile
                ? 'Use o joystick à esquerda para andar e arraste o lado direito para olhar. Aproxime-se de uma obra para interagir.'
                : 'Use W A S D para andar e o mouse para olhar. Aponte para uma obra e pressione E. Outros visitantes online aparecem no museu.'}
            </p>

            <label className="mb-2 text-xs uppercase tracking-wide text-white/50">
              Seu nick
            </label>
            <input
              type="text"
              value={nick}
              maxLength={16}
              placeholder="Ex: Marina"
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEnter()
              }}
              className="mb-2 w-64 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-center text-white placeholder:text-white/40 outline-none focus:border-white/60"
            />
            {nickError && <p className="mb-2 text-xs text-red-300">{nickError}</p>}

            <button
              onClick={handleEnter}
              disabled={joining}
              className="mt-4 rounded-full border border-white/40 px-10 py-3 text-lg font-medium text-white transition hover:bg-white hover:text-black disabled:opacity-50"
            >
              {joining ? 'Conectando…' : 'Entrar'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ RETOMAR LOOK (ESC / unlock sem modal) ============ */}
      {/* Botao compacto no centro-baixo da tela: nao escurece a cena,
          facil de achar e clicar sem cobrir o que o usuario quer ver. */}
      <AnimatePresence>
        {showResume && (
          <motion.button
            key="resume"
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={lockPointer}
            className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-7 py-3 text-sm font-medium text-white/95 shadow-lg backdrop-blur-sm hover:bg-black/85 active:scale-95 transition-transform"
          >
            {/* Icone de cursor / clique */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 opacity-80">
              <path d="M13.5 4.5a1.5 1.5 0 1 1 3 0v8.25l1.72-1.72a.75.75 0 0 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.22 1.22V4.5ZM6 3.75A2.25 2.25 0 0 0 3.75 6v13.5A2.25 2.25 0 0 0 6 21.75h12A2.25 2.25 0 0 0 20.25 19.5V6A2.25 2.25 0 0 0 18 3.75H6Z" />
            </svg>
            Clique para continuar
          </motion.button>
        )}
      </AnimatePresence>

      {/* ============ MIRA (desktop, jogando, mouse capturado) ============ */}
      {isStarted && !selectedArtwork && !isMobile && isPointerLocked && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-2 w-2 rounded-full border border-white/70 bg-white/20" />
        </div>
      )}

      {/* ============ PROMPT DESKTOP: obra em foco pela mira ============ */}
      {isStarted && !selectedArtwork && !isMobile && isPointerLocked && focusedArtwork && (
        <div className="absolute left-1/2 top-[54%] -translate-x-1/2 rounded-full bg-black/55 px-5 py-1.5 text-sm text-white/90 backdrop-blur-sm flex items-center gap-2">
          <span className="rounded border border-white/50 bg-white/10 px-1.5 py-0.5 font-mono text-xs">E</span>
          Ver obra
        </div>
      )}

      {/* ============ BOTAO MOBILE: obra proxima por distancia ============ */}
      {/* Fixo no centro-baixo da tela, sem translate que pode deslocar a hitbox.
          Padding generoso (py-5 px-10) garante area de toque facil com o polegar. */}
      <AnimatePresence>
        {isStarted && !selectedArtwork && isMobile && focusedArtwork && (
          <motion.div
            key="mobile-interact-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'absolute', bottom: 140, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
          >
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                useGameStore.getState().openArtwork(focusedArtwork)
              }}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white px-10 py-5 text-lg font-bold text-neutral-900 shadow-2xl active:scale-95 transition-transform select-none"
            >
              {/* Icone olho */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 shrink-0 text-neutral-700">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5ZM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
              </svg>
              Ver obra
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ DICA PERMANENTE ============ */}
      {isStarted && !selectedArtwork && (isMobile || isPointerLocked) && !focusedArtwork && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1 text-xs text-white/70 backdrop-blur-sm">
          {isMobile ? 'Aproxime-se de uma obra para interagir' : 'Aponte para uma obra e pressione E'}
        </div>
      )}

      {/* ============ MODAL DA OBRA ============ */}
      <AnimatePresence>
        {selectedArtwork && (
          <>
            {/* Fundo escurecido */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeArtwork}
              className="pointer-events-auto absolute inset-0 bg-black/50"
            />

            {/* Painel deslizante (direita no desktop, sobe no mobile) */}
            <motion.aside
              key="panel"
              initial={{ x: '100%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-neutral-900/95 p-8 shadow-2xl backdrop-blur-md"
            >
              <button
                onClick={closeArtwork}
                aria-label="Fechar"
                className="mb-6 self-end rounded-full border border-white/30 px-4 py-1 text-sm text-white/80 transition hover:bg-white hover:text-black"
              >
                Fechar
              </button>

              {/* Imagem da obra (mesmo arquivo usado na textura 3D) */}
              <div className="mb-6 w-full overflow-hidden rounded-lg bg-neutral-800">
                <img
                  src={selectedArtwork.imagePath}
                  alt={selectedArtwork.title}
                  className="h-56 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>

              <h2 className="text-2xl font-semibold text-white">{selectedArtwork.title}</h2>
              <p className="mt-1 text-sm text-white/60">
                {selectedArtwork.artist}
                {selectedArtwork.year ? ` - ${selectedArtwork.year}` : ''}
              </p>
              <p className="mt-6 text-base leading-relaxed text-white/80">
                {selectedArtwork.description}
              </p>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ============ CONTROLES MOBILE ============ */}
      {isMobile && isStarted && !selectedArtwork && <VirtualControls />}
    </div>
  )
}
