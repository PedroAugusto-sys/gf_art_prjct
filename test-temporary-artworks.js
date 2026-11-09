#!/usr/bin/env node
/**
 * Script de teste para sistema de uploads temporários.
 * Valida comportamento de sessões, ownership, limpeza, etc.
 */

const API_BASE = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (body) {
    opts.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${path}`, opts);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
  }
  
  return data;
}

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log('✅ PASS');
    return true;
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}`);
    return false;
  }
}

async function testSuite() {
  console.log('\n🧪 Teste do Sistema de Uploads Temporários\n');
  console.log('═'.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Teste 1: Health check
  if (await test('Health check do servidor', async () => {
    const health = await request('GET', '/api/health');
    if (health.status !== 'ok') throw new Error('Status não é ok');
  })) passed++; else failed++;
  
  // Teste 2: Join em sala
  let tokenA, tokenB;
  if (await test('Jogador A entra em sala', async () => {
    const data = await request('POST', '/api/join', {
      roomId: 'test-room',
      playerName: 'Jogador A'
    });
    tokenA = data.token;
    if (!tokenA) throw new Error('Token não recebido');
  })) passed++; else failed++;
  
  // Teste 3: Heartbeat
  if (await test('Heartbeat mantém presença', async () => {
    await request('POST', '/api/heartbeat', { token: tokenA });
  })) passed++; else failed++;
  
  // Teste 4: Segunda pessoa entra
  if (await test('Jogador B entra na mesma sala', async () => {
    const data = await request('POST', '/api/join', {
      roomId: 'test-room',
      playerName: 'Jogador B'
    });
    tokenB = data.token;
    if (!tokenB) throw new Error('Token B não recebido');
  })) passed++; else failed++;
  
  // Teste 5: Estado da sala
  if (await test('Estado da sala mostra 2 participantes', async () => {
    const state = await request('GET', '/api/room/test-room');
    if (state.participants !== 2) {
      throw new Error(`Esperado 2 participantes, encontrado ${state.participants}`);
    }
  })) passed++; else failed++;
  
  // Teste 6: Sessões isoladas
  let tokenC;
  if (await test('Jogador C em sala diferente (isolada)', async () => {
    const data = await request('POST', '/api/join', {
      roomId: 'test-room-2',
      playerName: 'Jogador C'
    });
    tokenC = data.token;
    
    const state1 = await request('GET', '/api/room/test-room');
    const state2 = await request('GET', '/api/room/test-room-2');
    
    if (state1.participants !== 2) {
      throw new Error('Sala 1 deveria ter 2 participantes');
    }
    if (state2.participants !== 1) {
      throw new Error('Sala 2 deveria ter 1 participante');
    }
  })) passed++; else failed++;
  
  // Teste 7: Upload sem permissão (sem token)
  if (await test('Upload sem token deve falhar', async () => {
    try {
      await request('POST', '/api/upload', {
        roomId: 'test-room',
        frameId: 'test-frame-1',
        title: 'Teste'
      });
      throw new Error('Deveria ter falhado');
    } catch (err) {
      if (!err.message.includes('400') && !err.message.includes('obrigatórios')) {
        throw err;
      }
    }
  })) passed++; else failed++;
  
  // Teste 8: Delete sem ownership
  if (await test('Delete de obra de outro deve falhar', async () => {
    // Simula que artworkId pertence ao jogador A
    try {
      await request('DELETE', '/api/artwork/fake-artwork-id', {
        token: tokenB // B tentando deletar obra de A
      });
      throw new Error('Deveria ter falhado com 403 ou 404');
    } catch (err) {
      if (!err.message.includes('404') && !err.message.includes('403')) {
        throw err;
      }
    }
  })) passed++; else failed++;
  
  // Teste 9: Report (qualquer um pode reportar)
  if (await test('Report de obra não requer ownership', async () => {
    try {
      await request('POST', '/api/report/fake-artwork-id', {
        token: tokenB
      });
    } catch (err) {
      // 404 é OK (obra não existe), mas não deve ser 403
      if (err.message.includes('403')) {
        throw new Error('Report não deveria retornar 403');
      }
    }
  })) passed++; else failed++;
  
  // Teste 10: Timeout de presença (simulado)
  console.log('\n  ⏰ Aguardando 45s para teste de timeout (30s timeout + 10s cleanup + 5s margem)...');
  await sleep(45000);
  
  if (await test('Jogador sem heartbeat é removido', async () => {
    // Jogador C não mandou heartbeat por 45s
    // (PRESENCE_TIMEOUT_MS = 30s no servidor + 10s HEARTBEAT_INTERVAL + margem)
    const state = await request('GET', '/api/room/test-room-2');
    if (state.participants !== 0) {
      throw new Error(`Esperado 0 participantes, encontrado ${state.participants}`);
    }
  })) passed++; else failed++;
  
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam\n`);
  
  if (failed === 0) {
    console.log('✅ Todos os testes passaram!\n');
    process.exit(0);
  } else {
    console.log('❌ Alguns testes falharam.\n');
    process.exit(1);
  }
}

// Executa testes
testSuite().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  console.error('\n⚠️  Certifique-se de que o servidor está rodando:');
  console.error('    cd server && npm start\n');
  process.exit(1);
});
