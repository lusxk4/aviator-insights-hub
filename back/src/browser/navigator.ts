import { Page } from 'playwright'
import { logger } from '../utils/logger.js'

const GAME_URL = process.env.AVIATOR_DIRECT_URL || `${process.env.BET923_URL}/game/action/6770`

export async function navigateToAviator(page: Page): Promise<void> {
  logger.info('🛩️  Verificando página do Aviator...')

  const currentUrl = page.url()

  if (currentUrl.includes('/game/action/')) {
    logger.info(`✅ Já na página do jogo: ${currentUrl}`)
    await waitForGameIframe(page)
    return
  }

  logger.info(`🌐 Navegando para: ${GAME_URL}`)
  await page.goto(GAME_URL, {
    waitUntil: 'networkidle', // Espera as requisições estabilizarem
    timeout: 60000
  })

  // Pequena pausa para o carregamento dos scripts de redirecionamento
  await page.waitForTimeout(5000)

  const urlAposNav = page.url()
  logger.info(`📍 URL após navegação: ${urlAposNav}`)

  if (!urlAposNav.includes('/game/action/') && !urlAposNav.includes('aviator')) {
    // Tenta clicar em algum botão de "Entrar" ou similar se estiver na home por erro
    const isLoginNeeded = await page.isVisible('text="Login"').catch(() => false)
    if (isLoginNeeded) {
        throw new Error('Sessão expirada ou Login necessário. Verifique os cookies.')
    }
  }

  logger.info('✅ Página do Aviator detectada!')
  await waitForGameIframe(page)
}

async function waitForGameIframe(page: Page): Promise<void> {
  logger.info('⏳ Aguardando iframe do jogo carregar...')

  try {
    // 1. Espera por QUALQUER iframe que contenha indícios do jogo na URL
    // Aumentei o timeout para dar tempo do carregamento pesado do cassino
    await page.waitForFunction(() => {
      const allFrames = Array.from(document.querySelectorAll('iframe'));
      // Verifica recursivamente em todos os iframes da página
      return allFrames.some(f => {
        const src = f.src || '';
        return src.includes('p-j-0-h.com') || src.includes('aviator') || src.includes('spribe-apps');
      });
    }, { timeout: 60000 });

    // 2. Aguarda um tempo extra para garantir que o conteúdo interno do iframe carregou
    await page.waitForTimeout(5000);

    const frames = page.frames();
    const gameFrame = frames.find(f => 
      f.url().includes('p-j-0-h.com') || 
      f.url().includes('aviator') || 
      f.url().includes('spribe')
    );

    if (!gameFrame) {
      throw new Error('Iframe identificado no DOM mas não acessível via Playwright');
    }

    logger.info(`📦 Total de frames ativos: ${frames.length}`);
    logger.info(`🎮 Frame do jogo confirmado: ${gameFrame.url().substring(0, 60)}...`);
    logger.info('✅ Jogo carregado e pronto para interceptação!');

  } catch (err) {
    logger.error(`❌ Falha ao localizar o jogo: ${err.message}`);
    await page.screenshot({ path: 'logs/debug-iframe.png', fullPage: true }).catch(() => {});
    throw new Error('Iframe do jogo não carregou a tempo — veja logs/debug-iframe.png');
  }
}