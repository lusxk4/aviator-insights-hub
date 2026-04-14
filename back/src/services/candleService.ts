import { v4 as uuidv4 } from 'uuid'
import { Candle } from '../types/index.js'
import { calcularCor } from '../utils/colorCalc.js'
import { logger } from '../utils/logger.js'
import { EventEmitter } from 'events'

const MAX_CANDLES = 1000

class CandleService extends EventEmitter {
  private candles: Candle[] = []
  private totalCaptured: number = 0

  addCandle(multiplicador: number, rodada_id: string): Candle {
    const candle: Candle = {
      id: uuidv4(),
      multiplicador,
      cor: calcularCor(multiplicador),
      rodada_id,
      timestamp: new Date().toISOString(),
      fonte: 'auto'
    }

    if (this.candles.length >= MAX_CANDLES) {
      this.candles.shift()
    }

    this.candles.push(candle)
    this.totalCaptured++

    logger.info(`🕯️  Nova vela: ${multiplicador}x [${candle.cor.toUpperCase()}] | Total: ${this.totalCaptured}`)

    this.emit('new_candle', candle)

    return candle
  }

  getCandles(limit: number = 100): Candle[] {
    return this.candles.slice(-limit)
  }

  getLastCandle(): Candle | null {
    return this.candles[this.candles.length - 1] || null
  }

  getTotalCaptured(): number {
    return this.totalCaptured
  }

  getStats() {
    const total = this.candles.length
    if (total === 0) return null

    const blue = this.candles.filter(c => c.cor === 'blue').length
    const purple = this.candles.filter(c => c.cor === 'purple').length
    const pink = this.candles.filter(c => c.cor === 'pink').length
    const multiplicadores = this.candles.map(c => c.multiplicador)

    return {
      total,
      blue: { count: blue, percent: ((blue / total) * 100).toFixed(1) },
      purple: { count: purple, percent: ((purple / total) * 100).toFixed(1) },
      pink: { count: pink, percent: ((pink / total) * 100).toFixed(1) },
      maior: Math.max(...multiplicadores),
      menor: Math.min(...multiplicadores),
      media: (multiplicadores.reduce((a, b) => a + b, 0) / total).toFixed(2)
    }
  }

  clear() {
    this.candles = []
    logger.warn('Buffer de velas limpo')
  }
}

export const candleService = new CandleService()