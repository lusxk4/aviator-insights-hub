import { useState, useRef, useEffect } from 'react'
import { useWS } from '@/contexts/WebSocketContext'
import { useCandles } from '@/hooks/useCandles'
import { calcularCor, corParaLabel } from '@/utils/candleUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, isValid } from 'date-fns' // Adicionado isValid
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

const COLORS = { blue: 'hsl(217,91%,60%)', purple: 'hsl(263,70%,58%)', pink: 'hsl(330,80%,60%)' }

export default function RealtimePage() {
  const ws = useWS()
  const { addCandle, candles: dbCandles } = useCandles({ limit: 30 })
  const [manualValue, setManualValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 1. Correção: Garante que dbCandles e ws.candles sejam arrays antes de filtrar
  const safeDbCandles = Array.isArray(dbCandles) ? dbCandles : []
  const safeWsCandles = Array.isArray(ws?.candles) ? ws.candles : []

  const allCandles = [...safeDbCandles, ...safeWsCandles.filter(wc => !safeDbCandles.find(dc => dc.id === wc.id || dc.rodada_id === wc.rodada_id))]
  
  // 2. Ordenação por tempo para garantir que o feed faça sentido
  const recentCandles = [...allCandles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)

  const chartCandles = [...allCandles]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-30)

  useEffect(() => {
    if (!ws?.lastCandle) return
    if (ws.lastCandle.cor === 'pink') {
      toast('🌸 Rosa detectada!', { description: `${ws.lastCandle.multiplicador.toFixed(2)}x` })
    }
  }, [ws?.lastCandle])

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(manualValue)
    if (isNaN(val) || val <= 0) return
    await addCandle(val, 'manual')
    setManualValue('')
    inputRef.current?.focus()
  }

  const barData = chartCandles.map((c, i) => ({ 
    index: i, 
    mult: c.multiplicador, 
    cor: c.cor || 'blue' 
  }))

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Status */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className={`h-4 w-4 rounded-full ${ws?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {ws?.connected ? 'Conectado ao servidor' : 'Servidor desconectado'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {ws?.connected 
                ? `${ws?.status?.totalCaptured || 0} velas capturadas` 
                : 'Inicie o bot para começar a interceptação'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed ao vivo */}
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Feed ao vivo</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            <AnimatePresence initial={false}>
              {recentCandles.map((c, i) => {
                // 3. Proteção para a data: Se a data for inválida, não quebra a tela
                const date = new Date(c.created_at)
                const timeAgo = isValid(date) 
                  ? formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
                  : 'Agora'

                return (
                  <motion.div key={c.id || c.rodada_id || i}
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'border-2 bg-white/5' : 'bg-white/5'}`}
                    style={i === 0 ? { borderColor: COLORS[c.cor as keyof typeof COLORS] } : {}}
                  >
                    <span className="text-xl font-bold font-mono" style={{ color: COLORS[c.cor as keyof typeof COLORS] }}>
                      {Number(c.multiplicador).toFixed(2)}x
                    </span>
                    <Badge variant="outline" style={{ borderColor: COLORS[c.cor as keyof typeof COLORS], color: COLORS[c.cor as keyof typeof COLORS] }}>
                      {corParaLabel(c.cor)}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {timeAgo}
                    </span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {recentCandles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aguardando sinais do bot...</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Mini gráfico */}
          <div className="glass-card p-4 h-[250px]">
            <h3 className="text-sm font-medium text-foreground mb-3">Histórico Recente</h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <Bar dataKey="mult">
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.cor as keyof typeof COLORS] || COLORS.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem dados para o gráfico
              </div>
            )}
          </div>

          {/* Entrada manual */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">Entrada manual</h3>
            <form onSubmit={handleManualEntry} className="flex gap-2">
              <Input
                ref={inputRef}
                type="number" step="0.01" min="1" placeholder="Ex: 1.50"
                value={manualValue} onChange={e => setManualValue(e.target.value)}
                className="bg-white/5 border-white/10 font-mono"
              />
              <Button type="submit">Adicionar</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}