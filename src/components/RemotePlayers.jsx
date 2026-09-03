/**
 * Jogadores remotos (Playroom): corpo procedural + nametag + interpolacao.
 */

import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { usePlayersList, myPlayer } from 'playroomkit'
import VisitorModel, { BlobShadow } from './VisitorModel'
import { DEFAULT_APPEARANCE } from '../systems/appearance'
import { isMultiplayerConnected, isMultiplayerOffline } from '../systems/multiplayer'
import artworksData from '../data/artworks.json'

const artById = Object.fromEntries((artworksData.artworks || []).map((a) => [a.id, a]))

function RemotePlayer({ player }) {
  const group = useRef(null)
  const motion = useRef({ walking: false, viewing: false })
  const target = useRef({ x: 0, z: 12, yaw: 0, pitch: 0 })
  const [meta, setMeta] = useState({
    name: 'Visitante',
    appearance: DEFAULT_APPEARANCE,
    outfit: 'shirt',
    scale: [1, 1, 1],
    viewingArtId: null,
  })
  const poll = useRef(0)

  useFrame((_, delta) => {
    poll.current++
    if (poll.current % 6 === 0) {
      const pose = player.getState('pose') || {}
      target.current.x = pose.x ?? target.current.x
      target.current.z = pose.z ?? target.current.z
      target.current.yaw = pose.yaw ?? target.current.yaw
      target.current.pitch = pose.pitch ?? 0
      motion.current.walking = !!pose.walking
      motion.current.viewing = !!player.getState('viewingArtId')

      if (poll.current % 30 === 0) {
        const name = player.getState('name') || player.getProfile()?.name || 'Visitante'
        const appearance = player.getState('appearance') || DEFAULT_APPEARANCE
        const outfit = player.getState('outfit') || 'shirt'
        const scale = player.getState('scale') || [1, 1, 1]
        const viewingArtId = player.getState('viewingArtId') || null
        setMeta((prev) => {
          if (
            prev.name === name &&
            prev.outfit === outfit &&
            prev.viewingArtId === viewingArtId &&
            prev.appearance === appearance
          ) {
            return prev
          }
          return { name, appearance, outfit, scale, viewingArtId }
        })
      }
    }

    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = target.current

    // Se estiver vendo obra, aponta yaw para a obra
    let desiredYaw = t.yaw
    if (meta.viewingArtId && artById[meta.viewingArtId]) {
      const art = artById[meta.viewingArtId]
      const [ax, , az] = art.position
      desiredYaw = Math.atan2(ax - g.position.x, az - g.position.z)
    }

    g.position.x += (t.x - g.position.x) * Math.min(1, 10 * dt)
    g.position.z += (t.z - g.position.z) * Math.min(1, 10 * dt)
    let dy = desiredYaw - g.rotation.y
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    g.rotation.y += dy * Math.min(1, 10 * dt)
  })

  // Posicao inicial
  useEffect(() => {
    const pose = player.getState('pose')
    if (pose && group.current) {
      group.current.position.set(pose.x || 0, 0, pose.z || 12)
      group.current.rotation.y = pose.yaw || 0
    }
  }, [player])

  return (
    <>
      <BlobShadow target={group} />
      <group ref={group} position={[0, 0, 12]} scale={meta.scale}>
        <VisitorModel
          appearance={meta.appearance}
          outfit={meta.outfit}
          motion={motion}
          name={meta.name}
          viewingArt={!!meta.viewingArtId}
          headPitch={target.current.pitch}
        />
      </group>
    </>
  )
}

export default function RemotePlayers() {
  // Hook do Playroom: so funciona apos insertCoin. Em offline, lista vazia.
  const players = usePlayersList(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(isMultiplayerConnected() && !isMultiplayerOffline())
  }, [])

  useFrame(() => {
    const ok = isMultiplayerConnected() && !isMultiplayerOffline()
    if (ok !== ready) setReady(ok)
  })

  if (!ready) return null

  let myId = null
  try {
    myId = myPlayer()?.id
  } catch {
    return null
  }

  return (
    <>
      {players
        .filter((p) => p.id !== myId)
        .map((p) => (
          <RemotePlayer key={p.id} player={p} />
        ))}
    </>
  )
}
