import { Page } from 'playwright'
import { logger } from '../utils/logger.js'
import { saveSession } from './launcher.js'

const LOGIN_TIMEOUT_MS = 120000
const GAME_URL = process.env.AVIATOR_DIRECT_URL || `${process.env.BET923_URL}/game/action/6770`

export async function login(page: Page): Promise<boolean> {
  logger.info('🔐 Verificando login...')

  // Aguarda a página estabilizar
  await page.waitForTimeout(4000)

  const loginModalVisible = await isLoginModalVisible(page)

  if (loginModalVisible) {
    logger.info('🔑 Modal de login detectado — iniciando login automático...')
    const phone = process.env.BET923_PHONE
    const password = process.env.BET923_PASSWORD

    if (phone && password) {
      try {
        return await attemptAutoLogin(page, phone, password)
      } catch (err) {
        logger.warn(`⚠️  Login automático falhou: ${err} — aguardando login manual...`)
        return await waitForManualLogin(page)
      }
    }
  }

  const currentUrl = page.url()
  if (currentUrl.includes('/game/action/') || currentUrl.includes('/main/')) {
    logger.info('✅ Sessão ativa!')
    await saveSession()
    return true
  }

  return await waitForManualLogin(page)
}

async function isLoginModalVisible(page: Page): Promise<boolean> {
  try {
    const phoneField = page.locator('input[placeholder="Telefone"]').first()
    if (await phoneField.isVisible({ timeout: 3000 })) return true
    const loginTitle = page.locator('text=Faça login na sua conta').first()
    if (await loginTitle.isVisible({ timeout: 1000 })) return true
    return false
  } catch {
    return false
  }
}

async function attemptAutoLogin(page: Page, phone: string, password: string): Promise<boolean> {
  // Preenche telefone
  const phoneInput = page.locator('input[placeholder="Telefone"]').first()
  await phoneInput.waitFor({ state: 'visible', timeout: 10000 })
  await phoneInput.click({ clickCount: 3 })
  await phoneInput.fill(phone)
  logger.info(`📱 Telefone preenchido: ${phone}`)

  await page.waitForTimeout(300)

  // Preenche senha
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.waitFor({ state: 'visible', timeout: 5000 })
  await passwordInput.click({ clickCount: 3 })
  await passwordInput.fill(password)
  logger.info('🔑 Senha preenchida')

  await page.waitForTimeout(500)

  // Tenta clicar no botão — com fallback para pressionar Enter
  let submitted = false
  try {
    // Tenta qualquer botão verde/submit visível no modal
    const submitBtn = page.locator('button:has-text("Entrar"), button[type="submit"]').last()
    await submitBtn.waitFor({ state: 'visible', timeout: 3000 })
    await submitBtn.click()
    submitted = true
    logger.info('🚀 Clicou em Entrar')
  } catch {
    // Fallback: pressiona Enter no campo de senha
    await passwordInput.press('Enter')
    submitted = true
    logger.info('🚀 Enter pressionado no campo de senha')
  }

  if (!submitted) throw new Error('Não foi possível submeter o formulário')

  // Aguarda o modal fechar como confirmação de sucesso
  logger.info('⏳ Aguardando confirmação do login...')
  const success = await page.locator('text=Faça login na sua conta')
    .waitFor({ state: 'hidden', timeout: 25000 })
    .then(() => true)
    .catch(() => false)

  if (!success) {
    throw new Error('Modal não fechou — credenciais incorretas ou site lento')
  }

  logger.info('✅ Login confirmado! Aguardando página carregar...')
  await page.waitForTimeout(3000)

  // Navega para o jogo se necessário
  const finalUrl = page.url()
  if (!finalUrl.includes('/game/action/')) {
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3000)
  }

  await saveSession()
  logger.info('✅ Login automático concluído!')
  return true
}

async function waitForManualLogin(page: Page): Promise<boolean> {
  logger.warn('━'.repeat(50))
  logger.warn('⚠️  Faça login manualmente no Firefox que abriu!')
  logger.warn('👉 Após logar, o bot navega sozinho para o jogo')
  logger.warn('━'.repeat(50))

  const inicio = Date.now()

  while (Date.now() - inicio < LOGIN_TIMEOUT_MS) {
    await page.waitForTimeout(3000)

    const modalAinda = await isLoginModalVisible(page)
    if (!modalAinda) {
      await page.waitForTimeout(2000)
      const url = page.url()
      if (url.includes('/game/action/')) {
        logger.info('✅ Login manual detectado! Já no jogo.')
        await saveSession()
        return true
      }
      if (url.includes('/main/')) {
        logger.info('✅ Login manual detectado! Navegando para o jogo...')
        await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await saveSession()
        return true
      }
    }

    const restante = Math.round((LOGIN_TIMEOUT_MS - (Date.now() - inicio)) / 1000)
    logger.info(`⏳ Aguardando login... (${restante}s restantes)`)
  }

  throw new Error('Timeout: login não realizado em 2 minutos')
}