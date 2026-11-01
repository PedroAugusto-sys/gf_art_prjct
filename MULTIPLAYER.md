# 🌐 Configuração Multiplayer (Playroom Kit)

## ✅ Modo Atual: Desenvolvimento (Funciona sem configuração)

O museu **já funciona em multiplayer** sem configuração adicional, mas com limite de DAU (Daily Active Users) imposto pelo Playroom Kit.

Se você abrir duas abas/navegadores na mesma URL, os usuários já se veem e sincronizam.

---

## 🚀 Para Produção: Configure o Game ID (DAU Ilimitado)

### Passo 1: Criar conta no Playroom

1. Acesse: https://app.joinplayroom.com
2. Crie uma conta gratuita
3. Faça login

### Passo 2: Criar um novo jogo

1. No dashboard, clique em **"Create New Game"** ou **"New Project"**
2. Dê um nome (ex: "GF Art Museum")
3. Copie o **Game ID** que será gerado (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Passo 3: Configurar no projeto

#### Localmente (desenvolvimento):

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Abra o arquivo `.env` e cole seu Game ID:
   ```env
   VITE_PLAYROOM_GAME_ID=seu-game-id-aqui
   ```

3. Reinicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

#### Em produção (Netlify/Vercel):

1. Acesse as configurações do seu site
2. Vá em **Environment Variables** ou **Build & deploy → Environment**
3. Adicione uma nova variável:
   - **Nome**: `VITE_PLAYROOM_GAME_ID`
   - **Valor**: seu Game ID copiado
4. Faça um novo deploy

---

## 🐛 Problemas Comuns

### "WebSocket bloqueado" ou ERR_BLOCKED_BY_CLIENT

**Causa**: Bloqueador de anúncios (uBlock, AdBlock, etc.) ou extensão de privacidade bloqueando WebSockets.

**Soluções**:
- Desative temporariamente o bloqueador para `localhost` e `joinplayroom.com`
- Use navegação anônima/privada (geralmente não tem extensões ativas)
- Adicione exceção nas configurações da extensão

### "Não vejo outros usuários"

**Verifique**:
1. Ambos os usuários entraram na mesma URL (mesmo `roomCode` no hash)
2. Console do navegador não mostra erros de WebSocket
3. Ambos clicaram em "Entrar" e passaram pela tela inicial
4. Firewall/proxy corporativo não está bloqueando WebSockets

### "Limite de DAU atingido"

Configure o Game ID seguindo os passos acima para remover o limite.

---

## 📚 Documentação Oficial

- Playroom Kit Docs: https://docs.joinplayroom.com
- Getting Started: https://docs.joinplayroom.com/usage/getting-started
- Dashboard: https://app.joinplayroom.com

---

## 🔧 Detalhes Técnicos

- O app degrada graciosamente para **modo solo** se o Playroom falhar
- Estado da galeria (obras publicadas, expansões) sincroniza via `roomSetState/roomGetState`
- Posições dos jogadores sincronizam via `myPlayer().setState('pose', ...)`
- Funciona 100% no browser (sem backend próprio necessário)
