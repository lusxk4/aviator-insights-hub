import { Browser, BrowserContext, Page, firefox } from 'playwright'
import { logger } from '../utils/logger.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_PATH = path.join(__dirname, '../../session.json')
const GAME_URL = process.env.AVIATOR_DIRECT_URL || `${process.env.BET923_URL}/game/action/6770`

let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null

// ✅ Script injetado em TODOS os frames (incluindo cross-origin) antes do JS deles rodar
const WS_INTERCEPTOR_SCRIPT = `(function() {
  if (window.__wsInterceptorActive) return;
  window.__wsInterceptorActive = true;
  window.__wsMessages = [];

  var OriginalWebSocket = window.WebSocket;

  var InterceptedWebSocket = function(url, protocols) {
    var ws = protocols
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    var wsUrl = url.toString();
    window.__lastWSUrl = wsUrl;

    ws.addEventListener('message', function(event) {
      try {
        var payload = typeof event.data === 'string' ? event.data : '[binary]';
        window.__wsMessages.push({
          url: wsUrl,
          payload: payload.substring(0, 2000),
          timestamp: new Date().toISOString()
        });
        if (window.__wsMessages.length > 100) {
          window.__wsMessages.shift();
        }
      } catch(e) {}
    });

    return ws;
  };

  InterceptedWebSocket.prototype = OriginalWebSocket.prototype;
  InterceptedWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  InterceptedWebSocket.OPEN = OriginalWebSocket.OPEN;
  InterceptedWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  InterceptedWebSocket.CLOSED = OriginalWebSocket.CLOSED;

  window.WebSocket = InterceptedWebSocket;
})()`

export async function launchBrowser(): Promise<Page> {
  logger.info('🚀 Iniciando Firefox...')

  const headless = process.env.HEADLESS === 'true'
  const storageState = fs.existsSync(SESSION_PATH) ? SESSION_PATH : undefined

  if (storageState) {
    logger.info('💾 Sessão salva encontrada, carregando...')
  } else {
    logger.info('🆕 Nenhuma sessão salva, iniciando do zero')
  }

  browser = await firefox.launch({
    headless,
    firefoxUserPrefs: {
      'media.volume_scale': '0.0',
    }
  })

  context = await browser.newContext({
    storageState,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    viewport: { width: 1280, height: 720 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ignoreHTTPSErrors: true
  })

  // Anti-detecção de webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  // ✅ Interceptor WS injetado via context — cobre a página principal E todos os iframes,
  // incluindo cross-origin, antes de qualquer JS do jogo rodar
  await context.addInitScript(WS_INTERCEPTOR_SCRIPT)

  page = await context.newPage()

  logger.info(`🌐 Abrindo direto em: ${GAME_URL}`)
  await page.goto(GAME_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  logger.info('✅ Firefox iniciado!')
  return page
}

export async function saveSession(): Promise<void> {
  if (!context) return
  try {
    await context.storageState({ path: SESSION_PATH })
    logger.info('💾 Sessão salva com sucesso')
  } catch (err) {
    logger.warn(`⚠️  Falha ao salvar sessão: ${err}`)
  }
}

export async function getPage(): Promise<Page> {
  if (!page) throw new Error('Navegador não iniciado')
  return page
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
    context = null
    page = null
    logger.info('🔴 Navegador fechado')
  }
}