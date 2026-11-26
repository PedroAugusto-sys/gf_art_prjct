import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store'
import { publishImageOnFrame } from '../systems/publishFrame'

/** Formulário de envio e de edição: título, descrição e imagem. */
export default function PublishForm({ frameId, existing, onClose, onSaved }) {
  const playerName = useGameStore((s) => s.playerName)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onPick = (event) => {
    const next = event.target.files?.[0] || null
    if (next && !next.type.startsWith('image/')) {
      setUploadError('Escolha um arquivo de imagem')
      setFile(null)
      return
    }
    setUploadError('')
    setFile(next)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('artwork-title') || '')
    const description = String(data.get('artwork-description') || '')
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
    <form
      ref={formRef}
      onSubmit={onSubmit}
      style={{
        background: 'rgba(20,20,20,0.95)',
        color: 'white',
        padding: '24px',
        borderRadius: '12px',
        width: 'min(100%, 420px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
        {existing ? 'Editar obra' : 'Publicar obra aqui'}
      </h3>
      <label htmlFor="artwork-title" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', opacity: 0.8 }}>
        Título da obra
      </label>
      <input
        id="artwork-title"
        name="artwork-title"
        type="text"
        defaultValue={existing?.title || ''}
        placeholder="Dê um nome à sua obra"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="next"
        disabled={uploading}
        style={{
          width: '100%',
          marginBottom: '12px',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: '16px',
          outline: 'none',
        }}
      />
      <label htmlFor="artwork-description" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', opacity: 0.8 }}>
        Descrição
      </label>
      <textarea
        id="artwork-description"
        name="artwork-description"
        defaultValue={existing?.description || ''}
        placeholder="Conte o que está nesta obra"
        autoComplete="off"
        autoCorrect="off"
        disabled={uploading}
        rows={4}
        style={{
          width: '100%',
          marginBottom: '12px',
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: '16px',
          outline: 'none',
          resize: 'vertical',
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={onPick}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={(e) => {
          e.stopPropagation()
          fileRef.current?.click()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          marginBottom: '8px',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.35)',
          background: 'rgba(255,255,255,0.12)',
          color: 'white',
          fontSize: '16px',
          fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
        }}
      >
        <span aria-hidden>📁</span>
        {existing ? 'Trocar imagem' : 'Enviar imagem'}
      </button>
      {file && (
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>{file.name}</p>
      )}
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '8px',
            marginBottom: '12px',
            display: 'block',
          }}
        />
      )}
      {uploadError && (
        <div style={{ marginBottom: '12px', color: '#fca5a5', fontSize: '12px' }}>{uploadError}</div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="submit"
          disabled={uploading}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '6px',
            border: 'none',
            background: uploading ? '#555' : '#fff',
            color: '#000',
            fontSize: '16px',
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
            padding: '12px 16px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
