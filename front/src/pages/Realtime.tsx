import { useState, useRef, useEffect, useMemo } from 'react'
import { useWS } from '@/contexts/WebSocketContext'
import { useCandles } from '@/hooks/useCandles'
import { corParaLabel } from '@/utils/candleUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

const COLORS = { blue: 'hsl(217,91%,60%)', purple: 'hsl(263,70%,58%)', pink: 'hsl(330,80%,60%)' }

// Deduplicação no front: agrupa por multiplicador+janela de 2s
// Evita que velas do WS e do banco apareçam duplicadas na tela
function deduplicateCandles(candles: any[]): any[] {
  const seen = new Map<string, boolean>();
  const result: any[] = [];

  // Ordena do mais antigo ao mais novo para o dedup funcionar corretamente
  const sorted = [...candles].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const candle of sorted) {
    const mult = Number(candle.multiplicador).toFixed(2);
    const bucket = Math.floor(new Date(candle.created_at).getTime() / 2000); // janela de 2s
    const key = `${mult}_${bucket}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      result.push(candle);
    }
  }

  return result;
}

export default function RealtimePage() {
  const ws = useWS()
  const { addCandle, candles: dbCandles } = useCandles({ limit: 30 })
  const [manualValue, setManualValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allCandles = useMemo(() => {
    const safeDb = Array.isArray(dbCandles) ? dbCandles : []
    const safeWs = Array.isArray(ws?.candles) ? ws.candles : []

    // Junta tudo e deduplica por multiplicador+janela de tempo
    const combined = [...safeDb, ...safeWs];
    return deduplicateCandles(combined);
  }, [dbCandles, ws?.candles])

  // Feed: mais recentes primeiro
  const recentCandles = useMemo(() => {
    return [...allCandles]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
  }, [allCandles])

  // Gráfico: mais antigas primeiro
  const barData = useMemo(() => {
    return [...allCandles]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-30)
      .map((c, i) => ({
        index: i,
        mult: Number(c.multiplicador),
        cor: c.cor || 'blue'
      }))
  }, [allCandles])

  useEffect(() => {
    if (ws?.lastCandle?.cor === 'pink') {
      toast.success('🌸 Rosa detectada!', {
        description: `${Number(ws.lastCandle.multiplicador).toFixed(2)}x`,
        duration: 5000
      })
    }
  }, [ws?.lastCandle])

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(manualValue)
    if (isNaN(val) || val <= 0) return
    try {
      await addCandle(val, 'manual')
      setManualValue('')
      toast.success('Vela adicionada manualmente')
    } catch (err) {
      toast.error('Erro ao salvar vela')
    }
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0 p-4">
      {/* Status do Servidor */}
      <div className="glass-card p-6 border border-white/10 bg-white/5 rounded-xl">
        <div className="flex items-center gap-4">
          <div className={`h-4 w-4 rounded-full ${ws?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">
              {ws?.connected ? 'Servidor Online' : 'Servidor Offline'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {ws?.connected
                ? `${ws?.status?.totalCaptured || 0} velas interceptadas nesta sessão`
                : 'O bot de captura não está respondendo'}
            </p>
          </div>
          {!ws?.connected && (
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Recarregar</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feed em Tempo Real */}
        <div className="glass-card p-4 space-y-3 border border-white/10 bg-white/5 rounded-xl">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Monitoramento ao vivo</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence initial={false}>
              {recentCandles.map((c, i) => {
                const date = new Date(c.created_at)
                const timeAgo = isValid(date)
                  ? formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
                  : 'Agora'

                return (
                  <motion.div
                    key={c.id || c.rodada_id || i}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${i === 0 ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: COLORS[c.cor as keyof typeof COLORS] }}>
                        {Number(c.multiplicador).toFixed(2)}x
                      </span>
                    </div>
                    <Badge variant="outline" className="font-bold" style={{ borderColor: COLORS[c.cor as keyof typeof COLORS], color: COLORS[c.cor as keyof typeof COLORS] }}>
                      {corParaLabel(c.cor)}
                    </Badge>
                    <span className="text-[10px] uppercase font-medium text-muted-foreground ml-auto">
                      {timeAgo}
                    </span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {recentCandles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground animate-pulse">Aguardando sinais do bot...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Gráfico de Barras Coloridas */}
          <div className="glass-card p-4 h-[280px] border border-white/10 bg-white/5 rounded-xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Volatilidade Recente</h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-black/80 border border-white/10 p-2 rounded text-xs font-mono">
                            {payload[0].value}x
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="mult" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.cor as keyof typeof COLORS] || COLORS.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                Aguardando dados para gerar gráfico...
              </div>
            )}
          </div>

          {/* Input de Segurança (Manual) */}
          <div className="glass-card p-6 border border-white/10 bg-white/5 rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Entrada de Contingência</h3>
              <p className="text-xs text-muted-foreground mt-1">Use apenas se a interceptação automática falhar.</p>
            </div>
            <form onSubmit={handleManualEntry} className="flex gap-3">
              <Input
                ref={inputRef}
                type="number" step="0.01" min="1" placeholder="Ex: 2.50"
                value={manualValue} onChange={e => setManualValue(e.target.value)}
                className="bg-white/5 border-white/10 font-mono text-lg h-12"
              />
              <Button type="submit" className="h-12 px-6 bg-blue-600 hover:bg-blue-700">Inserir</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}