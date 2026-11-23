import { useEffect, useState } from 'react'
import { artworkImageSources, loadFirstFrameTexture } from '../systems/frameTexture'

/** Carrega a primeira fonte que o WebGL consegue pintar e recompila o material. */
export function useFrameTexture(record, frameWidth, frameHeight, materialRef) {
  const sources = artworkImageSources(record)
  const key = sources.join('\n')
  const [texture, setTexture] = useState(null)

  useEffect(() => {
    let cancelled = false
    let current = null
    loadFirstFrameTexture(sources, frameWidth, frameHeight).then((tex) => {
      if (cancelled || !tex) {
        tex?.dispose()
        if (!cancelled) setTexture(null)
        return
      }
      current = tex
      const mat = materialRef?.current
      if (mat) {
        mat.map = tex
        mat.color?.set('#ffffff')
        mat.needsUpdate = true
      }
      setTexture(tex)
    })
    return () => {
      cancelled = true
      if (current) {
        current.dispose()
        const mat = materialRef?.current
        if (mat && mat.map === current) {
          mat.map = null
          mat.needsUpdate = true
        }
      }
    }
    // sources é derivado de key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, frameWidth, frameHeight])

  return texture
}
