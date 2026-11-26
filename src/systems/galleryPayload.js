/** Cada pedaço cabe numa mensagem do Playroom. A imagem inteira não cabe. */
export const IMAGE_CHUNK = 6000

export function imageStateKey(id, index) {
  return `ga:${id}:${index}`
}

function publicUrl(url) {
  if (typeof url !== 'string' || !url) return undefined
  if (/localhost|127\.0\.0\.1/i.test(url)) return undefined
  return url
}

/**
 * A ficha da sala fica sem a imagem. A imagem vai em chaves `ga:id:n`.
 * Se esta cópia ainda não tem o data URL, preserva a contagem de pedaços
 * para não apagar a imagem dos outros.
 */
export function packGallery(gallery) {
  const artworks = []
  const chunks = []
  for (const art of gallery?.artworks || []) {
    if (!art?.id) continue
    const dataUrl = typeof art.dataUrl === 'string' && art.dataUrl.startsWith('data:') ? art.dataUrl : ''
    const { dataUrl: _dataUrl, url, parts: previousParts, ...rest } = art
    if (dataUrl) {
      const count = Math.ceil(dataUrl.length / IMAGE_CHUNK)
      artworks.push({ ...rest, url: publicUrl(url), parts: count })
      for (let i = 0; i < count; i++) {
        chunks.push({
          key: imageStateKey(art.id, i),
          value: dataUrl.slice(i * IMAGE_CHUNK, (i + 1) * IMAGE_CHUNK),
        })
      }
    } else {
      artworks.push({ ...rest, url: publicUrl(url), parts: Number(previousParts) || 0 })
    }
  }
  return {
    meta: { annexCount: gallery?.annexCount, artworks },
    chunks,
  }
}

export function unpackGallery(meta, read) {
  if (!meta || typeof meta !== 'object') return null
  const artworks = []
  for (const art of meta.artworks || []) {
    if (!art) continue
    const inline = typeof art.dataUrl === 'string' && art.dataUrl.startsWith('data:') ? art.dataUrl : ''
    const count = Number(art.parts) || 0
    if (inline && !count) {
      const { parts: _parts, ...rest } = art
      artworks.push(rest)
      continue
    }
    if (!count) {
      const { parts: _parts, dataUrl: _dataUrl, ...rest } = art
      artworks.push(rest)
      continue
    }
    const slices = []
    let complete = true
    for (let i = 0; i < count; i++) {
      const slice = read(imageStateKey(art.id, i))
      if (typeof slice !== 'string' || !slice) {
        complete = false
        break
      }
      slices.push(slice)
    }
    const { parts: _parts, dataUrl: _dataUrl, ...rest } = art
    if (!complete) {
      artworks.push({ ...rest, parts: count })
      continue
    }
    artworks.push({ ...rest, dataUrl: slices.join('') })
  }
  return { annexCount: meta.annexCount, artworks }
}

export function staleImageKeys(previousMeta, nextMeta) {
  const nextCounts = new Map()
  for (const art of nextMeta?.artworks || []) {
    if (art?.id) nextCounts.set(art.id, Number(art.parts) || 0)
  }
  const keys = []
  for (const art of previousMeta?.artworks || []) {
    if (!art?.id) continue
    const keep = nextCounts.has(art.id) ? nextCounts.get(art.id) : 0
    const old = Number(art.parts) || 0
    for (let i = keep; i < old; i++) keys.push(imageStateKey(art.id, i))
  }
  return keys
}

export function galleryHasInlineImages(meta) {
  return (meta?.artworks || []).some((art) => typeof art?.dataUrl === 'string' && art.dataUrl.startsWith('data:'))
}
