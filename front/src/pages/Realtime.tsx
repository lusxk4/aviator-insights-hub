import { useState, useRef, useEffect } from 'react'
import { useWS } from '@/contexts/WebSocketContext'
import { useCandles } from '@/hooks/useCandles'
import { calcularCor, corParaLabel } from '@/utils/candleUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

const COLORS = { blue: 'hsl(217,91%,60%)', purple: 'hsl(263,70%,58%)', pink: 'hsl(330,80%,60%)' }

export default function RealtimePage() {
  const ws = useWS()
  const { addCandle, candles: dbCandles } = useCandles({ limit: 30 })
  const [manualValue, setManualValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Combina velas WS e DB
  const allCandles = [...dbCandles, ...ws.candles.filter(wc => !dbCandles.find(dc => dc.id === wc.id))]
  const recentCandles = allCandles.slice(-20).reverse()
  const chartCandles = allCandles.slice(-30)

  // Alertas
  useEffect(() => {
    if (!ws.lastCandle) return
    if (ws.lastCandle.cor === 'pink') {
      toast('🌸 Rosa detectada!', { description: `${ws.lastCandle.multiplicador.toFixed(2)}x` })
    }
  }, [ws.lastCandle])

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(manualValue)
    if (isNaN(val) || val <= 0) return
    await addCandle(val, 'manual')
    setManualValue('')
    inputRef.current?.focus()
  }

  const barData = chartCandles.map((c, i) => ({ index: i, mult: c.multiplicador, cor: c.cor }))

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Status */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className={`h-4 w-4 rounded-full ${ws.connected ? 'bg-success pulse-green' : 'bg-destructive'}`} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{ws.connected ? 'Conectado ao servidor' : 'Servidor desconectado'}</h2>
            {ws.connected ? (
              <p className="text-sm text-muted-foreground">
                {ws.status.totalCaptured} velas capturadas
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Inicie o servidor: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">npm run dev</code>
              </p>
            )}
          </div>
          {!ws.connected && (
            <Button variant="outline" size="sm" onClick={ws.reconnect} className="ml-auto">Tentar conectar</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed ao vivo */}
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Feed ao vivo</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {recentCandles.map((c, i) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'border-2 bg-muted/50' : 'bg-muted/20'}`}
                  style={i === 0 ? { borderColor: COLORS[c.cor] } : {}}
                >
                  <span className="text-xl font-bold font-mono" style={{ color: COLORS[c.cor] }}>
                    {c.multiplicador.toFixed(2)}x
                  </span>
                  <Badge variant="outline" style={{ borderColor: COLORS[c.cor], color: COLORS[c.cor] }}>
                    {corParaLabel(c.cor)}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {recentCandles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma vela ainda</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Mini gráfico */}
          {barData.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Últimas 30 velas</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData}>
                  <XAxis dataKey="index" hide />
                  <YAxis hide />
                  <Bar dataKey="mult" radius={[2, 2, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={COLORS[d.cor as keyof typeof COLORS]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Entrada manual */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">Entrada manual</h3>
            <p className="text-xs text-muted-foreground">Use quando o servidor não estiver rodando</p>
            <form onSubmit={handleManualEntry} className="flex gap-2">
              <Input
                ref={inputRef}
                type="number" step="0.01" min="1" placeholder="Ex: 1.50"
                value={manualValue} onChange={e => setManualValue(e.target.value)}
                className="bg-muted border-border font-mono text-lg"
              />
              <Button type="submit">Enter</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
