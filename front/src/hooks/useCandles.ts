import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Candle } from '@/types'
import { calcularCor, calcularStats } from '@/utils/candleUtils'

export interface Session {
  id: string
  label: string
  started_at: string
}

interface UseCandlesOptions {
  limit?: number
  cor?: string
  from?: string
  to?: string
  sessionId?: string | null   // null = todas as sessões, string = sessão específica
}

export function useSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const fetchSessions = useCallback(async () => {
    if (!user) return
    setLoadingSessions(true)

    const { data, error } = await supabase
      .from('sessions')
      .select('id, label, started_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    if (!error && data) setSessions(data as Session[])
    setLoadingSessions(false)
  }, [user])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // Escuta sessões novas em tempo real (bot ligou de novo)
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`sessions-realtime-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setSessions(prev => [payload.new as Session, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  return { sessions, loadingSessions, refetchSessions: fetchSessions }
}

export function useCandles(options: UseCandlesOptions = {}) {
  const { user } = useAuth()
  const [dbCandles, setDbCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const limitRef = useRef(options.limit)
  limitRef.current = options.limit

  const fetchCandles = useCallback(async () => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('candles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (options.limit)     query = query.limit(options.limit)
    if (options.cor)       query = query.eq('cor', options.cor)
    if (options.from)      query = query.gte('created_at', options.from)
    if (options.to)        query = query.lte('created_at', options.to)
    // Filtra por sessão apenas se sessionId for uma string não-vazia
    // Passa null para ver todas as sessões sem filtro
    if (options.sessionId) query = query.eq('session_id', options.sessionId)

    const { data, error } = await query
    if (!error && data) setDbCandles(data as Candle[])
    setLoading(false)
  }, [user, options.limit, options.cor, options.from, options.to, options.sessionId])

  useEffect(() => { fetchCandles() }, [fetchCandles])

  // Realtime: escuta INSERT — respeita a sessão ativa
  useEffect(() => {
    if (!user) return
    const channelName = `candles-realtime-${user.id}-${Date.now()}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'candles', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newCandle = payload.new as Candle

          // Se há um filtro de sessão ativo, ignora velas de outras sessões
          if (options.sessionId && newCandle.session_id !== options.sessionId) return

          setDbCandles(prev => {
            if (prev.some(c => c.id === newCandle.id)) return prev
            const next = [...prev, newCandle].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            const limit = limitRef.current
            return limit && next.length > limit ? next.slice(next.length - limit) : next
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, options.sessionId])

  const addCandle = useCallback(async (multiplicador: number, fonte: 'manual' | 'csv' | 'auto' = 'manual') => {
    if (!user) return
    const cor = calcularCor(multiplicador)
    const { data, error } = await supabase.from('candles').insert({
      user_id: user.id,
      multiplicador,
      cor,
      fonte,
      // Inserções manuais não pertencem a nenhuma sessão do bot
      session_id: null,
    }).select().single()
    return { data, error }
  }, [user])

  const addBulk = useCallback(async (multiplicadores: number[], fonte: 'manual' | 'csv' = 'csv') => {
    if (!user) return
    const rows = multiplicadores.map(m => ({
      user_id: user.id,
      multiplicador: m,
      cor: calcularCor(m),
      fonte,
      session_id: null,
    }))
    const { data, error } = await supabase.from('candles').insert(rows).select()
    return { data, error }
  }, [user])

  const clearAll = useCallback(async () => {
    if (!user) return
    await supabase.from('candles').delete().eq('user_id', user.id)
    setDbCandles([])
  }, [user])

  const stats = useMemo(() => calcularStats(dbCandles), [dbCandles])

  return { candles: dbCandles, stats, loading, addCandle, addBulk, clearAll, refetch: fetchCandles }
}