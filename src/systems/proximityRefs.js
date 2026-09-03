/**
 * Refs globais de posicao para o sistema de portas.
 * Sao refs simples (nao Zustand) para nao causar re-renders.
 * O Player e os NPCs escrevem aqui a cada frame;
 * as portas leem aqui para decidir se abrem.
 */

// [x, y, z] do jogador
export const playerPosRef = { current: [0, 0, 0] }

// Map de npcId -> [x, z] dos NPCs ativos.
// Usar Map evita o problema de indices deslizantes que causava congelamento
// quando um NPC era removido com splice() e deslocava os slots dos outros.
export const npcPosMap = new Map()
