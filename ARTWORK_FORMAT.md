# 🎨 Formato de Artwork (Obras Compartilhadas)

## Visão Geral

As obras de arte publicadas pelos usuários são compartilhadas via **Playroom Kit** (multiplayer state sync) sem necessidade de backend/database. O formato foi otimizado para minimizar o tamanho dos dados transmitidos pela rede.

---

## 📦 Formato da Obra

Cada artwork é um objeto JSON com os seguintes campos:

```typescript
interface Artwork {
  id: string           // Identificador único: "community-{timestamp}-{random}"
  frameId: string      // ID do frame onde está publicada (ex: "community-1", "annex1-2")
  dataUrl: string      // Data URL WebP comprimido (formato: "data:image/webp;base64,...")
  title: string        // Título da obra (padrão: "Sem título")
  author: string       // Nome do autor (padrão: "Anônimo")
  authorId: string     // ID estável do autor (localStorage: "gf-author-id")
  timestamp: number    // Unix timestamp da publicação (Date.now())
}
```

### Exemplo:

```json
{
  "id": "community-1793552104391-x7k2m",
  "frameId": "community-1",
  "dataUrl": "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAw...",
  "title": "Pôr do Sol",
  "author": "Pedro",
  "authorId": "author-1793551234567-abc123",
  "timestamp": 1793552104391
}
```

---

## 🗜️ Compressão da Imagem

### Especificações:

- **Formato**: WebP (melhor compressão que JPEG)
- **Qualidade**: 75% (balanço entre qualidade visual e tamanho)
- **Redimensionamento**: Lado maior = 480px (mantém aspect ratio)
- **Tamanho típico**: 15-40 KB por artwork (vs 80-150 KB com JPEG)

### Vantagens do WebP:

- ✅ **30-40% menor** que JPEG com qualidade equivalente
- ✅ Suportado por todos os navegadores modernos (Chrome, Firefox, Safari, Edge)
- ✅ Melhor para gradientes e áreas de cor sólida (comum em fotos e arte digital)

### Código de Compressão:

```javascript
// src/components/EmptyFrame.jsx
async function resizeImageToWebP(file, maxSize = 480) {
  // Lê arquivo → redimensiona → converte para WebP
  // Retorna data URL pronto para usar como src de <img> ou THREE.Texture
}
```

---

## 🌐 Sincronização via Playroom

### Estado Global da Galeria:

```javascript
// Estrutura do estado sincronizado
{
  annexCount: number,        // Quantas salas anexas foram expandidas (0-2)
  artworks: Artwork[]        // Array de todas as obras publicadas
}
```

### Fluxo de Publicação:

1. **Usuário escolhe imagem** → modal de upload
2. **Compressão local** → `resizeImageToWebP()` → data URL WebP
3. **Atualização local** → `addCommunityArtwork()` (Zustand store)
4. **Sincronização remota** → `publishGalleryState()` → Playroom `roomSetState('gallery', ...)`
5. **Outros jogadores recebem** → `GallerySync.jsx` escuta mudanças → atualiza store local
6. **Renderização** → `EmptyFrame.jsx` carrega textura via `THREE.Texture(img)`

### Late Joiners (Jogadores que Entram Depois):

- ✅ **Estado inicial carregado**: `getInitialGalleryState()` busca `roomGetState('gallery')`
- ✅ **Todas as obras visíveis**: Array `artworks[]` já contém todas as publicações
- ✅ **Sem delay**: Obras aparecem imediatamente após entrar no museu

---

## 💾 Backup Local (localStorage)

Além da sincronização via Playroom, cada usuário mantém backup local das **suas próprias obras**:

```javascript
// localStorage key: "gf-my-artworks"
[
  { id, frameId, dataUrl, title, author, authorId, timestamp },
  ...
]
```

### Finalidade:

- ✅ Persistência entre sessões (mesmo se desconectar)
- ✅ Recuperação se o Playroom estiver offline
- ✅ Não afeta outros jogadores (apenas local)

---

## 📏 Limites e Considerações

### Tamanho dos Dados:

- **WebP 480px @ 75%**: ~15-40 KB por artwork
- **Playroom state limit**: ~1 MB total (suficiente para ~25-50 artworks)
- **Frames disponíveis**: 4 (sala principal) + 8 (2 salas anexas) = 12 slots máximo

### Se o Limite Fosse Atingido (improvável):

- **Solução 1**: Reduzir qualidade WebP (75% → 60%)
- **Solução 2**: Reduzir tamanho (480px → 360px)
- **Solução 3**: Implementar "oldest first replacement" (apaga obras antigas automaticamente)

**Na prática**: Com 12 slots e ~30 KB/artwork, uso total = ~360 KB (bem abaixo do limite)

---

## 🔧 Implementação Técnica

### Arquivos Relevantes:

1. **`src/components/EmptyFrame.jsx`**
   - `resizeImageToWebP()`: Compressão da imagem
   - `handleFileSelect()`: Lógica de upload e sincronização
   - `useEffect()`: Carregamento de textura 3D via `THREE.Texture`

2. **`src/components/GallerySync.jsx`**
   - `useEffect()`: Escuta mudanças no estado Playroom
   - Atualiza `communityArtworks` no Zustand store

3. **`src/systems/multiplayer.js`**
   - `publishGalleryState()`: Publica estado via `roomSetState('gallery', ...)`
   - `getInitialGalleryState()`: Carrega estado inicial via `roomGetState('gallery')`

4. **`src/store.js` (Zustand)**
   - `communityArtworks`: Array de obras no estado global
   - `addCommunityArtwork()`, `updateCommunityArtwork()`, `setCommunityArtworks()`: Mutators

---

## ✅ Testes Recomendados

### Teste 1: Publicação Local

1. Entrar no museu
2. Publicar obra em frame vazio
3. ✅ Imagem aparece imediatamente no quadro 3D

### Teste 2: Sincronização Multiplayer

1. Abrir dois navegadores na mesma sala
2. Publicar obra no navegador A
3. ✅ Navegador B vê a obra automaticamente

### Teste 3: Late Joiner

1. Publicar 2-3 obras no navegador A
2. Entrar com navegador B (late joiner)
3. ✅ Navegador B vê todas as obras já publicadas

### Teste 4: Persistência Local

1. Publicar obra
2. Recarregar a página (F5)
3. ✅ Obra ainda aparece (restaurada do localStorage)

---

## 📊 Métricas de Performance

### Compressão (imagem 1920x1080 de exemplo):

- **Original PNG**: ~1.2 MB
- **JPEG 85%**: ~120 KB
- **WebP 75%**: ~35 KB ✅ (3.4x menor que JPEG)

### Tempo de Processamento:

- Redimensionamento + compressão: ~100-300ms (aceitável no upload)
- Carregamento de textura 3D: ~50-150ms (imperceptível)

### Uso de Rede:

- Publicar 1 artwork: ~35 KB transmitido via Playroom
- Late joiner com 10 artworks: ~350 KB carregados

---

## 🚀 Melhorias Futuras (Opcional)

Se o projeto crescer e precisar otimizar ainda mais:

1. **Lazy loading**: Carregar texturas apenas quando o quadro estiver próximo da câmera
2. **Chunking**: Dividir data URLs grandes em chunks menores para Playroom
3. **CDN**: Hospedar imagens em CDN e sincronizar apenas URLs (requer backend)
4. **IndexedDB**: Armazenar artworks em IndexedDB em vez de localStorage (sem limite de 5-10 MB)

**Nota**: Nenhuma dessas melhorias é necessária agora; o sistema atual é suficiente para o escopo do projeto.
