/**
 * QR de convite para a sala da versão selecionada.
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { buildInviteUrl } from '../data/versions'

export default function InviteQr({ roomCode }) {
  const [dataUrl, setDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const inviteUrl = buildInviteUrl(roomCode)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(inviteUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [inviteUrl])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mb-4 flex flex-col items-center gap-2">
      <p className="text-xs uppercase tracking-wide text-white/50">Convite da sala</p>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR code do convite"
          className="h-36 w-36 rounded-lg bg-white p-2 shadow-lg"
        />
      ) : (
        <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-white/10 text-xs text-white/50">
          Gerando QR…
        </div>
      )}
      <button
        type="button"
        onClick={copyLink}
        className="max-w-xs truncate rounded-full border border-white/25 bg-black/30 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
        title={inviteUrl}
      >
        {copied ? 'Link copiado!' : inviteUrl.replace(/^https?:\/\//, '')}
      </button>
    </div>
  )
}
