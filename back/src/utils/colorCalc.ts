import { Candle } from '../types'

export function calcularCor(multiplicador: number): 'blue' | 'purple' | 'pink' {
  if (multiplicador >= 10) return 'pink'
  if (multiplicador >= 2) return 'purple'
  return 'blue'
}

export function criarCandle(multiplicador: number, rodada_id: string): Omit<Candle, 'id'> {
  return {
    multiplicador,
    cor: calcularCor(multiplicador),
    rodada_id,
    timestamp: new Date().toISOString(),
    fonte: 'auto'
  }
}