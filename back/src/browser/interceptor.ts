import { Page, Frame } from 'playwright'
import { logger } from '../utils/logger.js'
import { candleService } from '../services/candleService.js'
import { saveCandle } from '../services/supabaseService.js'

const rawFrames: { url: string; payload: string; timestamp: string }[] = []
const MAX_RAW_FRAMES = 50
const detectedWSUrls: string[] = []

export function getRawFrames() {
  return rawFrames
}

export function getDetectedWSUrls(): string[] {
  return detectedWSUrls
}

/**
 * Inicia a interceptação de WebSockets e monitoramento de iframes
 */
export async function startInterception(page: Page): Promise<void> {
  logger.info('🔍 Iniciando interceptação de WebSockets...')

  // Monitoramento nativo
  attachWSListener(page, 'main')

  // Reinicia o iframe do jogo para injetar o script antes do WS conectar
  await forceReloadGameIframe(page)

  // Polling em frames existentes
  for (const frame of page.frames()) {
    tryStartPolling(frame)
  }

  // Monitora novos frames
  page.on('frameattached', async (frame) => {
    await new Promise(r => setTimeout(r, 500))
    tryStartPolling(frame)
  })

  page.on('framenavigated', async (frame) => {
    await new Promise(r => setTimeout(r, 200))
    tryStartPolling(frame)
  })

  logger.info('✅ Interceptação ativa e aguardando crash!')
}

async function forceReloadGameIframe(page: Page): Promise<void> {
  try {
    logger.info('🔄 Recarregando iframe do jogo para ativar interceptor...')
    await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'))
      const gameIframe = iframes.find(f =>
        f.src && (f.src.includes('p-j-0-h.com') || f.src.includes('aviator') || f.src.includes('spribe'))
      )
      if (gameIframe) {
        const src = gameIframe.src
        gameIframe.src = ''
        setTimeout(() => { gameIframe.src = src }, 100)
      }
    })
    await page.waitForTimeout(5000)
  } catch (err) {
    logger.warn(`⚠️ Erro ao recarregar iframe: ${err}`)
  }
}

function isGameFrame(url: string): boolean {
  return url.includes('p-j-0-h.com') || url.includes('aviator') || url.includes('spribe')
}

function tryStartPolling(frame: Frame): void {
  const url = frame.url()
  if (!url || url === 'about:blank' || !isGameFrame(url)) return
  logger.info(`🎮 Polling ativo no frame: ${url.substring(0, 50)}...`)
  startPolling(frame)
}

function startPolling(frame: Frame): void {
  let lastProcessedIndex = 0
  const interval = setInterval(async () => {
    try {
      if (frame.isDetached()) return clearInterval(interval)

      const messages = await frame.evaluate((fromIndex: number) => {
        const msgs = (window as any).__wsMessages || []
        return msgs.slice(fromIndex)
      }, lastProcessedIndex)

      if (messages && messages.length > 0) {
        lastProcessedIndex += messages.length
        for (const msg of messages) {
          tryParseCandle(msg.payload, msg.url, msg.isBinary === true)
        }
      }
    } catch (err) { /* ignore silent errors during navigation */ }
  }, 300)
}

function attachWSListener(page: Page, label: string): void {
  page.on('websocket', ws => {
    const wsUrl = ws.url()
    if (!detectedWSUrls.includes(wsUrl)) detectedWSUrls.push(wsUrl)

    ws.on('framereceived', frame => {
      const payload = frame.payload.toString()
      tryParseCandle(payload, wsUrl, false)
    })
  })
}

// ─── Lógica de Decodificação e Validação de Crash ──────────────────────────────

function tryParseCandle(payload: string, wsUrl: string, isBinary: boolean): void {
  try {
    let multiplicador: number | null = null
    let rodadaId: string = `round_${Date.now()}`

    if (isBinary) {
      const buf = Buffer.from(payload, 'base64')
      if (buf.length < 10) return 

      // Filtro crítico: pacotes de "voo" (avião subindo) costumam ser pequenos ou 
      // não conter a assinatura de encerramento da Spribe.
      multiplicador = extractCrashFromBinary(buf)
    } else {
      if (!payload || payload.length < 5) return
      try {
        const data = JSON.parse(payload)
        multiplicador = extractMultiplierFromJson(data)
        rodadaId = extractRoundId(data)
      } catch {
        const jsonMatch = payload.match(/\{.*\}/s)
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0])
          multiplicador = extractMultiplierFromJson(data)
          rodadaId = extractRoundId(data)
        }
      }
    }

    // Só salva se o multiplicador for válido e não for um tick de subida
    if (multiplicador !== null && multiplicador >= 1) {
      // Pequeno debounce/filtro para evitar salvar valores intermediários (ex: 5.07, 5.08)
      // O valor final do crash no Aviator geralmente vem em pacotes com metadados de "history"
      logger.info(`🕯️ Vela detectada: ${multiplicador.toFixed(2)}x (URL: ${wsUrl.split('?')[0]})`)
      const candle = candleService.addCandle(multiplicador, rodadaId)
      saveCandle(candle)
    }
  } catch (err) {
    logger.debug(`Erro no parser: ${err}`)
  }
}

function extractCrashFromBinary(buf: Buffer): number | null {
  const CRASH_MARKERS = ['crash', 'maxMultiplier', 'coefficient', 'multiplier']
  
  for (const marker of CRASH_MARKERS) {
    const idx = buf.indexOf(marker, 0, 'utf8')
    if (idx !== -1) {
      // No protocolo Spribe, o double (8 bytes) vem logo após o marcador
      for (let offset = marker.length; offset <= marker.length + 2; offset++) {
        const pos = idx + offset
        if (pos + 8 > buf.length) continue
        const val = buf.readDoubleBE(pos)
        // Filtro: No Aviator, multiplicadores são raramente números redondos perfeitos 
        // em pacotes de histórico, mas sempre >= 1.0
        if (!isNaN(val) && val >= 1.0 && val < 1000000) return val
      }
    }
  }
  return null
}

function extractMultiplierFromJson(data: any): number | null {
  const fields = ['crash_point', 'crashPoint', 'coefficient', 'multiplier', 'final_multiplier', 'crash']
  for (const f of fields) {
    if (data[f] !== undefined) {
      const val = parseFloat(data[f])
      if (!isNaN(val) && val >= 1) return val
    }
  }
  if (data.data && typeof data.data === 'object') return extractMultiplierFromJson(data.data)
  return null
}

function extractRoundId(data: any): string {
  const fields = ['round_id', 'roundId', 'game_id', 'id']
  for (const f of fields) {
    if (data[f]) return String(data[f])
  }
  return `round_${Date.now()}`
}