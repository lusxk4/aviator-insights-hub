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
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  await page.waitForTimeout(3000)

  const urlAposNav = page.url()
  logger.info(`📍 URL após navegação: ${urlAposNav}`)

  if (!urlAposNav.includes('/game/action/') && !urlAposNav.includes('aviator')) {
    throw new Error(`Redirecionado para URL inesperada: ${urlAposNav} — verifique se está logado`)
  }

  logger.info('✅ Página do Aviator detectada!')
  await waitForGameIframe(page)
}

async function waitForGameIframe(page: Page): Promise<void> {
  logger.info('⏳ Aguardando iframe do jogo carregar...')

  try {
    await page.waitForSelector('iframe', { timeout: 60000 })

    // Aguarda o iframe do jogo ter URL válida
    await page.waitForFunction(() => {
      const frames = Array.from(document.querySelectorAll('iframe'))
      return frames.some(f => f.src && f.src.includes('p-j-0-h.com'))
    }, { timeout: 60000 }).catch(() => {
      logger.warn('⚠️  Iframe do jogo não confirmado via src, continuando mesmo assim...')
    })

    await page.waitForTimeout(3000)

    const frames = page.frames()
    logger.info(`📦 Total de frames: ${frames.length}`)
    frames.forEach(f => logger.debug(`  → Frame: ${f.url()}`))

    logger.info('✅ Jogo carregado!')
  } catch {
    await page.screenshot({ path: 'logs/debug-iframe.png' }).catch(() => {})
    throw new Error('Iframe não encontrado — veja logs/debug-iframe.png')
  }
}