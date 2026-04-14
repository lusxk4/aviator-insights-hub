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

export async function startInterception(page: Page): Promise<void> {
  logger.info('🔍 Iniciando interceptação de WebSockets...')

  // Listener nativo do Playwright (captura WS da página principal, se houver)
  attachWSListener(page, 'main')

  // ✅ Força reload do iframe do jogo para que o context.addInitScript
  // (injetado no launcher.ts) rode ANTES do WebSocket do jogo ser criado.
  // Sem o reload, o iframe já estava carregado antes da injeção.
  await forceReloadGameIframe(page)

  // Inicia polling em frames já existentes
  for (const frame of page.frames()) {
    logger.debug(`Frame encontrado: ${frame.url()}`)
    tryStartPolling(frame)
  }

  // Monitora novos frames que aparecerem
  page.on('frameattached', async (frame) => {
    logger.debug(`Novo frame anexado: ${frame.url()}`)
    await new Promise(r => setTimeout(r, 500))
    tryStartPolling(frame)
  })

  page.on('framenavigated', async (frame) => {
    logger.debug(`Frame navegado: ${frame.url()}`)
    // Pequena espera para o frame inicializar
    await new Promise(r => setTimeout(r, 200))
    tryStartPolling(frame)
  })

  logger.info('✅ Interceptação ativa!')
}

async function forceReloadGameIframe(page: Page): Promise<void> {
  try {
    logger.info('🔄 Recarregando iframe do jogo para ativar interceptor...')

    // Localiza o iframe do jogo e força reload via src
    await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'))
      const gameIframe = iframes.find(f =>
        f.src && (
          f.src.includes('p-j-0-h.com') ||
          f.src.includes('aviator') ||
          f.src.includes('spribe')
        )
      )
      if (gameIframe) {
        const src = gameIframe.src
        gameIframe.src = ''
        setTimeout(() => { gameIframe.src = src }, 100)
      }
    })

    // Aguarda o iframe recarregar e o jogo conectar ao WebSocket
    await page.waitForTimeout(8000)
    logger.info('✅ Iframe recarregado — interceptor ativo antes do WS do jogo!')

  } catch (err) {
    logger.warn(`⚠️  Falha ao recarregar iframe: ${err} — continuando mesmo assim`)
  }
}

function isGameFrame(url: string): boolean {
  return (
    url.includes('p-j-0-h.com') ||
    url.includes('aviator') ||
    url.includes('spribe')
  )
}

function tryStartPolling(frame: Frame): void {
  const url = frame.url()
  if (!url || url === 'about:blank') return
  if (!isGameFrame(url)) return

  logger.info(`🎮 Iniciando polling no frame do jogo: ${url}`)
  startPolling(frame)
}

function startPolling(frame: Frame): void {
  let lastProcessedIndex = 0
  let consecutiveErrors = 0
  const MAX_ERRORS = 10

  const interval = setInterval(async () => {
    try {
      if (frame.isDetached()) {
        clearInterval(interval)
        logger.warn('⚠️  Frame do jogo desanexado, parando polling')
        return
      }

      const messages = await frame.evaluate((fromIndex: number) => {
        const msgs = (window as any).__wsMessages || []
        return msgs.slice(fromIndex)
      }, lastProcessedIndex)

      consecutiveErrors = 0 // reset no sucesso

      if (messages && messages.length > 0) {
        lastProcessedIndex += messages.length

        for (const msg of messages) {
          const { url, payload, timestamp } = msg

          if (!detectedWSUrls.includes(url)) {
            detectedWSUrls.push(url)
            logger.info(`🌐 WebSocket detectado (iframe): ${url}`)
          }

          rawFrames.unshift({ url, payload: payload.substring(0, 500), timestamp })
          if (rawFrames.length > MAX_RAW_FRAMES) rawFrames.pop()

          logger.debug(`📨 Frame recebido [iframe]: ${payload.substring(0, 200)}`)
          tryParseCandle(payload, url)
        }
      }
    } catch (err) {
      consecutiveErrors++
      if (consecutiveErrors >= MAX_ERRORS) {
        clearInterval(interval)
        logger.warn(`⚠️  Polling encerrado após ${MAX_ERRORS} erros consecutivos`)
      }
    }
  }, 500)
}

