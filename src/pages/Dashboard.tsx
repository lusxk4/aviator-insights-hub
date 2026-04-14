import { useState, useMemo } from 'react'
import { useCandles } from '@/hooks/useCandles'
import { detectarPadroes, corParaLabel } from '@/utils/candleUtils'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush, ReferenceLine, PieChart, Pie, Cell } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Upload } from 'lucide-react'
import ImportModal from '@/components/ImportModal'
import { format } from 'date-fns'

const COLORS = { blue: 'hsl(217,91%,60%)', purple: 'hsl(263,70%,58%)', pink: 'hsl(330,80%,60%)' }
const LIMITS = [50, 100, 200, 500, 1000]

export default function DashboardPage() {
  const [limit, setLimit] = useState(200)
  const [importOpen, setImportOpen] = useState(false)
  const { candles, stats, loading } = useCandles({ limit })

  const padroes = useMemo(() => detectarPadroes(candles), [candles])
  const chartData = useMemo(() =>
    candles.map((c, i) => ({ index: i + 1, mult: c.multiplicador, cor: c.cor })),
    [candles]
  )
  const pieData = useMemo(() => [
    { name: 'Azul', value: stats.blue.count, color: COLORS.blue },
    { name: 'Roxa', value: stats.purple.count, color: COLORS.purple },
    { name: 'Rosa', value: stats.pink.count, color: COLORS.pink },
  ], [stats])

  const maiorCandle = useMemo(() => {
    if (candles.length === 0) return null
    return candles.reduce((max, c) => c.multiplicador > max.multiplicador ? c : max, candles[0])
  }, [candles])

  const exportCSV = () => {
    const csv = ['multiplicador,cor,fonte,data', ...candles.map(c => `${c.multiplicador},${c.cor},${c.fonte},${c.created_at}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'aviator_data.csv'; a.click()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {LIMITS.map(l => (
            <button key={l} onClick={() => setLimit(l)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${l === limit ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >{l}</button>
          ))}
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" /> Importar
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total de velas" value={stats.total.toString()} />
        <MetricCard label="Maior multiplicador" value={`${stats.maior.toFixed(2)}x`}
          sub={maiorCandle ? format(new Date(maiorCandle.created_at), 'dd/MM HH:mm') : ''} />
        <MetricCard label="Média geral" value={`${stats.media.toFixed(2)}x`} />
        <MetricCard
          label="Streak atual"
          value={`${stats.streakAtual.count} ${corParaLabel(stats.streakAtual.cor).toLowerCase()}${stats.streakAtual.count !== 1 ? 's' : ''}`}
          color={stats.streakAtual.cor}
        />
      </div>

      {/* Distribuição + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {(['blue', 'purple', 'pink'] as const).map(cor => {
          const s = stats[cor]
          return (
            <div key={cor} className="glass-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS[cor] }} />
                <span className="text-sm font-medium text-foreground">{corParaLabel(cor)}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: COLORS[cor] }}>{s.percent.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">{s.count} velas</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${s.percent}%`, background: COLORS[cor] }} />
              </div>
              {cor === 'pink' && stats.intervalMedioRosa > 0 && (
                <p className="text-xs text-muted-foreground">1 a cada ~{stats.intervalMedioRosa} rodadas</p>
              )}
            </div>
          )
        })}
        <div className="glass-card p-4 flex items-center justify-center">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Histórico de multiplicadores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="index" stroke="hsl(220,10%,30%)" fontSize={11} />
              <YAxis stroke="hsl(220,10%,30%)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(240,15%,8%)', border: '1px solid hsl(240,10%,18%)', borderRadius: 8, color: '#fff' }}
                formatter={(val: number) => [`${val.toFixed(2)}x`, 'Multiplicador']}
              />
              <ReferenceLine y={2} stroke={COLORS.purple} strokeDasharray="3 3" label={{ value: '2x', fill: COLORS.purple, fontSize: 10 }} />
              <ReferenceLine y={10} stroke={COLORS.pink} strokeDasharray="3 3" label={{ value: '10x', fill: COLORS.pink, fontSize: 10 }} />
              <Area type="monotone" dataKey="mult" stroke={COLORS.blue} fill="url(#grad)" strokeWidth={1.5}
                dot={false} activeDot={{ r: 4, fill: COLORS.blue }} />
              <Brush dataKey="index" height={20} stroke={COLORS.blue} fill="hsl(240,15%,8%)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Padrões */}
      {padroes.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Padrões detectados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {padroes.map((p, i) => (
              <div key={i} className={`text-sm p-3 rounded-lg ${p.includes('ALERTA') ? 'bg-warning/10 border border-warning/30 text-warning' : 'bg-muted text-muted-foreground'}`}>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Multiplicador</th>
                <th className="text-left p-3 font-medium">Cor</th>
                <th className="text-left p-3 font-medium">Fonte</th>
                <th className="text-left p-3 font-medium">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {candles.slice(-20).reverse().map((c, i) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 text-muted-foreground">{candles.length - i}</td>
                  <td className="p-3 font-mono font-medium" style={{ color: COLORS[c.cor] }}>{c.multiplicador.toFixed(2)}x</td>
                  <td className="p-3"><Badge variant="outline" style={{ borderColor: COLORS[c.cor], color: COLORS[c.cor] }}>{corParaLabel(c.cor)}</Badge></td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs">{c.fonte}</Badge></td>
                  <td className="p-3 text-muted-foreground">{format(new Date(c.created_at), 'dd/MM/yy HH:mm:ss')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const colorStyle = color ? { color: COLORS[color as keyof typeof COLORS] } : {}
  return (
    <div className="glass-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold" style={colorStyle}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
