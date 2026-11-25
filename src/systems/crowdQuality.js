/**
 * Quantos visitantes a máquina aguenta.
 * Geometria e material já são compartilhados; o que pesa é animar e
 * falar com todo mundo no mesmo frame. O passo da IA é escalonado,
 * quem está longe não anima, e ninguém vai para o Playroom.
 */

export const CROWD_QUALITY = {
  maxVisitors: 26,
  mobileMaxVisitors: 12,
  aiStride: 2,
  animDistance: 15,
  speechRange: 7.2,
  nameRange: 9,
  maxSpeeches: 4,
}

export function crowdLimit(isMobile) {
  return isMobile ? CROWD_QUALITY.mobileMaxVisitors : CROWD_QUALITY.maxVisitors
}