function attachWSListener(page: Page, label: string): void {
  page.on('websocket', ws => {
    const wsUrl = ws.url()
    if (!detectedWSUrls.includes(wsUrl)) detectedWSUrls.push(wsUrl)
    logger.info(`🌐 WebSocket detectado (${label}): ${wsUrl}`)

    ws.on('framereceived', frame => {
      const payload = frame.payload.toString()

      rawFrames.unshift({
        url: wsUrl,
        payload: payload.substring(0, 500),
        timestamp: new Date().toISOString()
      })
      if (rawFrames.length > MAX_RAW_FRAMES) rawFrames.pop()

      logger.debug(`📨 Frame recebido [${wsUrl.split('/').pop()}]: ${payload.substring(0, 200)}`)
      tryParseCandle(payload, wsUrl)
    })

    ws.on('framesent', frame => {
      logger.debug(`📤 Frame enviado: ${frame.payload.toString().substring(0, 100)}`)
    })

    ws.on('close', () => {
      logger.warn(`⚠️  WebSocket fechado: ${wsUrl}`)
    })
  })
}

function tryParseCandle(payload: string, wsUrl: string): void {
  try {
    if (payload.length < 5 || payload === '[binary]') return

    let data: any

    try {
      data = JSON.parse(payload)
    } catch {
      const jsonMatch = payload.match(/\{.*\}/s)
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0])
        } catch { return }
      } else { return }
    }

    const multiplicador = extractMultiplier(data)

    if (multiplicador !== null && multiplicador >= 1) {
      const rodadaId = extractRoundId(data)
      logger.info(`🕯️  Vela capturada: ${multiplicador}x (rodada: ${rodadaId})`)
      const candle = candleService.addCandle(multiplicador, rodadaId)
      saveCandle(candle)
    }

  } catch (err) {
    logger.debug(`Erro ao parsear frame: ${err}`)
  }
}

function extractMultiplier(data: any): number | null {
  const possibleFields = [
    'crash_point', 'crashPoint', 'coefficient', 'multiplier',
    'finalMultiplier', 'final_multiplier', 'result', 'value',
    'x', 'coef', 'bust', 'game_result', 'gameResult', 'payout',
    'crash', 'factor'
  ]

  for (const field of possibleFields) {
    if (data[field] !== undefined) {
      const val = parseFloat(data[field])
      if (!isNaN(val) && val >= 1 && val <= 10000) {
        logger.debug(`✅ Multiplicador encontrado em campo "${field}": ${val}`)
        return val
      }
    }
  }

  if (data.data && typeof data.data === 'object') return extractMultiplier(data.data)
  if (data.result && typeof data.result === 'object') return extractMultiplier(data.result)
  if (data.payload && typeof data.payload === 'object') return extractMultiplier(data.payload)
  if (data.game && typeof data.game === 'object') return extractMultiplier(data.game)

  if (data.type || data.event || data.action) {
    const eventType = (data.type || data.event || data.action || '').toLowerCase()
    const isGameEnd = ['game_end', 'gameend', 'crash', 'bust', 'round_end', 'finish', 'game_over'].some(
      e => eventType.includes(e)
    )
    if (isGameEnd) {
      const copy = { ...data }
      delete copy.type; delete copy.event; delete copy.action
      return extractMultiplier(copy)
    }
  }

  return null
}

function extractRoundId(data: any): string {
  const possibleFields = ['round_id', 'roundId', 'game_id', 'gameId', 'id', 'session_id']
  for (const field of possibleFields) {
    if (data[field]) return String(data[field])
  }
  return `round_${Date.now()}`
}