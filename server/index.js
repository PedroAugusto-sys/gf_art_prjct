#!/usr/bin/env node
/**
 * Servidor backend para uploads temporários de obras de arte.
 * 
 * CICLO DE VIDA:
 * - Cada sala tem sessão isolada
 * - Primeira entrada cria sessão
 * - Upload vira estado compartilhado
 * - Autor sair não remove obra se há outros
 * - Sala vazia encerra sessão e limpa arquivos
 * - Tolerância reconexão: 60s default (configurável via RECONNECT_GRACE_MS)
 * 
 * SEGURANÇA:
 * - Token de sessão único por cliente
 * - Validação servidor de tipo/tamanho
 * - Limites configuráveis
 * - Moderação básica (delete por ID)
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configurações
const RECONNECT_GRACE_MS = parseInt(process.env.RECONNECT_GRACE_MS) || 60000; // 60s default
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_ARTWORKS_PER_ROOM = 50;
const UPLOAD_DIR = path.join(__dirname, '../.tmp/uploads');
const HEARTBEAT_INTERVAL_MS = 10000; // 10s
const PRESENCE_TIMEOUT_MS = 30000; // 30s sem heartbeat = considerado offline

// Garante que diretório de uploads existe
await fs.mkdir(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// Armazenamento em memória (em produção, usar Redis ou DB)
const sessions = new Map(); // roomId -> { artworks: [], participants: Map }
const participantHeartbeats = new Map(); // participantToken -> { roomId, lastSeen, playerName }

/**
 * Estrutura de sessão:
 * {
 *   roomId: string,
 *   artworks: [
 *     {
 *       id: string,
 *       frameId: string,
 *       filename: string,  // arquivo no disco
 *       url: string,       // URL pública
 *       title: string,
 *       author: string,
 *       authorToken: string,
 *       timestamp: number,
 *       reported: boolean
 *     }
 *   ],
 *   participants: Map<token, { playerName, lastSeen }>
 * }
 */

// Configuração multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido. Use: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  }
});

// Gera token de sessão único
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Obtém ou cria sessão de sala
function getOrCreateSession(roomId) {
  if (!sessions.has(roomId)) {
    sessions.set(roomId, {
      roomId,
      artworks: [],
      participants: new Map()
    });
    console.log(`[Session] Created session for room: ${roomId}`);
  }
  return sessions.get(roomId);
}

// Remove sessão e limpa arquivos
async function cleanupSession(roomId) {
  const session = sessions.get(roomId);
  if (!session) return;

  console.log(`[Session] Cleaning up room: ${roomId} (${session.artworks.length} artworks)`);

  // Remove arquivos físicos
  for (const artwork of session.artworks) {
    const filepath = path.join(UPLOAD_DIR, artwork.filename);
    try {
      await fs.unlink(filepath);
      console.log(`[Cleanup] Deleted file: ${artwork.filename}`);
    } catch (err) {
      console.error(`[Cleanup] Failed to delete ${artwork.filename}:`, err.message);
    }
  }

  sessions.delete(roomId);
  console.log(`[Session] Removed session for room: ${roomId}`);
}

// Verifica presença e limpa salas vazias (rodar periodicamente)
async function cleanupEmptyRooms() {
  const now = Date.now();
  
  // Atualiza presença baseado em heartbeats
  for (const [token, data] of participantHeartbeats.entries()) {
    if (now - data.lastSeen > PRESENCE_TIMEOUT_MS) {
      // Participante considerado offline
      const session = sessions.get(data.roomId);
      if (session) {
        session.participants.delete(token);
        console.log(`[Presence] Participant ${data.playerName} timed out in ${data.roomId}`);
      }
      participantHeartbeats.delete(token);
    }
  }

  // Limpa salas vazias após grace period
  for (const [roomId, session] of sessions.entries()) {
    if (session.participants.size === 0) {
      // Verifica se já passou o grace period desde a última presença
      const hasRecentHeartbeat = Array.from(participantHeartbeats.values())
        .some(p => p.roomId === roomId && (now - p.lastSeen < RECONNECT_GRACE_MS));
      
      if (!hasRecentHeartbeat) {
        await cleanupSession(roomId);
      }
    }
  }
}

