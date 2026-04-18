import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'
import { Candle } from '../types/index.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

let resolvedUserId: string | null = null
let currentSessionId: string | null = null

// Chame isso UMA vez no startup
export async function initBotUser(): Promise<void> {
  const email = process.env.BET923_EMAIL

  if (!email) {
    logger.error('❌ BET923_EMAIL não definido no .env')
    return
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      logger.error(`❌ Erro ao listar usuários: ${error.message}`)
      return
    }

    const user = data.users.find(u => u.email === email)

    if (!user) {
      logger.error(`❌ Nenhum usuário encontrado com email: ${email}`)
      logger.error('   Certifique-se que esse email está cadastrado no Supabase Auth')
      return
    }

    resolvedUserId = user.id
    logger.info(`✅ Bot vinculado ao usuário: ${email} (user_id: ${resolvedUserId})`)

    // Cria a sessão logo após resolver o usuário
    await initSession()
  } catch (err: any) {
    logger.error(`💥 Erro crítico ao buscar usuário: ${err.message}`)
  }
}

// Cria uma nova sessão no banco e armazena o ID localmente
async function initSession(): Promise<void> {
  if (!resolvedUserId) return

  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: resolvedUserId,
        started_at: new Date().toISOString(),
        label: `Sessão ${new Date().toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      })
      .select('id')
      .single()

    if (error) {
      logger.error(`❌ Erro ao criar sessão: ${error.message}`)
      return
    }

    currentSessionId = data.id
    logger.info(`🆕 Sessão iniciada: ${currentSessionId}`)
  } catch (err: any) {
    logger.error(`💥 Falha ao criar sessão: ${err.message}`)
  }
}

export async function saveCandle(candle: Candle): Promise<void> {
  if (!resolvedUserId) {
    logger.warn('⚠️  user_id não resolvido — vela não salva')
    return
  }

  if (!currentSessionId) {
    logger.warn('⚠️  session_id não resolvido — vela não salva')
    return
  }

  try {
    const { error } = await supabase.from('candles').insert({
      user_id: resolvedUserId,
      session_id: currentSessionId,   // ← campo novo
      multiplicador: candle.multiplicador,
      cor: candle.cor,
      rodada_id: candle.rodada_id,
      fonte: 'auto',
      created_at: new Date().toISOString(),
    })

    if (error) {
      if (error.code !== '23505') {
        logger.error(`❌ Erro Supabase: ${error.message}`)
      }
    } else {
      logger.info(`✅ Vela salva: ${candle.multiplicador}x (sessão ${currentSessionId})`)
    }
  } catch (err: any) {
    logger.error(`💥 Falha crítica ao salvar vela: ${err.message}`)
  }
}

export function getCurrentSessionId(): string | null {
  return currentSessionId
}