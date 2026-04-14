import { Page } from 'playwright'
import { logger } from '../utils/logger.js'
import { saveSession } from './launcher.js'

const LOGIN_TIMEOUT_MS = 120000
const GAME_URL = process.env.AVIATOR_DIRECT_URL || `${process.env.BET923_URL}/game/action/6770`

export async function login(page: Page): Promise<boolean> {
  logger.info('🔐 Verificando login...')

  const currentUrl = page.url()

  // ✅ Já está no jogo
  if (currentUrl.includes('/game/action/')) {
    logger.info('✅ Já está na página do jogo!')
    await saveSession()
    return true
  }

  // ✅ Está logado mas em outra página
  if (currentUrl.includes('/main/')) {
    logger.info('✅ Sessão ativa, navegando para o jogo...')
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await saveSession()
    return true
  }

  // ⚠️ Precisa logar manualmente
  logger.warn('━'.repeat(50))
  logger.warn('⚠️  Faça login manualmente no Firefox que abriu!')
  logger.warn(`👉 Após logar, o bot navega sozinho para o jogo`)
  logger.warn('━'.repeat(50))

  const inicio = Date.now()

  while (Date.now() - inicio < LOGIN_TIMEOUT_MS) {
    await page.waitForTimeout(5000)

    const url = page.url()

    if (url.includes('/game/action/')) {
      logger.info('✅ Já está na página do jogo!')
      await saveSession()
      return true
    }

    if (url.includes('/main/')) {
      logger.info('✅ Login detectado! Navegando para o jogo...')
      await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await saveSession()
      return true
    }

    const restante = Math.round((LOGIN_TIMEOUT_MS - (Date.now() - inicio)) / 1000)
    logger.info(`⏳ Aguardando login... (${restante}s restantes)`)
  }

  throw new Error('Timeout: login não realizado em 2 minutos')
}