/**
 * O site na Netlify não tem servidor de upload.
 * Só usamos um se a URL vier explícita no build, e nunca o localhost em produção.
 */
export function uploadServerUrl(env) {
  const source = env || (typeof import.meta !== 'undefined' && import.meta.env) || {}
  const raw = String(source.VITE_UPLOAD_SERVER_URL || source.VITE_ART_SERVER_URL || '').trim()
  if (!raw) return ''
  const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(raw)
  if (localhost && source.PROD) return ''
  return raw.replace(/\/$/, '')
}
