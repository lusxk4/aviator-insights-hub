import { Page } from 'playwright'
import { logger } from '../utils/logger.js'
import { candleService } from '../services/candleService.js'
import { saveCandle } from '../services/supabaseService.js'

const rawFrames: { url: string; payload: string; timestamp: string }[] = []
const MAX_RAW_FRAMES = 50

export function getRawFrames() {
  return rawFrames
}

export async function startInterception(page: Page): Promise<void> {
  logger.info('🔍 Iniciando interceptação de WebSockets...')

  const wsUrls: string[] = []

  page.on('websocket', ws => {
    const wsUrl = ws.url()
    wsUrls.push(wsUrl)
    logger.info(`🌐 WebSocket detectado: ${wsUrl}`)

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

  page.frames().forEach(frame => {
    logger.debug(`Frame encontrado: ${frame.url()}`)
  })

  page.on('frameattached', frame => {
    logger.debug(`Novo frame anexado: ${frame.url()}`)
  })

  logger.info('✅ Interceptação ativa!')
}

function tryParseCandle(payload: string, wsUrl: string): void {
  try {
    if (payload.length < 5) return

    let data: any

    try {
      data = JSON.parse(payload)
    } catch {
      const jsonMatch = payload.match(/\{.*\}/s)
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0])
        } catch {
          return
        }
      } else {
        return
      }
    }

    const multiplicador = extractMultiplier(data)

    if (multiplicador !== null && multiplicador >= 1) {
      const rodadaId = extractRoundId(data)
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

  if (data.data) return extractMultiplier(data.data)
  if (data.result) return extractMultiplier(data.result)
  if (data.payload) return extractMultiplier(data.payload)
  if (data.game) return extractMultiplier(data.game)

  if (data.type || data.event || data.action) {
    const eventType = (data.type || data.event || data.action || '').toLowerCase()
    const isGameEnd = ['game_end', 'gameend', 'crash', 'bust', 'round_end', 'finish', 'game_over'].some(
      e => eventType.includes(e)
    )
    if (isGameEnd) {
      logger.debug(`Evento de fim de rodada detectado: ${eventType}`)
      return extractMultiplier({ ...data, type: undefined, event: undefined })
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

export function getDetectedWSUrls(): string[] {
  return []
}