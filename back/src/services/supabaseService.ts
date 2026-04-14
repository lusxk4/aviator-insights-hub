import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function saveCandle(candle) {
  try {
    // Inserção simples. Sem UPSERT, sem travas de conflito.
    // Isso garante que se cair 1.10x agora e 1.10x depois, as duas entrem.
    const { error } = await supabase.from('candles').insert({
      multiplicador: candle.multiplicador,
      cor: candle.cor,
      rodada_id: candle.rodada_id, // Identificador da rodada
      fonte: 'auto',
      created_at: new Date().toISOString()
    })

    if (error) {
      // Se der erro de "rodada_id" duplicado (mesma rodada capturada 2x), 
      // o erro 23505 acontece. Se for outro erro, a gente loga.
      if (error.code !== '23505') {
        logger.error(`❌ Erro Supabase: ${error.message}`)
      }
    } else {
      logger.info(`✅ Vela salva: ${candle.multiplicador}x`)
    }
  } catch (err) {
    logger.error(`💥 Falha crítica ao salvar: ${err.message}`)
  }
}