// Loop de limpeza
setInterval(cleanupEmptyRooms, HEARTBEAT_INTERVAL_MS);

// ==================== ENDPOINTS ====================

/**
 * POST /api/join
 * Entra em uma sala e recebe token de sessão
 */
app.post('/api/join', (req, res) => {
  const { roomId, playerName } = req.body;
  
  if (!roomId) {
    return res.status(400).json({ error: 'roomId é obrigatório' });
  }

  const token = generateToken();
  const session = getOrCreateSession(roomId);
  
  session.participants.set(token, {
    playerName: playerName || 'Anônimo',
    lastSeen: Date.now()
  });

  participantHeartbeats.set(token, {
    roomId,
    lastSeen: Date.now(),
    playerName: playerName || 'Anônimo'
  });

  console.log(`[Join] ${playerName || 'Anônimo'} joined ${roomId} (${session.participants.size} participants)`);

  res.json({
    token,
    roomId,
    artworks: session.artworks.map(a => ({
      id: a.id,
      frameId: a.frameId,
      url: a.url,
      title: a.title,
      author: a.author,
      timestamp: a.timestamp,
      isOwn: false // será true no cliente se authorToken === token
    }))
  });
});

/**
 * POST /api/heartbeat
 * Mantém presença ativa na sala
 */
app.post('/api/heartbeat', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token é obrigatório' });
  }

  const participant = participantHeartbeats.get(token);
  if (!participant) {
    return res.status(404).json({ error: 'Sessão não encontrada. Reconecte com /api/join' });
  }

  participant.lastSeen = Date.now();

  const session = sessions.get(participant.roomId);
  if (session && session.participants.has(token)) {
    session.participants.get(token).lastSeen = Date.now();
  }

  res.json({ ok: true });
});

/**
 * GET /api/room/:roomId
 * Obtém estado atual da sala (snapshot coerente)
 */
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const session = sessions.get(roomId);

  if (!session) {
    return res.json({ roomId, artworks: [], participants: 0 });
  }

  res.json({
    roomId,
    artworks: session.artworks.map(a => ({
      id: a.id,
      frameId: a.frameId,
      url: a.url,
      title: a.title,
      author: a.author,
      timestamp: a.timestamp
    })),
    participants: session.participants.size
  });
});

