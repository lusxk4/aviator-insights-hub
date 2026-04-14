import { Candle, AIAnalysis } from '@/types'
import { calcularStats } from '@/utils/candleUtils'

export async function analyzeCandles(candles: Candle[]): Promise<AIAnalysis> {
  const stats = calcularStats(candles)

  // Simula delay de API
  await new Promise(resolve => setTimeout(resolve, 2000))

  return {
    padrao: stats.blue.percent > 70
      ? "Alta concentração de velas azuis"
      : stats.purple.percent > 35
        ? "Presença elevada de velas roxas"
        : "Distribuição equilibrada",
    estrategiaRecomendada: stats.blue.percent > 70
      ? "Martingale Azul"
      : stats.purple.percent > 30
        ? "Double Purple"
        : "Safe 1.5x",
    confianca: Math.min(0.95, 0.5 + (stats.total / 2000)),
    insights: [
      `${stats.blue.percent.toFixed(1)}% das velas foram azuis`,
      `${stats.purple.percent.toFixed(1)}% das velas foram roxas`,
      `${stats.pink.percent.toFixed(1)}% das velas foram rosas`,
      `Rosa apareceu a cada ${stats.intervalMedioRosa} rodadas em média`,
      `Maior streak azul: ${stats.maiorStreakAzul} rodadas`,
      `Maior streak roxa: ${stats.maiorStreakRoxa} rodadas`,
      `Maior multiplicador registrado: ${stats.maior.toFixed(2)}x`,
      `Média geral: ${stats.media.toFixed(2)}x`,
    ],
    resumo: `Baseado na análise de ${stats.total} rodadas, o momento atual apresenta ${stats.blue.percent > 70 ? 'alta concentração de velas azuis, sugerindo uma possível reversão em breve' : 'distribuição relativamente equilibrada'}. A volatilidade está ${stats.pink.percent > 5 ? 'dentro do esperado' : 'baixa, sem rosas recentes'}. ${stats.streakAtual.count > 3 ? `Atenção: streak de ${stats.streakAtual.count} ${stats.streakAtual.cor === 'blue' ? 'azuis' : 'roxas'} consecutivas.` : ''}`,
  }
}
