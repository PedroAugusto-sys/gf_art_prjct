import { useState } from 'react'
import { useGameStore } from '../store'
import { publishImageOnFrame } from '../systems/publishFrame'

/** Formulário de envio, o mesmo para o quadro vazio e para o quadro de exemplo. */
export default function PublishForm({ frameId, existing, onClose }) {
  const playerName = useGameStore((s) => s.playerName)
  const [title, setTitle] = useState(existing?.title || '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      await publishImageOnFrame({
        file,
        frameId,
        title,
        existing,
        playerName,
      })
      onClose()
    } catch (err) {
      setUploadError(err?.message || 'Erro ao processar imagem. Tente novamente.')
      setUploading(false)
    }
  }

  return (
    <div
      style={{
        background: 'rgba(20,20,20,0.95)',
        color: 'white',
        padding: '24px',
        borderRadius: '12px',
        width: '320px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
        {existing ? 'Substituir obra' : 'Publicar obra aqui'}
      </h3>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', opacity: 0.8 }}>
        Título da obra
      </label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Dê um nome à sua obra"
        disabled={uploading}
        style={{
          width: '100%',
          marginBottom: '16px',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: '14px',
          outline: 'none',
        }}
      />
      {uploadError && (
        <div style={{ marginBottom: '12px', color: '#fca5a5', fontSize: '12px' }}>{uploadError}</div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <label
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            background: uploading ? '#555' : '#fff',
            color: '#000',
            fontSize: '14px',
            fontWeight: 600,
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? 'Processando...' : 'Escolher imagem'}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </label>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          disabled={uploading}
          style={{
            padding: '10px 16px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