/**
 * POST /api/upload
 * Faz upload de obra para frame específico
 */
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { token, roomId, frameId, title } = req.body;
    const file = req.file;

    if (!token || !roomId || !frameId || !file) {
      return res.status(400).json({ error: 'Campos obrigatórios: token, roomId, frameId, image' });
    }

    // Valida token
    const participant = participantHeartbeats.get(token);
    if (!participant || participant.roomId !== roomId) {
      return res.status(403).json({ error: 'Token inválido ou sessão expirada' });
    }

    const session = getOrCreateSession(roomId);

    // Verifica limite de artworks
    if (session.artworks.length >= MAX_ARTWORKS_PER_ROOM) {
      return res.status(429).json({ error: `Limite de ${MAX_ARTWORKS_PER_ROOM} obras atingido` });
    }

    // Verifica se frame já está ocupado
    const existingArtwork = session.artworks.find(a => a.frameId === frameId);
    if (existingArtwork && existingArtwork.authorToken !== token) {
      return res.status(409).json({ error: 'Este frame já está ocupado por outro usuário' });
    }

    // Salva arquivo no disco
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filepath, file.buffer);

    // Se substituindo, remove arquivo antigo
    if (existingArtwork) {
      const oldPath = path.join(UPLOAD_DIR, existingArtwork.filename);
      try {
        await fs.unlink(oldPath);
        console.log(`[Upload] Replaced artwork in ${frameId}, deleted old file`);
      } catch (err) {
        console.error(`[Upload] Failed to delete old file:`, err.message);
      }
      session.artworks = session.artworks.filter(a => a.id !== existingArtwork.id);
    }

    const artwork = {
      id: `artwork-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      frameId,
      filename,
      url: `/uploads/${filename}`,
      title: title || 'Sem título',
      author: participant.playerName,
      authorToken: token,
      timestamp: Date.now(),
      reported: false
    };

    session.artworks.push(artwork);

    console.log(`[Upload] ${participant.playerName} uploaded to ${frameId} in ${roomId}`);

    res.json({
      id: artwork.id,
      frameId: artwork.frameId,
      url: artwork.url,
      title: artwork.title,
      author: artwork.author,
      timestamp: artwork.timestamp
    });

  } catch (err) {
    console.error('[Upload] Error:', err);
    res.status(500).json({ error: err.message || 'Erro ao fazer upload' });
  }
});

/**
 * DELETE /api/artwork/:artworkId
 * Remove obra (apenas dono ou moderador)
 */
app.delete('/api/artwork/:artworkId', async (req, res) => {
  try {
    const { artworkId } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token é obrigatório' });
    }

    const participant = participantHeartbeats.get(token);
    if (!participant) {
      return res.status(403).json({ error: 'Token inválido ou sessão expirada' });
    }

    const session = sessions.get(participant.roomId);
    if (!session) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }

    const artwork = session.artworks.find(a => a.id === artworkId);
    if (!artwork) {
      return res.status(404).json({ error: 'Obra não encontrada' });
    }

    // Apenas dono pode deletar (sem moderador por enquanto)
    if (artwork.authorToken !== token) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta obra' });
    }

    // Remove arquivo físico
    const filepath = path.join(UPLOAD_DIR, artwork.filename);
    try {
      await fs.unlink(filepath);
      console.log(`[Delete] Deleted file: ${artwork.filename}`);
    } catch (err) {
      console.error(`[Delete] Failed to delete file:`, err.message);
    }

    // Remove do estado
    session.artworks = session.artworks.filter(a => a.id !== artworkId);

    console.log(`[Delete] ${participant.playerName} deleted artwork ${artworkId} in ${participant.roomId}`);

    res.json({ ok: true });

  } catch (err) {
    console.error('[Delete] Error:', err);
    res.status(500).json({ error: err.message || 'Erro ao deletar obra' });
  }
});

/**
 * POST /api/report/:artworkId
 * Reporta obra como inapropriada (moderação básica)
 */
app.post('/api/report/:artworkId', (req, res) => {
  const { artworkId } = req.params;
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token é obrigatório' });
  }

  const participant = participantHeartbeats.get(token);
  if (!participant) {
    return res.status(403).json({ error: 'Token inválido ou sessão expirada' });
  }

  const session = sessions.get(participant.roomId);
  if (!session) {
    return res.status(404).json({ error: 'Sala não encontrada' });
  }

  const artwork = session.artworks.find(a => a.id === artworkId);
  if (!artwork) {
    return res.status(404).json({ error: 'Obra não encontrada' });
  }

  artwork.reported = true;

  console.log(`[Report] ${participant.playerName} reported artwork ${artworkId} in ${participant.roomId}`);

  res.json({ ok: true, message: 'Obra reportada com sucesso' });
});

/**
 * GET /api/health
 * Health check do servidor
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    sessions: sessions.size,
    participants: participantHeartbeats.size,
    config: {
      reconnectGraceMs: RECONNECT_GRACE_MS,
      maxFileSize: MAX_FILE_SIZE,
      maxArtworksPerRoom: MAX_ARTWORKS_PER_ROOM
    }
  });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: err.message || 'Erro interno do servidor'
  });
});

// Inicialização
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🎨 Servidor de Uploads Temporários                        ║
║                                                             ║
║  Port: ${PORT}                                                   ║
║  Reconnect grace: ${RECONNECT_GRACE_MS}ms                              ║
║  Max file size: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB                                   ║
║  Max artworks/room: ${MAX_ARTWORKS_PER_ROOM}                              ║
║                                                             ║
║  Endpoints:                                                 ║
║    POST   /api/join                                         ║
║    POST   /api/heartbeat                                    ║
║    GET    /api/room/:roomId                                 ║
║    POST   /api/upload                                       ║
║    DELETE /api/artwork/:artworkId                           ║
║    POST   /api/report/:artworkId                            ║
║    GET    /api/health                                       ║
║                                                             ║
║  Uploads: ${UPLOAD_DIR}                     ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
