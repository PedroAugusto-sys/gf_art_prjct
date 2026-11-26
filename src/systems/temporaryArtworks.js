/**
 * Sistema de uploads temporários por sessão via backend autoritativo.
 * 
 * CONTRATO:
 * - Obras fixas de Pedro preservadas (não afetadas)
 * - Uploads temporários pertencem à sessão da sala
 * - Primeira entrada cria sessão
 * - Snapshot coerente para late joiners
 * - Autor sair não remove se há outros
 * - Sala vazia encerra sessão e limpa tudo
 * - Tolerância reconexão: 60s default
 * - Sessões isoladas por roomId
 * - Limpeza automática de órfãos
 */

import { uploadServerUrl } from './uploadServer.js'

function apiBase() {
  const base = uploadServerUrl()
  if (!base) {
    const err = new Error('no-upload-server')
    err.code = 'no-upload-server'
    throw err
  }
  return base
}

let sessionToken = null;
let currentRoomId = null;
let heartbeatInterval = null;

/**
 * Verifica se servidor está disponível
 */
export async function checkServerHealth() {
  let base = ''
  try {
    base = apiBase()
  } catch (err) {
    return { available: false, error: err.code || 'no-upload-server' }
  }
  try {
    const response = await fetch(`${base}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      return { available: false, error: 'Server unhealthy' };
    }
    
    const data = await response.json();
    return {
      available: true,
      config: data.config
    };
  } catch (err) {
    console.info('[TempArtworks] Servidor não disponível:', err.message);
    return {
      available: false,
      error: err.message
    };
  }
}

/**
 * Entra em uma sala e recebe token de sessão
 */
export async function joinRoom(roomId, playerName) {
  try {
    const response = await fetch(`${apiBase()}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerName })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao entrar na sala');
    }

    const data = await response.json();
    sessionToken = data.token;
    currentRoomId = roomId;

    // Inicia heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
      sendHeartbeat().catch(err => {
        console.error('[TempArtworks] Heartbeat failed:', err.message);
      });
    }, 10000); // 10s

    console.log(`[TempArtworks] Joined room ${roomId}, received ${data.artworks.length} artworks`);

    return {
      token: data.token,
      artworks: data.artworks.map(a => ({
        ...a,
        isOwn: false // cliente verifica se é seu
      }))
    };
  } catch (err) {
    console.error('[TempArtworks] Error joining room:', err);
    throw err;
  }
}

/**
 * Mantém presença ativa na sala
 */
async function sendHeartbeat() {
  if (!sessionToken) return;

  try {
    const response = await fetch(`${apiBase()}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn('[TempArtworks] Heartbeat failed:', error.error);
      
      // Se sessão expirou, limpa token e para heartbeat
      if (response.status === 404) {
        sessionToken = null;
        currentRoomId = null;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      }
    }
  } catch (err) {
    // Falha de rede silenciosa (não spam console)
  }
}

/**
 * Faz upload de obra para frame específico
 * @param {File} file - Arquivo de imagem
 * @param {string} frameId - ID do frame
 * @param {string} title - Título da obra
 * @returns {Promise<Object>} Dados da obra criada
 */
export async function uploadArtwork(file, frameId, title) {
  if (!sessionToken || !currentRoomId) {
    throw new Error('Não conectado à sala. Use joinRoom() primeiro.');
  }

  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('token', sessionToken);
    formData.append('roomId', currentRoomId);
    formData.append('frameId', frameId);
    formData.append('title', title || 'Sem título');

    const response = await fetch(`${apiBase()}/api/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao fazer upload');
    }

    const artwork = await response.json();
    console.log(`[TempArtworks] Uploaded artwork to ${frameId}:`, artwork.title);

    return artwork;
  } catch (err) {
    console.error('[TempArtworks] Upload error:', err);
    throw err;
  }
}

/**
 * Remove obra (apenas dono)
 */
export async function deleteArtwork(artworkId) {
  if (!sessionToken) {
    throw new Error('Não conectado à sala.');
  }

  try {
    const response = await fetch(`${apiBase()}/api/artwork/${artworkId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar obra');
    }

    console.log(`[TempArtworks] Deleted artwork ${artworkId}`);
    return true;
  } catch (err) {
    console.error('[TempArtworks] Delete error:', err);
    throw err;
  }
}

/**
 * Obtém estado atual da sala
 */
export async function getRoomState(roomId) {
  try {
    const response = await fetch(`${apiBase()}/api/room/${roomId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Erro ao obter estado da sala');
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[TempArtworks] Error getting room state:', err);
    throw err;
  }
}

/**
 * Limpa sessão atual (chamado ao sair da sala)
 */
export function leaveRoom() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  sessionToken = null;
  currentRoomId = null;

  console.log('[TempArtworks] Left room');
}

/**
 * Obtém token de sessão atual (para debug)
 */
export function getSessionToken() {
  return sessionToken;
}

/**
 * Obtém roomId atual (para debug)
 */
export function getCurrentRoomId() {
  return currentRoomId;
}
