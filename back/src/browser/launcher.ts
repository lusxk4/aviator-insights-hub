import { Browser, BrowserContext, Page, chromium } from 'playwright'
import { logger } from '../utils/logger.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Perfil real do Chrome do usuário (já tem cookies/sessão)
const CHROME_USER_DATA = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data')

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_PATH || ''
].filter(Boolean)

function findChrome(): string {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      logger.info(`✅ Chrome encontrado em: ${p}`)
      return p
    }
  }
  throw new Error('Chrome não encontrado! Defina CHROME_PATH no .env')
}

let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null

export async function launchBrowser(): Promise<Page> {
  logger.info('🚀 Iniciando Chrome com perfil real...')

  const executablePath = findChrome()

  // Usar perfil real do Chrome — já tem sessão, cookies, login salvo
  browser = await chromium.launchPersistentContext(CHROME_USER_DATA, {
    executablePath,
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      '--profile-directory=Default',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  }) as unknown as Browser

  // Com launchPersistentContext o retorno é BrowserContext direto
  context = browser as unknown as BrowserContext
  page = await (browser as unknown as BrowserContext).newPage()

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  logger.info('✅ Chrome iniciado com perfil real')
  return page
}

export async function saveSession() {
  // Não precisa salvar sessão — o perfil real já persiste tudo
  logger.info('💾 Usando perfil real — sessão já persistida')
}

export async function getPage(): Promise<Page> {
  if (!page) throw new Error('Navegador não iniciado')
  return page
}

export async function closeBrowser() {
  if (context) {
    await (context as unknown as BrowserContext).close()
    browser = null
    context = null
    page = null
    logger.info('🔴 Navegador fechado')
  }
}