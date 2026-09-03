import { create } from 'zustand'

/**
 * Detecta de forma simples se o dispositivo e mobile/touch.
 * Combina userAgent com a existencia de pontos de toque para maior confiabilidade.
 */
function detectMobile() {
  if (typeof navigator === 'undefined') return false
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
  // iPadOS moderno se identifica como desktop; por isso checamos toque + tamanho tambem.
  return uaMobile || (touch && window.innerWidth < 1024)
}

// Callbacks do PointerLockControls (Player). Fora do estado para nao re-renderizar.
let lockPointerFn = null
let unlockPointerFn = null

/**
 * Controle de recaptura do ponteiro.
 *
 * O navegador recusa requestPointerLock por um curto periodo depois que o
 * usuario sai do lock (ESC ou troca de aba), lancando:
 *   SecurityError: Pointer lock cannot be acquired immediately after the user
 *   has exited the lock.
 * Como o overlay "Clique para continuar" aparece exatamente nesse instante,
 * o clique caia direto na janela de bloqueio e o erro se repetia.
 *
 * Aqui registramos o momento do unlock e adiamos a tentativa ate a janela
 * passar, em vez de chamar o lock e deixar a promise estourar no console.
 */
const LOCK_COOLDOWN_MS = 1400
let lastUnlockAt = 0
let pendingLockTimer = null

function cancelPendingLock() {
  if (pendingLockTimer !== null) {
    clearTimeout(pendingLockTimer)
    pendingLockTimer = null
  }
}

/** O documento esta em um estado em que o navegador aceita o lock? */
function canLockNow() {
  if (!lockPointerFn) return false
  if (typeof document === 'undefined') return false
  if (document.pointerLockElement) return false
  if (document.hidden) return false
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false
  return performance.now() - lastUnlockAt >= LOCK_COOLDOWN_MS
}

/** Tenta capturar o ponteiro, reagendando enquanto o navegador nao permitir. */
function requestLock(attemptsLeft = 8) {
  cancelPendingLock()
  if (!lockPointerFn) return

  if (canLockNow()) {
    try {
      lockPointerFn()
    } catch {
      /* o navegador ainda recusou: o overlay continua disponivel */
    }
    return
  }

  if (attemptsLeft <= 0) return

  const remaining = LOCK_COOLDOWN_MS - (performance.now() - lastUnlockAt)
  pendingLockTimer = setTimeout(() => {
    pendingLockTimer = null
    requestLock(attemptsLeft - 1)
  }, Math.max(150, remaining))
}

/**
 * Store global (Zustand).
 *
 * Organizado em tres grupos para permitir ASSINATURAS SELETIVAS:
 *  1) UI/estado de jogo (selectedArtwork, isStarted) -> a UI React re-renderiza.
 *  2) Dispositivo (isMobile) -> lido raramente.
 *  3) Entrada transitoria (movement, look) -> escrita/lida imperativamente
 *     via getState()/setState() dentro do useFrame para NAO re-renderizar a cena.
 *
 * Regra de ouro: o Player le movement/look com useGameStore.getState() (sem hook),
 * entao mudar esses valores a cada frame nao dispara re-render de componentes React.
 */
export const useGameStore = create((set, get) => ({
  // ---------- Dispositivo ----------
  isMobile: detectMobile(),
  setMobile: (value) => set({ isMobile: value }),

  // ---------- Fluxo / UI ----------
  // isStarted: o usuario precisa clicar em "Entrar" para capturar o mouse (Pointer Lock)
  // e habilitar audio/controles. Antes disso, mostramos a tela inicial.
  isStarted: false,
  start: () => set({ isStarted: true }),

  // Obra atualmente selecionada (null = nenhuma). Quando != null, o modal aparece
  // e o movimento e pausado.
  selectedArtwork: null,

  // Obra atualmente em foco pela mira (null = nenhuma). Atualizada a cada frame
  // pelo ArtworkFocus sem re-renderizar o mundo 3D (usa setState seletivo).
  focusedArtwork: null,
  setFocusedArtwork: (artwork) => {
    if (get().focusedArtwork !== artwork) set({ focusedArtwork: artwork })
  },

  // Pausa explicita do movimento (menu, modal de obra, etc.).
  // isMovementPaused = true quando ha uma obra aberta OU quando o jogo nao comecou.
  isMovementPaused: true,

  // Espelho do pointer lock (desktop). A UI usa para mira / "clique para continuar".
  isPointerLocked: false,
  setPointerLocked: (value) => {
    // Registra a saida do lock para respeitar a janela de bloqueio do navegador.
    if (!value) {
      lastUnlockAt = performance.now()
      cancelPendingLock()
    }
    if (get().isPointerLocked === value) return
    set({ isPointerLocked: value })
  },

  registerPointerControls: (lock, unlock) => {
    lockPointerFn = lock
    unlockPointerFn = unlock
    if (!lock) cancelPendingLock()
  },
  lockPointer: () => requestLock(),
  unlockPointer: () => {
    cancelPendingLock()
    try {
      unlockPointerFn?.()
    } catch {
      /* ja destravado */
    }
  },

  openArtwork: (artwork) => {
    cancelPendingLock()
    try {
      unlockPointerFn?.()
    } catch {
      /* ja destravado */
    }
    set({ selectedArtwork: artwork, isMovementPaused: true })
  },

  closeArtwork: () => {
    set({
      selectedArtwork: null,
      // Ao fechar, so volta a andar se o jogo ja tiver comecado.
      isMovementPaused: !get().isStarted,
    })
    // Mesmo clique do Fechar/backdrop e um gesto valido para relock.
    if (get().isStarted && !get().isMobile) requestLock()
  },

  // Marca o inicio do jogo e libera o movimento.
  beginPlaying: () => {
    set({ isStarted: true, isMovementPaused: false })
    if (!get().isMobile) requestLock()
  },

  // ---------- Entrada transitoria (NAO assinar em componentes de UI) ----------
  // movement: vetor normalizado do joystick virtual (mobile). x = strafe, y = frente/tras.
  // Range aproximado [-1, 1]. No desktop permanece {0,0} (WASD e lido direto no Player).
  movement: { x: 0, y: 0 },
  setMovement: (x, y) => set({ movement: { x, y } }),

  // look: delta acumulado de rotacao vindo do arraste do dedo (mobile).
  // O Player consome e zera esse valor a cada frame.
  look: { x: 0, y: 0 },
  setLook: (x, y) => set({ look: { x, y } }),
  // Soma incremental (usada pelo handler de touch a cada movimento do dedo).
  addLook: (dx, dy) => {
    const l = get().look
    set({ look: { x: l.x + dx, y: l.y + dy } })
  },
  consumeLook: () => {
    const l = get().look
    if (l.x !== 0 || l.y !== 0) set({ look: { x: 0, y: 0 } })
    return l
  },
}))

// Em desenvolvimento, expoe o store no window para depuracao no console
// (ex.: useGameStore.getState().openArtwork(...)). Removido automaticamente no build de producao.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.useGameStore = useGameStore
}
