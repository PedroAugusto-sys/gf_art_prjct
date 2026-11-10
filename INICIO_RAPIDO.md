# 🚀 Início Rápido - Museu Virtual

Guia prático para rodar o projeto localmente em **5 minutos**.

---

## ✅ Pré-requisitos

- **Node.js** versão 18 ou superior
- Dois terminais/abas abertos

---

## 📦 Passo 1: Instalar Dependências

### Terminal 1 (Frontend)

```bash
npm install
```

### Terminal 2 (Backend)

```bash
cd server
npm install
cd ..
```

---

## ▶️ Passo 2: Iniciar os Servidores

### Terminal 1: Frontend

```bash
npm run dev
```

✅ Aguarde até ver: `Local: http://localhost:5173`

### Terminal 2: Backend (Servidor de uploads)

```bash
cd server
npm start
```

✅ Aguarde até ver:
```
╔═══════════════════════════════════════════════════════════╗
║  🎨 Servidor de Uploads Temporários                        ║
║  Port: 3001                                                ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🌐 Passo 3: Abrir no Navegador

Abra: **http://localhost:5173**

---

## ✅ Verificar se está funcionando

### 1. Frontend

- Acessar http://localhost:5173
- Ver a tela inicial "Meu Museu"

### 2. Backend

- Acessar http://localhost:3001/api/health
- Deve retornar JSON com `"status": "ok"`

---

## 🎮 Como Usar

1. **Digite seu nick** e clique em "Entrar"
2. **Movimentação**:
   - Desktop: `WASD` ou setas + mouse
   - Mobile: joystick virtual + toque
3. **Câmera**: Pressione `V` para alternar 1ª ↔ 3ª pessoa
4. **Ver obras**: Aproxime-se e pressione `E`
5. **Publicar obras**: Clique no botão verde flutuante "Publicar Obra"
6. **Expandir galeria**: Clique no botão azul flutuante "Expandir Galeria"

---

## 🪟 Windows (PowerShell)

Se você estiver no Windows, pode usar estes comandos no PowerShell:

```powershell
# Terminal 1
npm install
npm run dev

# Terminal 2
cd server
npm install
npm start
```

---

## 🐛 Problemas Comuns

### ❌ "Port 3001 already in use"

Outro processo está usando a porta 3001. Mate o processo ou mude a porta:

```bash
# Windows PowerShell
netstat -ano | findstr :3001
taskkill /PID <número-do-pid> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

Ou altere a porta no arquivo `.env` na raiz:

```env
PORT=3002
VITE_ART_SERVER_URL=http://localhost:3002
```

### ❌ "Cannot GET /"

Você está tentando acessar o backend diretamente. O backend é apenas uma API.
Acesse o **frontend** em http://localhost:5173

### ❌ Obras não aparecem ao fazer upload

Certifique-se de que:
1. O servidor backend está rodando (http://localhost:3001/api/health deve funcionar)
2. O arquivo `.env` existe na raiz com `VITE_ART_SERVER_URL=http://localhost:3001`
3. Você reiniciou o frontend após criar o `.env`

---

## 🔄 Reiniciar Tudo

Se algo der errado, pare tudo e recomece:

```bash
# Pare os servidores com Ctrl+C em ambos terminais

# Limpe e reinstale
rm -rf node_modules server/node_modules package-lock.json server/package-lock.json
npm install
cd server && npm install && cd ..

# Inicie novamente
# Terminal 1: npm run dev
# Terminal 2: cd server && npm start
```

---

## 📚 Mais Informações

- Documentação completa: [README.md](./README.md)
- Sistema de uploads: [TEMPORARY_ARTWORKS.md](./TEMPORARY_ARTWORKS.md)
- Multiplayer: [MULTIPLAYER.md](./MULTIPLAYER.md)

---

## 🎉 Pronto!

Agora você está rodando o museu virtual completo localmente. Compartilhe o link com amigos conectados na mesma rede para testar o multiplayer!
