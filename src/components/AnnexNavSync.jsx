import { useEffect } from 'react'
import { useGameStore } from '../store'
import { setWalkAnnexCount } from '../systems/navgrid'
import { setCrowdAnnexCount } from '../systems/crowd'

/** Abre o chão e os destinos dos NPCs junto com a sala. */
export default function AnnexNavSync() {
  const annexCount = useGameStore((s) => s.annexCount)

  useEffect(() => {
    setWalkAnnexCount(annexCount)
    setCrowdAnnexCount(annexCount)
  }, [annexCount])

  return null
}
