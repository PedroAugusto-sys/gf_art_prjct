import { useState } from 'react'
import { useGameStore } from '../store'
import { publishImageOnFrame } from '../systems/publishFrame'

/** Formulário de envio e de edição: título, descrição e imagem. */
export default function PublishForm({ frameId, existing, onClose, onSaved }) {
  const playerName = useGameStore((s) => s.playerName)
  const [title, setTitle] = useState(existing?.title || '')
  const [description, setDescription] = useState(existing?.description || '')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const onSave = async () => {
    if (!existing && !file) {
      setUploadError('Escolha uma imagem')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const artwork = await publishImageOnFrame({
        file,
        frameId,
        title,
        description,
        existing,
        playerName,
      })
      onSaved?.(artwork)
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
        {existing ? 'Editar obra' : 'Publicar obra aqui'}
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
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: '14px',
          outline: 'none',
        }}
      />
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', opacity: 0.8 }}>
        Descrição
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Conte o que está nesta obra"
        disabled={uploading}
        rows={4}
        style={{
          width: '100%',
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: '14px',
          outline: 'none',
          resize: 'vertical',
        }}
      />
      <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: '#fff' }}>
        {file ? file.name : existing ? 'Trocar imagem (opcional)' : 'Escolher imagem'}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          style={{ display: 'block', marginTop: '6px', fontSize: '12px' }}
        />
      </label>
      {uploadError && (
        <div style={{ marginBottom: '12px', color: '#fca5a5', fontSize: '12px' }}>{uploadError}</div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSave()
          }}
          disabled={uploading}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: uploading ? '#555' : '#fff',
            color: '#000',
            fontSize: '14px',
            fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? 'Salvando...' : 'Salvar'}
        </button>
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
