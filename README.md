# Meu Museu

Galeria de arte multiplayer 3D construída com React Three Fiber e Playroom Kit.

## 🚀 Desenvolvimento Local

```bash
npm install
npm run dev
```

## 🎮 Configuração Multiplayer (Opcional)

O app funciona sem configuração, mas com limite de DAU (Daily Active Users) do Playroom Kit.

Para produção, configure um Game ID:

1. Crie uma conta gratuita em [joinplayroom.com](https://app.joinplayroom.com)
2. Crie um novo jogo no dashboard
3. Copie o Game ID

### Local (.env)

Crie arquivo `.env` na raiz:

```env
VITE_PLAYROOM_GAME_ID=seu-game-id-aqui
```

### Netlify (Produção)

Configure a variável de ambiente no Netlify:

1. Site settings → Build & deploy → Environment
2. Adicione:
   - **Nome**: `VITE_PLAYROOM_GAME_ID`
   - **Valor**: seu-game-id-aqui

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
