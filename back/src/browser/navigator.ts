import { Page } from 'playwright'
import { logger } from '../utils/logger.js'
import { retry } from '../utils/retry.js'

export async function navigateToAviator(page: Page): Promise<void> {
  logger.info('🛩️  Navegando para o Aviator...')

  const url = process.env.BET923_URL!

  await retry(async () => {
    // Navegar para home primeiro
    logger.info('📄 Carregando home...')
    await page.goto(`${url}/main/inicio`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    await page.waitForTimeout(4000)

    // Tirar screenshot para ver o que está na tela
    await page.screenshot({ path: 'logs/debug-home.png' })
    logger.info('📸 Screenshot da home salvo em logs/debug-home.png')

    // Tentar clicar no Aviator
    const aviatorSelectors = [
      'a:has-text("Aviator")',
      'div:has-text("Aviator")',
      'span:has-text("Aviator")',
      'img[alt*="aviator" i]',
      'img[src*="aviator" i]',
      '[class*="aviator" i]',
      '[data-game*="aviator" i]',
      '[title*="aviator" i]',
    ]

    for (const selector of aviatorSelectors) {
      const el = page.locator(selector).first()
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        logger.info(`✅ Aviator encontrado via: ${selector}`)
        await el.click()
        await page.waitForTimeout(5000)
        return
      }
    }

    // Tentar campo de busca
    logger.warn('⚠️  Aviator não encontrado no menu, tentando busca...')
    const searchSelectors = [
      'input[placeholder*="buscar" i]',
      'input[placeholder*="search" i]',
      'input[placeholder*="pesquisar" i]',
      'input[type="search"]',
      '[class*="search"] input',
    ]

    for (const sel of searchSelectors) {
      const searchInput = page.locator(sel).first()
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill('Aviator')
        await page.waitForTimeout(2000)
        await page.screenshot({ path: 'logs/debug-search.png' })

        const result = page.locator('a:has-text("Aviator"), div:has-text("Aviator")').first()
        if (await result.isVisible({ timeout: 3000 }).catch(() => false)) {
          await result.click()
          await page.waitForTimeout(5000)
          return
        }
      }
    }

    await page.screenshot({ path: 'logs/debug-not-found.png' })
    throw new Error('Aviator não encontrado — veja logs/debug-not-found.png')

  }, 3, 5000, 'Navegação para Aviator')

  await waitForGameIframe(page)
}

async function waitForGameIframe(page: Page): Promise<void> {
  logger.info('⏳ Aguardando iframe do jogo...')

  try {
    await page.waitForSelector('iframe', { timeout: 60000 })
    await page.waitForTimeout(8000)

    const frames = page.frames()
    logger.info(`📦 Total de frames: ${frames.length}`)
    frames.forEach(f => logger.debug(`  → Frame: ${f.url()}`))

    logger.info('✅ Iframe do jogo carregado!')
  } catch {
    await page.screenshot({ path: 'logs/debug-iframe.png' })
    throw new Error('Iframe não encontrado — veja logs/debug-iframe.png')
  }
}