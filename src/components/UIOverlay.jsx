import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store'
import VirtualControls from './VirtualControls'

/**
 * UIOverlay: toda a interface HTML sobreposta ao <Canvas>.
 *  - Tela inicial ("Entrar") -> inicia o jogo e (no desktop) captura o mouse.
 *  - Mira central (desktop).
 *  - Modal deslizante com a historia da obra (Framer Motion).
 *  - Overlay "Clique para continuar" quando o mouse e liberado sem modal.
 *  - Controles virtuais (apenas mobile).
 *
 * Le o store com seletores especificos para minimizar re-renderizacoes.
 */
export default function UIOverlay() {
  const isMobile = useGameStore((s) => s.isMobile)
  const isStarted = useGameStore((s) => s.isStarted)
  const selectedArtwork = useGameStore((s) => s.selectedArtwork)
  const focusedArtwork  = useGameStore((s) => s.focusedArtwork)
  const isPointerLocked = useGameStore((s) => s.isPointerLocked)
  const beginPlaying = useGameStore((s) => s.beginPlaying)
  const closeArtwork = useGameStore((s) => s.closeArtwork)
  const lockPointer = useGameStore((s) => s.lockPointer)

  const wantsResume = isStarted && !isMobile && !selectedArtwork && !isPointerLocked
  const [showResume, setShowResume] = useState(false)

  // Evita flash do overlay enquanto o browser confirma o pointer lock (Entrar / Fechar).
  useEffect(() => {
    if (!wantsResume) {
      setShowResume(false)
      return
    }
    const timer = setTimeout(() => setShowResume(true), 220)
    return () => clearTimeout(timer)
  }, [wantsResume])

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Alvo dummy: o drei so relocka o mouse se este elemento for clicado. */}
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
            <p className="mb-8 max-w-md px-6 text-sm text-white/70">
              {isMobile
                ? 'Use o joystick a esquerda para andar e arraste o lado direito da tela para olhar. Toque em uma obra para ver a historia.'
                : 'Use W A S D para andar e o mouse para olhar. Clique em uma obra para ver a historia e usar o cursor. Feche o painel pelo botao Fechar.'}
            </p>
            <button
              onClick={beginPlaying}
              className="rounded-full border border-white/40 px-10 py-3 text-lg font-medium text-white transition hover:bg-white hover:text-black"
            >
              Entrar
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
      <AnimatePresence>
        {isStarted && !selectedArtwork && isMobile && focusedArtwork && (
          <motion.button
            key="mobile-interact"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              useGameStore.getState().openArtwork(focusedArtwork)
            }}
            className="pointer-events-auto absolute bottom-36 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-white/95 px-7 py-4 text-base font-semibold text-neutral-900 shadow-xl active:scale-95"
          >
            {/* Icone de imagem */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-neutral-700">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5ZM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
            </svg>
            Ver obra
          </motion.button>
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
