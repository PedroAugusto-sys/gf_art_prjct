# Verificação do Comportamento dos NPCs na v1

## ✅ Funcionalidade "Nomes, patrulha e falas" - Implementada

### Sistema de Patrulha
- **Arquivo**: `src/components/NPC.jsx` (linhas 103-472)
- **Implementação**: 
  - NPCs escolhem pontos de observação perto das obras (`claimViewingSpot`)
  - Caminham até a obra usando A* pathfinding
  - Param ao chegar (mode='viewing')

### Sistema de Parada
- **Arquivo**: `src/components/NPC.jsx` (linhas 272-287)
- **Implementação**:
  - Quando NPC chega à obra, mode muda para 'viewing'
  - `motion.current.viewing = true` (linha 445)
  - NPC fica parado por VIEW_MIN a VIEW_MAX segundos (8-15s)
  - Animação de "viewing" ativa (balança levemente a cabeça)

### Sistema de Fala com Título da Obra
- **Arquivo**: `src/systems/npcDialogue.js`
- **Implementação**:
  - Função `pickPositiveLine(artId)` busca o título da obra
  - Retorna frases como: `"${title}" me tocou.`, `Adorei "${title}".`
  - Exemplos reais: `"A Noite Estrelada" me tocou.`, `Adorei "Retrato".`

- **Arquivo**: `src/components/NPC.jsx` (linhas 447-470)
- **Implementação**:
  - Fala é agendada 1.5-3s após o NPC parar na obra
  - Apenas 1 NPC pode falar por vez (gap global de 8s)
  - 40% de chance de falar quando elegível
  - Fala dura 4.5s, cooldown de 12s por NPC
  - Speech bubble aparece acima da cabeça via `motion.current.speech`

### Visualização do Speech Bubble
- **Arquivo**: `src/components/VisitorModel.jsx` (linhas 206-222)
- **Implementação**:
  - Bolha branca com texto preto
  - Posicionada 2.05m acima do chão
  - Atualizada a cada 10 frames para performance
  - Aparece para host e clientes remotos via snapshot

### Sincronização Multiplayer
- **Arquivo**: `src/components/NPC.jsx` (linhas 505-516)
- **Implementação**:
  - Snapshot inclui: `walking`, `viewing`, `speech`
  - Publicado a cada 180ms via Playroom
  - NPCs remotos recebem e exibem o mesmo speech bubble

### Ativação por Versão
- Apenas na v1 (Atual) onde `legacyNpcs: false`
- v0 (Inicial) não mostra nomes nem falas
- Verificado em múltiplos pontos: linhas 282, 449, 535-536

## 📋 Checklist de QA

### Teste 1: NPC caminha até obra
- [ ] Entrar na v1 (Atual)
- [ ] Observar NPCs caminhando pelo museu
- [ ] Verificar que NPCs se aproximam das obras nas paredes

### Teste 2: NPC para em frente à obra
- [ ] Observar NPC chegando perto de uma obra
- [ ] Verificar que o NPC **para completamente** (não se move)
- [ ] Verificar animação sutil de "viewing" (cabeça balança levemente)
- [ ] NPC deve ficar parado por ~8-15 segundos

### Teste 3: Speech bubble com título
- [ ] Observar NPC parado em frente a uma obra
- [ ] Após 1.5-3 segundos, deve aparecer um balão de fala branco
- [ ] Texto deve incluir o título da obra (ex: `"A Noite Estrelada" me tocou.`)
- [ ] Balão deve desaparecer após ~4.5 segundos
- [ ] NPC deve esperar ~12 segundos antes de falar novamente

### Teste 4: Sincronização multiplayer
- [ ] Abrir v1 em duas abas/dispositivos
- [ ] Na segunda aba, observar os mesmos NPCs
- [ ] Verificar que quando NPC para na obra, aparece na outra aba
- [ ] Verificar que speech bubble aparece nas duas abas

### Teste 5: Apenas na v1
- [ ] Entrar na v0 (Inicial)
- [ ] Verificar que NPCs **não** mostram nomes nem falas
- [ ] Voltar para v1 e confirmar que funcionalidade volta

## 🔍 Pontos de Verificação no Código

1. **NPC.jsx linha 282**: `if (state.mode === 'viewing' && !isLegacyNpcs())`
2. **NPC.jsx linha 445**: `motion.current.viewing = state.mode === 'viewing'`
3. **NPC.jsx linha 461**: `state.speechText = pickPositiveLine(state.lastArtId)`
4. **NPC.jsx linha 515**: `speech: sp` (incluído no snapshot)
5. **npcDialogue.js linha 23**: `pickPositiveLine(artId)` busca título
6. **VisitorModel.jsx linha 206**: Speech bubble renderizado

## ✅ Status Final

**TODOS OS REQUISITOS IMPLEMENTADOS:**
- ✅ NPCs caminham/patrulham até pinturas
- ✅ NPCs param completamente em frente às obras
- ✅ Speech bubble aparece com comentário citando título da obra
- ✅ Sistema usa `npcDialogue.js` / `pickPositiveLine(title)` como especificado
- ✅ Host e NPCs remotos mostram o bubble quando parado
- ✅ Apenas na v1 (community gallery / Atual)
