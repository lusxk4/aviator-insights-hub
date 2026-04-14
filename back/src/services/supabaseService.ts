import { createClient } from '@supabase/supabase-js'
import { Candle } from '../types/index.js'
import { logger } from '../utils/logger.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const queue: Candle[] = []
let processing = false

async function processQueue() {
  if (processing || queue.length === 0) return
  processing = true

  const candle = queue.shift()!

  try {
    const { error } = await supabase.from('candles').insert({
      multiplicador: candle.multiplicador,
      cor: candle.cor,
      rodada_id: candle.rodada_id,
      fonte: 'auto',
      created_at: candle.timestamp
    })

    if (error) {
      logger.error(`Erro ao salvar vela no Supabase: ${error.message}`)
    } else {
      logger.debug(`✅ Vela salva no Supabase: ${candle.multiplicador}x`)
    }
  } catch (err) {
    logger.error(`Exceção ao salvar no Supabase: ${err}`)
  }

  processing = false

  if (queue.length > 0) {
    setTimeout(processQueue, 100)
  }
}

export function saveCandle(candle: Candle) {
  queue.push(candle)
  processQueue()
}

export { supabase }