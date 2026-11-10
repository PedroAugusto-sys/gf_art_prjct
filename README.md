# Meu Museu

Galeria de arte multiplayer 3D construída com React Three Fiber e Playroom Kit.

## 🚀 Desenvolvimento Local

Este projeto possui duas partes que devem rodar simultaneamente:

### 1️⃣ **Frontend** (Interface 3D)

```bash
# Terminal 1: Instalar dependências do frontend
npm install

# Iniciar servidor de desenvolvimento frontend (porta 5173)
npm run dev
```

O frontend estará disponível em: **http://localhost:5173**

### 2️⃣ **Backend** (Servidor de uploads temporários)

```bash
# Terminal 2: Entrar na pasta do servidor
cd server

# Instalar dependências do servidor
npm install

# Iniciar servidor Node.js (porta 3001)
npm start
```

O backend estará disponível em: **http://localhost:3001**

#### ✅ Verificar se o servidor está rodando

Abra no navegador: **http://localhost:3001/api/health**

Você deve ver uma resposta JSON com `"status": "ok"`

### 🔧 Configuração (Opcional)

Crie um arquivo `.env` na **raiz do projeto** (não dentro de `/server`):

```env
# Backend de uploads (deve apontar para o servidor Node.js)
VITE_ART_SERVER_URL=http://localhost:3001

# Opcional: Playroom Kit Game ID para produção
VITE_PLAYROOM_GAME_ID=
```

⚠️ **Importante**: O frontend precisa saber onde está o backend. A variável `VITE_ART_SERVER_URL` deve apontar para `http://localhost:3001` em desenvolvimento local.

### 🪟 Windows PowerShell

Se estiver no Windows, use estes comandos:

```powershell
# Terminal 1 (Frontend)
npm install
npm run dev

# Terminal 2 (Backend) - em outra janela PowerShell
cd server
npm install
npm start
```

## 🎮 Configuração Multiplayer Avançada (Opcional)

O app funciona sem configuração, mas com limite de DAU (Daily Active Users) do Playroom Kit.

Para produção, configure um Game ID:

1. Crie uma conta gratuita em [joinplayroom.com](https://app.joinplayroom.com)
2. Crie um novo jogo no dashboard
3. Copie o Game ID e adicione no `.env`:

```env
VITE_PLAYROOM_GAME_ID=seu-game-id-aqui
```

### 🚀 Deploy em Produção

#### Frontend (Netlify/Vercel)

O frontend pode ser hospedado em qualquer serviço de hosting estático:

```bash
npm run build
```

Configure as variáveis de ambiente:
- `VITE_PLAYROOM_GAME_ID` (opcional)
- `VITE_ART_SERVER_URL` (URL do servidor backend em produção)

#### Backend (Railway/Render/Heroku)

O servidor Node.js precisa ser hospedado separadamente:

1. Faça deploy da pasta `/server` 
2. Configure a variável `PORT` (geralmente fornecida automaticamente)
3. Anote a URL do backend (ex: `https://seu-app.railway.app`)
4. Atualize `VITE_ART_SERVER_URL` no frontend para apontar para esta URL

## 📦 Build

```bash
npm run build
```

## 🎯 Features

- ✅ Galeria multiplayer em tempo real (até 10 jogadores)
- ✅ NPCs que caminham e reagem a obras de arte
- ✅ Toggle de câmera 1ª ↔ 3ª pessoa (tecla V)
- ✅ Upload de obras comunitárias
- ✅ Expansão dinâmica do espaço (até 2 anexos)
- ✅ Modo offline quando Playroom indisponível

## 🎮 Controles

### Desktop
- **WASD / Setas**: Movimento
- **Mouse**: Olhar ao redor (pointer lock)
- **E**: Ver obra (quando próximo)
- **V**: Alternar câmera 1ª/3ª pessoa
- **ESC**: Menu / Trocar versão

### Mobile
- **Joystick esquerdo**: Movimento
- **Toque direito**: Olhar ao redor
- **Botão "Ver obra"**: Interagir com obras próximas
