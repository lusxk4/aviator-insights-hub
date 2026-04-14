import { useState, useMemo } from 'react'
import { useCandles } from '@/hooks/useCandles'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { SimulationResult, Strategy } from '@/types'

const DEFAULT_STRATEGIES: Strategy[] = [
  { id: 's1', name: 'Martingale Azul', description: 'Entrar após 3+ azuis consecutivas esperando roxa', rules: { tipo: 'martingale', threshold: 3, target: 'purple' } },
  { id: 's2', name: 'Pós-Rosa Conservador', description: 'Entrar em 1.5x nas 2 rodadas após sair rosa', rules: { tipo: 'pos-rosa', mult: 1.5, rodadas: 2 } },
  { id: 's3', name: 'Double Purple', description: 'Após roxa, apostar esperando outra roxa', rules: { tipo: 'double', target: 'purple' } },
  { id: 's4', name: 'Safe 1.5x', description: 'Sempre sair em 1.5x independente da vela', rules: { tipo: 'safe', mult: 1.5 } },
  { id: 's5', name: 'Fibonacci Recovery', description: 'Seguir sequência Fibonacci após perdas', rules: { tipo: 'fibonacci' } },
  { id: 's6', name: 'Anti-Streak', description: 'Entrar quando streak de azuis > média histórica', rules: { tipo: 'anti-streak' } },
]

export default function StrategiesPage() {
  const { candles } = useCandles({ limit: 1000 })
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
  const [simOpen, setSimOpen] = useState(false)
  const [bancaInicial, setBancaInicial] = useState('100')
  const [valorEntrada, setValorEntrada] = useState('5')
  const [stopLoss, setStopLoss] = useState('50')
  const [stopGain, setStopGain] = useState('200')
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)

  const runSimulation = () => {
    if (!selectedStrategy || candles.length === 0) return
    const bInicial = parseFloat(bancaInicial)
    const vEntrada = parseFloat(valorEntrada)
    const sLoss = parseFloat(stopLoss)
    const sGain = parseFloat(stopGain)
    let banca = bInicial
    let wins = 0, losses = 0, skips = 0
    let maiorDrawdown = 0
    let maxBanca = bInicial
    const historico: number[] = [bInicial]
    const rules = selectedStrategy.rules

    for (const candle of candles) {
      if (banca <= sLoss || banca >= sGain) break
      let shouldEnter = false
      let targetMult = 2

      switch (rules.tipo) {
        case 'martingale': {
          const lastN = candles.slice(Math.max(0, candles.indexOf(candle) - 3), candles.indexOf(candle))
          shouldEnter = lastN.length >= 3 && lastN.every(c => c.cor === 'blue')
          targetMult = 2
          break
        }
        case 'pos-rosa': {
          const idx = candles.indexOf(candle)
          if (idx >= 1 && candles[idx - 1].cor === 'pink') shouldEnter = true
          if (idx >= 2 && candles[idx - 2].cor === 'pink') shouldEnter = true
          targetMult = 1.5
          break
        }
        case 'safe':
          shouldEnter = true
          targetMult = 1.5
          break
        case 'double': {
          const idx = candles.indexOf(candle)
          shouldEnter = idx >= 1 && candles[idx - 1].cor === 'purple'
          targetMult = 2
          break
        }
        default:
          shouldEnter = Math.random() > 0.5
          targetMult = 1.5
      }

      if (!shouldEnter) { skips++; historico.push(banca); continue }

      if (candle.multiplicador >= targetMult) {
        banca += vEntrada * (targetMult - 1)
        wins++
      } else {
        banca -= vEntrada
        losses++
      }

      if (banca > maxBanca) maxBanca = banca
      const dd = maxBanca - banca
      if (dd > maiorDrawdown) maiorDrawdown = dd
      historico.push(banca)
    }

    setSimResult({
      totalRodadas: wins + losses + skips,
      wins, losses, skips,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      bancaInicial: bInicial,
      bancaFinal: banca,
      lucro: banca - bInicial,
      maiorDrawdown,
      historicoBanca: historico,
    })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <h2 className="text-xl font-bold text-foreground">Estratégias</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEFAULT_STRATEGIES.map(s => (
          <div key={s.id} className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">{s.name}</h3>
            <p className="text-sm text-muted-foreground">{s.description}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setSelectedStrategy(s); setSimOpen(true); setSimResult(null) }}>
                Simular agora
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={simOpen} onOpenChange={setSimOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">Simular: {selectedStrategy?.name}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Banca inicial (R$)</label>
                <Input value={bancaInicial} onChange={e => setBancaInicial(e.target.value)} type="number" className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor entrada (R$)</label>
                <Input value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} type="number" className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stop Loss (R$)</label>
                <Input value={stopLoss} onChange={e => setStopLoss(e.target.value)} type="number" className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stop Gain (R$)</label>
                <Input value={stopGain} onChange={e => setStopGain(e.target.value)} type="number" className="bg-muted border-border" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{candles.length} velas disponíveis para simulação</p>
            <Button onClick={runSimulation} className="w-full" disabled={candles.length === 0}>Rodar simulação</Button>

            {simResult && (
              <div className="space-y-4 fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className={`text-xl font-bold ${simResult.winRate >= 60 ? 'text-success' : simResult.winRate >= 40 ? 'text-warning' : 'text-destructive'}`}>
                      {simResult.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground">Lucro</p>
                    <p className={`text-xl font-bold ${simResult.lucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                      R$ {simResult.lucro.toFixed(2)}
                    </p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground">Maior Drawdown</p>
                    <p className="text-xl font-bold text-destructive">R$ {simResult.maiorDrawdown.toFixed(2)}</p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="text-xs text-muted-foreground">Rodadas</p>
                    <p className="text-xl font-bold text-foreground">{simResult.totalRodadas}</p>
                  </div>
                </div>

                <div className="glass-card p-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Evolução da banca</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={simResult.historicoBanca.map((v, i) => ({ i, v }))}>
                      <XAxis dataKey="i" hide />
                      <YAxis stroke="hsl(220,10%,30%)" fontSize={10} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(240,15%,8%)', border: '1px solid hsl(240,10%,18%)', borderRadius: 8, color: '#fff' }}
                        formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Banca']}
                      />
                      <Line type="monotone" dataKey="v" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
