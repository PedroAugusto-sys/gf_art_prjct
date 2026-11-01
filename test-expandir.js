import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('📍 Navegando para http://localhost:5173');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Esperar carregar
  await page.waitForTimeout(2000);
  
  console.log('📸 Screenshot 1: Tela inicial');
  await page.screenshot({ path: '/workspace/artifacts/01-inicial.png', fullPage: false });
  
  // Clicar em "Entrar" (se houver)
  try {
    const entrarButton = await page.locator('button:has-text("Entrar")').first();
    if (await entrarButton.isVisible({ timeout: 2000 })) {
      console.log('🖱️ Clicando em "Entrar"');
      await entrarButton.click();
      await page.waitForTimeout(2000);
      console.log('📸 Screenshot 2: Após entrar');
      await page.screenshot({ path: '/workspace/artifacts/02-apos-entrar.png', fullPage: false });
    }
  } catch (e) {
    console.log('⚠️ Botão "Entrar" não encontrado (já no museu?)');
  }
  
  // Verificar console logs
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[CONSOLE ${type.toUpperCase()}]`, msg.text());
    }
  });
  
  // Procurar estado annexCount no DOM/console
  const annexCountBefore = await page.evaluate(() => {
    return window.__ZUSTAND_STORE__?.getState?.()?.annexCount || 0;
  });
  console.log(`📊 annexCount ANTES: ${annexCountBefore}`);
  
  // Movimentar para próximo da parede norte (onde está o painel Expandir)
  // Simular caminhada pressionando W por alguns segundos
  console.log('🚶 Movendo para frente (W) por 3 segundos');
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  
  console.log('📸 Screenshot 3: Após andar para frente');
  await page.screenshot({ path: '/workspace/artifacts/03-apos-andar.png', fullPage: false });
  
  // Tentar clicar no painel Expandir
  // O painel pode estar em HTML overlay ou ser um mesh 3D
  try {
    console.log('🔍 Procurando painel "Expandir"...');
    
    // Tentar clicar em qualquer elemento com texto "Expandir"
    const expandirElements = await page.locator('text=Expandir').all();
    console.log(`📌 Encontrou ${expandirElements.length} elementos com "Expandir"`);
    
    if (expandirElements.length > 0) {
      console.log('🖱️ Clicando no primeiro elemento "Expandir"');
      await expandirElements[0].click({ timeout: 2000 });
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot 4: Após clicar em Expandir (elemento HTML)');
      await page.screenshot({ path: '/workspace/artifacts/04-apos-clicar-expandir.png', fullPage: false });
    } else {
      console.log('⚠️ Nenhum elemento HTML com "Expandir" encontrado');
      console.log('🎯 Tentando clicar no centro da tela (pode ser mesh 3D)');
      await page.mouse.click(960, 540);
      await page.waitForTimeout(1000);
      
      console.log('📸 Screenshot 4: Após clicar no centro');
      await page.screenshot({ path: '/workspace/artifacts/04-apos-clicar-centro.png', fullPage: false });
    }
    
    // Verificar se modal apareceu
    const modalVisible = await page.locator('text=Expandir galeria').isVisible({ timeout: 2000 }).catch(() => false);
    if (modalVisible) {
      console.log('✅ Modal "Expandir galeria" APARECEU');
      console.log('📸 Screenshot 5: Modal visível');
      await page.screenshot({ path: '/workspace/artifacts/05-modal-visivel.png', fullPage: false });
      
      // Clicar em "Expandir agora"
      const expandirAgoraButton = await page.locator('button:has-text("Expandir agora")').first();
      if (await expandirAgoraButton.isVisible({ timeout: 1000 })) {
        console.log('🖱️ Clicando em "Expandir agora"');
        await expandirAgoraButton.click();
        await page.waitForTimeout(2000);
        
        console.log('📸 Screenshot 6: Após clicar "Expandir agora"');
        await page.screenshot({ path: '/workspace/artifacts/06-apos-expandir-agora.png', fullPage: false });
      }
    } else {
      console.log('❌ Modal "Expandir galeria" NÃO apareceu');
    }
    
  } catch (e) {
    console.log('❌ Erro ao tentar expandir:', e.message);
    console.log('📸 Screenshot de erro');
    await page.screenshot({ path: '/workspace/artifacts/99-erro.png', fullPage: false });
  }
  
  // Verificar annexCount DEPOIS
  const annexCountAfter = await page.evaluate(() => {
    return window.__ZUSTAND_STORE__?.getState?.()?.annexCount || 0;
  });
  console.log(`📊 annexCount DEPOIS: ${annexCountAfter}`);
  
  if (annexCountAfter > annexCountBefore) {
    console.log('✅ annexCount AUMENTOU! Expansão funcionou.');
  } else {
    console.log('❌ annexCount NÃO MUDOU. Expansão NÃO funcionou.');
  }
  
  // Screenshot final
  console.log('📸 Screenshot final');
  await page.screenshot({ path: '/workspace/artifacts/07-final.png', fullPage: false });
  
  // HTML snapshot
  const html = await page.content();
  fs.writeFileSync('/workspace/artifacts/page.html', html);
  console.log('💾 HTML snapshot salvo em artifacts/page.html');
  
  await browser.close();
  console.log('✅ Teste concluído');
})();
