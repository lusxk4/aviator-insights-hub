import { Page } from 'playwright'
import { logger } from '../utils/logger.js'

const LOGIN_TIMEOUT_MS = 120000 // 2 minutos para login manual

export async function login(page: Page): Promise<boolean> {
  logger.info('🔐 Verificando login...')

  const jaLogado = await isLoggedIn(page)
  if (jaLogado) {
    logger.info('✅ Já está logado!')
    return true
  }

  const url = process.env.BET923_URL!
  logger.info('🌐 Navegando para home...')

  await page.goto(`${url}/main/inicio`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })
  await page.waitForTimeout(4000)

  const logadoAposNav = await isLoggedIn(page)
  if (logadoAposNav) {
    logger.info('✅ Logado via sessão salva!')
    return true
  }

  // Aguardar login manual — fica verificando a cada 5s por até 2 minutos
  logger.warn('⚠️  Faça login manualmente no Chrome que abriu! Aguardando até 2 minutos...')
  logger.warn('👉 Entre no site, faça login e aguarde — o bot continua automaticamente!')

  const inicio = Date.now()
  while (Date.now() - inicio < LOGIN_TIMEOUT_MS) {
    await page.waitForTimeout(5000)

    const logado = await isLoggedIn(page)
    if (logado) {
      logger.info('✅ Login manual detectado! Continuando...')
      return true
    }

    const restante = Math.round((LOGIN_TIMEOUT_MS - (Date.now() - inicio)) / 1000)
    logger.info(`⏳ Aguardando login... (${restante}s restantes)`)
  }

  throw new Error('Timeout: login não realizado em 2 minutos')
}

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const selectors = [
      'button:has-text("Sacar")',
      'button:has-text("Saque")',
      'button:has-text("Depositar")',
      'a:has-text("Perfil")',
      '[class*="balance"]',
      '[class*="user-balance"]',
      '[class*="perfil"]',
      '[class*="profile"]',
      '.avatar',
      '.user-avatar',
    ]

    for (const selector of selectors) {
      const el = page.locator(selector).first()
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        logger.debug(`✅ Login detectado via: ${selector}`)
        return true
      }
    }
    return false
  } catch {
    return false
  }
}