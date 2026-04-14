import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Candle } from '@/types'
import { calcularCor, calcularStats } from '@/utils/candleUtils'

interface UseCandlesOptions {
  limit?: number
  cor?: string
  from?: string
  to?: string
}

export function useCandles(options: UseCandlesOptions = {}) {
  const { user } = useAuth()
  const [dbCandles, setDbCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCandles = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let query = supabase
      .from('candles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (options.limit) query = query.limit(options.limit)
    if (options.cor) query = query.eq('cor', options.cor)
    if (options.from) query = query.gte('created_at', options.from)
    if (options.to) query = query.lte('created_at', options.to)

    const { data, error } = await query
    if (!error && data) setDbCandles(data as Candle[])
    setLoading(false)
  }, [user, options.limit, options.cor, options.from, options.to])

  useEffect(() => { fetchCandles() }, [fetchCandles])

  const addCandle = useCallback(async (multiplicador: number, fonte: 'manual' | 'csv' | 'auto' = 'manual') => {
    if (!user) return
    const cor = calcularCor(multiplicador)
    const { data, error } = await supabase.from('candles').insert({
      user_id: user.id, multiplicador, cor, fonte,
    }).select().single()
    if (!error && data) {
      setDbCandles(prev => [...prev, data as Candle])
    }
    return { data, error }
  }, [user])

  const addBulk = useCallback(async (multiplicadores: number[], fonte: 'manual' | 'csv' = 'csv') => {
    if (!user) return
    const rows = multiplicadores.map(m => ({
      user_id: user.id, multiplicador: m, cor: calcularCor(m), fonte,
    }))
    const { data, error } = await supabase.from('candles').insert(rows).select()
    if (!error && data) {
      setDbCandles(prev => [...prev, ...(data as Candle[])])
    }
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
