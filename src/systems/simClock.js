/**
 * Relogio de simulacao monotonico.
 *
 * Por que nao usar state.clock.elapsedTime do R3F?
 * O Clock do three.js e baseado em performance.now(). Quando a aba fica em
 * segundo plano o requestAnimationFrame para, mas o relogio do sistema nao.
 * Ao voltar para a aba, o primeiro frame traz um elapsedTime que saltou todo
 * o tempo em que a aba esteve escondida (as vezes minutos).
 *
 * Consequencia com o tempo de parede: a vida util de TODOS os visitantes
 * expirava de uma vez, eles eram marcados para sair e substituidos por
 * visitantes novos — que nascem no estacionamento. Era isso que dava a
 * impressao de "todos os NPCs resetaram para a porta sul".
 *
 * Este relogio avanca somente com o delta de cada frame, limitado a
 * MAX_STEP. Trocar de aba passa a ser uma pausa real da simulacao.
 */

const MAX_STEP = 0.1 // s: teto do avanco por frame (aba em background / travadas)

export const sim = { time: 0 }

/** Avanca o relogio. Deve ser chamado uma unica vez por frame. */
export function advanceSim(delta) {
  const step = delta > 0 && delta < MAX_STEP ? delta : Math.min(Math.max(delta, 0), MAX_STEP)
  sim.time += step
  return sim.time
}
