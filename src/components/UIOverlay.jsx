import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store'
import VirtualControls from './VirtualControls'
import VersionTimeline from './VersionTimeline'
import InviteQr from './InviteQr'
import { generateAppearance, sanitizeNick } from '../systems/appearance'
import { connectMultiplayer, publishGalleryState } from '../systems/multiplayer'
import { getVersionById } from '../data/versions'

/**
 * UIOverlay: interface HTML sobreposta ao Canvas.
 */
export default function UIOverlay() {
  const isMobile = useGameStore((s) => s.isMobile)
  const isStarted = useGameStore((s) => s.isStarted)
  const selectedArtwork = useGameStore((s) => s.selectedArtwork)
  const focusedArtwork = useGameStore((s) => s.focusedArtwork)
  const isPointerLocked = useGameStore((s) => s.isPointerLocked)
  const cameraMode = useGameStore((s) => s.cameraMode)
  const beginPlaying = useGameStore((s) => s.beginPlaying)
  const closeArtwork = useGameStore((s) => s.closeArtwork)
  const lockPointer = useGameStore((s) => s.lockPointer)
  const returnToVersionSelect = useGameStore((s) => s.returnToVersionSelect)
  const setPlayerIdentity = useGameStore((s) => s.setPlayerIdentity)
  const setMpStatus = useGameStore((s) => s.setMpStatus)
  const mpOffline = useGameStore((s) => s.mpOffline)
  const selectedVersionId = useGameStore((s) => s.selectedVersionId)
  const setSelectedVersion = useGameStore((s) => s.setSelectedVersion)
  const playerName = useGameStore((s) => s.playerName)
  const ensurePlayableVersion = useGameStore((s) => s.ensurePlayableVersion)

  const wantsResume = isStarted && !isMobile && !selectedArtwork && !isPointerLocked
  const [showResume, setShowResume] = useState(false)
  const [nick, setNick] = useState('')
  const [nickError, setNickError] = useState('')
  const [joining, setJoining] = useState(false)
  const [offlineHint, setOfflineHint] = useState('')
  /** Ignora clique/tap no backdrop logo apos abrir (ghost click do mesmo toque). */
  const artworkOpenedAt = useRef(0)

  const activeVersion =
    getVersionById(selectedVersionId)?.status === 'playable'
      ? getVersionById(selectedVersionId)
      : getVersionById('v0')

  const hasCommunityGallery = activeVersion?.flags?.communityGallery ?? false
  const annexCount = useGameStore((s) => s.annexCount)
  const setAnnexCount = useGameStore((s) => s.setAnnexCount)
  const communityArtworks = useGameStore((s) => s.communityArtworks)
  const [showExpandModal, setShowExpandModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  useEffect(() => {
    ensurePlayableVersion?.()
  }, [ensurePlayableVersion])

  // Marca o instante em que a obra abriu (anti ghost-click no backdrop).
  useEffect(() => {
    if (selectedArtwork) artworkOpenedAt.current = performance.now()
  }, [selectedArtwork])

  const handleCloseArtwork = () => {
    if (performance.now() - artworkOpenedAt.current < 400) return
    closeArtwork()
  }

  // Ao voltar do ESC, reaproveita o nick anterior no campo
  useEffect(() => {
    if (!isStarted && playerName) setNick(playerName)
    if (!isStarted) setOfflineHint('')
  }, [isStarted, playerName])

  useEffect(() => {
    if (!wantsResume) {
      setShowResume(false)
      return
    }
    const timer = setTimeout(() => setShowResume(true), 220)
    return () => clearTimeout(timer)
  }, [wantsResume])

  // ESC com mouse livre (ex.: overlay "continuar" ou modal de obra).
  // Com pointer lock, o browser engole o ESC — o store trata via onUnlock.
  useEffect(() => {
    if (!isStarted) return
    const onKey = (e) => {
      if (e.code !== 'Escape' && e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      returnToVersionSelect()
    }
    window.addEventListener('keyup', onKey, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keyup', onKey, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [isStarted, returnToVersionSelect])

  const handleEnter = async () => {
    if (joining) return
    const name = sanitizeNick(nick)
    if (!name) {
      setNickError('Digite um nick com 2 a 16 caracteres.')
      return
    }
    const version = getVersionById(selectedVersionId)
    if (!version || version.status !== 'playable') {
      setNickError('Não foi possível entrar. Tente de novo.')
      return
    }
    setNickError('')
    setOfflineHint('')
    setJoining(true)

    try {
      const prev = useGameStore.getState()
      const reused = prev.playerAppearance
        ? {
            appearance: prev.playerAppearance,
            outfit: prev.playerOutfit || 'shirt',
            scale: prev.playerScale || [1, 1, 1],
          }
        : generateAppearance()
      const { appearance, outfit, scale } = reused
      setPlayerIdentity({ name, appearance, outfit, scale })

      const result = await connectMultiplayer(
        { name, appearance, outfit, scale },
        version.roomCode
      )
      const wentOffline = !!result?.offline
      setMpStatus({ ready: true, offline: wentOffline })
      if (wentOffline) {
        setOfflineHint('Sem conexão multiplayer — jogando sozinho.')
      }
      beginPlaying()
    } catch (err) {
      // Modo offline - mensagem já aparece na UI, sem console noise
      setNickError('Não foi possível conectar. Tente de novo.')
      setOfflineHint('Sem conexão multiplayer — jogando sozinho.')
      setMpStatus({ ready: true, offline: true })
    } finally {
      setJoining(false)
    }
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
            className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-black/80 py-8 text-center"
          >
            <h1 className="mb-2 text-4xl font-light tracking-wide text-white md:text-5xl">
              Meu Museu
            </h1>
            <p className="mb-5 max-w-md px-6 text-sm text-white/70">
              Digite seu nick e compartilhe o QR para convidar amigos à sala.
            </p>

            <VersionTimeline selectedId={selectedVersionId} onSelect={setSelectedVersion} />

            <InviteQr roomCode={activeVersion.roomCode} />

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
              className="mt-3 rounded-full border border-white/40 px-10 py-3 text-lg font-medium text-white transition hover:bg-white hover:text-black disabled:opacity-50"
            >
              {joining ? 'Conectando…' : `Entrar · ${activeVersion.title}`}
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

      {/* ============ ESC · menu ============ */}
      {isStarted && (
        <button
          type="button"
          onClick={returnToVersionSelect}
          className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm hover:bg-black/70"
        >
          <span className="rounded border border-white/40 bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
            ESC
          </span>
          Menu
        </button>
      )}

      {/* ============ HINT CAMERA TOGGLE (desktop) ============ */}
      {isStarted && !selectedArtwork && !isMobile && (
        <div className="pointer-events-none absolute left-4 top-16 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm">
          <span className="rounded border border-white/40 bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
            V
          </span>
          {cameraMode === 'first' ? '3ª pessoa' : '1ª pessoa'}
        </div>
      )}

      {/* ============ AVISO MULTIPLAYER OFFLINE ============ */}
      {isStarted && (mpOffline || offlineHint) && !selectedArtwork && (
        <div className="pointer-events-none absolute right-4 top-4 max-w-xs rounded-full bg-amber-950/80 px-4 py-1.5 text-xs text-amber-100/90 backdrop-blur-sm">
          {offlineHint || 'Sem conexão multiplayer — jogando sozinho.'}
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
      {/* Canto inferior direito, z acima do VirtualControls (look zone).
          Abrir no onClick (nao onPointerDown): pointerdown montava o backdrop
          antes do click do mesmo toque, que fechava a obra na hora. */}
      <AnimatePresence>
        {isStarted && !selectedArtwork && isMobile && focusedArtwork && (
          <motion.div
            key="mobile-interact-wrap"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto absolute bottom-36 right-4 z-30"
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                artworkOpenedAt.current = performance.now()
                useGameStore.getState().openArtwork(focusedArtwork)
              }}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 text-base font-bold text-neutral-900 shadow-2xl active:scale-95 transition-transform select-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-neutral-700">
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
              onClick={handleCloseArtwork}
              onPointerUp={(e) => {
                // Mobile: o mesmo toque que abriu pode chegar aqui como pointerup
                if (performance.now() - artworkOpenedAt.current < 400) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
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

      {/* ============ BOTÕES FLUTUANTES: EXPANDIR E PUBLICAR (COMUNIDADE) ============ */}
      {isStarted && !selectedArtwork && hasCommunityGallery && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col gap-3">
          {/* Botão Expandir Galeria */}
          {annexCount < 2 && (
            <button
              type="button"
              onClick={() => {
                unlockPointer()
                setShowExpandModal(true)
              }}
              className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-2xl transition-all hover:scale-105 hover:shadow-blue-500/50 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
              Expandir Galeria
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                {annexCount}/2
              </span>
            </button>
          )}

          {/* Botão Publicar Obra */}
          <button
            type="button"
            onClick={() => {
              unlockPointer()
              setShowUploadModal(true)
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-2xl transition-all hover:scale-105 hover:shadow-emerald-500/50 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h3.75a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9a3 3 0 013-3h3.75z" />
            </svg>
            Publicar Obra
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
              {communityArtworks.length}
            </span>
          </button>
        </div>
      )}

      {/* ============ MODAL EXPANDIR GALERIA ============ */}
      <AnimatePresence>
        {showExpandModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowExpandModal(false)
              if (!isMobile) setTimeout(() => lockPointer(), 100)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-2xl font-semibold text-white">Expandir Galeria</h2>
              <p className="mb-6 text-sm leading-relaxed text-white/70">
                Adicione mais espaço para expor obras comunitárias. Cada expansão cria uma nova sala anexa com 4 quadros adicionais.
              </p>

              <div className="mb-6 rounded-lg bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between text-sm text-white/60">
                  <span>Progresso</span>
                  <span className="font-mono font-semibold text-white">{annexCount}/2 salas</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                    style={{ width: `${(annexCount / 2) * 100}%` }}
                  />
                </div>
              </div>

              {annexCount < 2 ? (
                <button
                  onClick={() => {
                    const newCount = annexCount + 1
                    setAnnexCount(newCount)
                    publishGalleryState({
                      annexCount: newCount,
                      artworks: communityArtworks,
                    })
                    setShowExpandModal(false)
                    if (!isMobile) setTimeout(() => lockPointer(), 100)
                  }}
                  className="mb-3 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 font-semibold text-white transition hover:from-blue-700 hover:to-blue-600"
                >
                  ✨ Expandir Agora
                </button>
              ) : (
                <div className="mb-3 rounded-xl bg-amber-950/50 border border-amber-600/30 py-3 text-center text-sm text-amber-200">
                  🎉 Galeria totalmente expandida!
                </div>
              )}

              <button
                onClick={() => {
                  setShowExpandModal(false)
                  if (!isMobile) setTimeout(() => lockPointer(), 100)
                }}
                className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ MODAL PUBLICAR OBRA ============ */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => {
              setShowUploadModal(false)
              if (!isMobile) setTimeout(() => lockPointer(), 100)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-2xl font-semibold text-white">Publicar Obra</h2>
              <p className="mb-6 text-sm leading-relaxed text-white/70">
                Caminhe até um quadro vazio nas paredes laterais da galeria e pressione <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">E</kbd> para fazer upload da sua imagem.
              </p>

              <div className="mb-6 space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    1
                  </div>
                  <div>
                    <div className="font-medium text-white">Encontre um quadro vazio</div>
                    <div className="text-xs text-white/60">Nas paredes laterais da galeria</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    2
                  </div>
                  <div>
                    <div className="font-medium text-white">Aproxime-se dele</div>
                    <div className="text-xs text-white/60">Até ver a opção de publicar</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    3
                  </div>
                  <div>
                    <div className="font-medium text-white">Pressione E para fazer upload</div>
                    <div className="text-xs text-white/60">Escolha uma imagem do seu dispositivo</div>
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-lg border border-amber-600/30 bg-amber-950/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  Obras Temporárias
                </div>
                <p className="text-xs leading-relaxed text-amber-200/80">
                  Suas obras permanecem visíveis apenas enquanto há visitantes na sala. Quando todos saírem, a exposição recomeça vazia.
                </p>
              </div>

              <div className="mb-4 rounded-lg bg-blue-950/30 border border-blue-600/30 p-4">
                <div className="text-sm font-medium text-blue-200 mb-1">
                  📊 Obras publicadas: {communityArtworks.length}
                </div>
                <div className="text-xs text-blue-200/70">
                  Quadros disponíveis: {(4 + annexCount * 4) - communityArtworks.length}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowUploadModal(false)
                  if (!isMobile) setTimeout(() => lockPointer(), 100)
                }}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 font-semibold text-white transition hover:from-emerald-700 hover:to-emerald-600"
              >
                Entendi, vamos lá!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
