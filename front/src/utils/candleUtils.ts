import { Candle, CandleStats } from '@/types'

export function calcularCor(multiplicador: number): 'blue' | 'purple' | 'pink' {
  if (multiplicador >= 10) return 'pink'
  if (multiplicador >= 2) return 'purple'
  return 'blue'
}

export function calcularMaiorStreak(candles: Candle[], cor: string): number {
  let max = 0
  let current = 0
  for (const c of candles) {
    if (c.cor === cor) {
      current++
      if (current > max) max = current
    } else {
      current = 0
    }
  }
  return max
}

export function intervaloMedioRosa(candles: Candle[]): number {
  const indices: number[] = []
  candles.forEach((c, i) => { if (c.cor === 'pink') indices.push(i) })
  if (indices.length < 2) return candles.length
  let soma = 0
  for (let i = 1; i < indices.length; i++) {
    soma += indices[i] - indices[i - 1]
  }
  return Math.round(soma / (indices.length - 1))
}

export function calcularStats(candles: Candle[]): CandleStats {
  const total = candles.length
  if (total === 0) {
    return {
      total: 0,
      blue: { count: 0, percent: 0 },
      purple: { count: 0, percent: 0 },
      pink: { count: 0, percent: 0 },
      maior: 0, menor: 0, media: 0,
      streakAtual: { cor: 'blue', count: 0 },
      maiorStreakAzul: 0, maiorStreakRoxa: 0, intervalMedioRosa: 0,
    }
  }

  const blue = candles.filter(c => c.cor === 'blue').length
  const purple = candles.filter(c => c.cor === 'purple').length
  const pink = candles.filter(c => c.cor === 'pink').length
  const mults = candles.map(c => c.multiplicador)

  // Streak atual (últimas velas)
  let streakCor = candles[candles.length - 1].cor
  let streakCount = 0
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].cor === streakCor) streakCount++
    else break
  }

  return {
    total,
    blue: { count: blue, percent: (blue / total) * 100 },
    purple: { count: purple, percent: (purple / total) * 100 },
    pink: { count: pink, percent: (pink / total) * 100 },
    maior: Math.max(...mults),
    menor: Math.min(...mults),
    media: mults.reduce((a, b) => a + b, 0) / total,
    streakAtual: { cor: streakCor, count: streakCount },
    maiorStreakAzul: calcularMaiorStreak(candles, 'blue'),
    maiorStreakRoxa: calcularMaiorStreak(candles, 'purple'),
    intervalMedioRosa: intervaloMedioRosa(candles),
  }
}

export function detectarPadroes(candles: Candle[]): string[] {
  if (candles.length === 0) return []
  const stats = calcularStats(candles)
  const alertas: string[] = []

  alertas.push(`🔵 Maior sequência azul: ${stats.maiorStreakAzul} rodadas`)
  alertas.push(`🟣 Maior sequência roxa: ${stats.maiorStreakRoxa} rodadas`)
  alertas.push(`🌸 Rosa aparece a cada ${stats.intervalMedioRosa} rodadas em média`)

  // Após X azuis seguidas, quantas vezes veio rosa?
  let azulSeguidas = 0
  let veioRosaApos = 0
  let totalApos = 0
  const threshold = 4
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].cor === 'blue') {
      azulSeguidas++
    } else {
      if (azulSeguidas >= threshold) {
        totalApos++
        if (candles[i].cor === 'pink') veioRosaApos++
      }
      azulSeguidas = 0
    }
  }
  if (totalApos > 0) {
    const pct = ((veioRosaApos / totalApos) * 100).toFixed(1)
    alertas.push(`⚠️ Após ${threshold}+ azuis seguidas, rosa veio em ${pct}% das vezes`)
  }

  if (stats.streakAtual.count > stats.maiorStreakAzul * 0.7 && stats.streakAtual.cor === 'blue') {
    alertas.push(`🚨 ALERTA: Streak azul atual (${stats.streakAtual.count}) próxima do recorde!`)
  }

  return alertas
}

export function corParaEmoji(cor: string): string {
  switch (cor) {
    case 'blue': return '🔵'
    case 'purple': return '🟣'
    case 'pink': return '🌸'
    default: return '⚪'
  }
}

export function corParaLabel(cor: string): string {
  switch (cor) {
    case 'blue': return 'Azul'
    case 'purple': return 'Roxa'
    case 'pink': return 'Rosa'
    default: return cor
  }
}
