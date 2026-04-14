import { useState } from 'react'
import { useCandles } from '@/hooks/useCandles'
import { analyzeCandles } from '@/services/aiService'
import { AIAnalysis } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Brain, Send, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const MOCK_INSIGHTS = [
  { icon: '📊', text: 'Padrão detectado: Alta concentração de azuis (72%) nas últimas 100 rodadas' },
  { icon: '🎯', text: 'Estratégia recomendada agora: Martingale Azul (condições favoráveis)' },
  { icon: '⚡', text: 'Volatilidade: Baixa — últimas 50 rodadas sem rosa' },
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function AIPage() {
  const { candles } = useCandles({ limit: 1000 })
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')

  const handleAnalyze = async () => {
    if (candles.length === 0) return
    setAnalyzing(true)
    const result = await analyzeCandles(candles)
    setAnalysis(result)
    setAnalyzing(false)
  }

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput }
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: `Baseado nos ${candles.length} registros disponíveis, analisando "${chatInput}"... Esta funcionalidade será integrada com IA em breve. Por enquanto, use o botão "Analisar" para uma análise completa dos dados.`,
    }
    setChatMessages(prev => [...prev, userMsg, assistantMsg])
    setChatInput('')
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0 max-w-4xl">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-secondary" />
        <h2 className="text-xl font-bold text-foreground">Análise com IA</h2>
      </div>

      {/* Botão principal */}
      <div className="glass-card p-6 text-center space-y-4">
        <Sparkles className="h-12 w-12 text-secondary mx-auto" />
        <h3 className="text-lg font-semibold text-foreground">Análise inteligente dos seus dados</h3>
        <p className="text-sm text-muted-foreground">{candles.length} velas disponíveis para análise</p>
        <Button onClick={handleAnalyze} disabled={analyzing || candles.length === 0} size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
          {analyzing ? 'Analisando...' : '🤖 Analisar últimas velas'}
        </Button>
      </div>

      {/* Resultado */}
      {analyzing && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {analysis && !analyzing && (
        <div className="space-y-4 fade-in">
          <div className="glass-card p-5 space-y-3">
            <h4 className="font-semibold text-foreground">Resumo</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.resumo}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Padrão</p>
              <p className="text-sm font-medium text-foreground mt-1">{analysis.padrao}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Estratégia recomendada</p>
              <p className="text-sm font-medium text-primary mt-1">{analysis.estrategiaRecomendada}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Confiança</p>
              <p className="text-sm font-medium text-foreground mt-1">{(analysis.confianca * 100).toFixed(0)}%</p>
            </div>
          </div>
          <div className="glass-card p-5 space-y-2">
            <h4 className="font-semibold text-foreground text-sm">Insights</h4>
            {analysis.insights.map((ins, i) => (
              <p key={i} className="text-sm text-muted-foreground">• {ins}</p>
            ))}
          </div>
        </div>
      )}

      {/* Insights mockados */}
      {!analysis && !analyzing && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MOCK_INSIGHTS.map((ins, i) => (
            <div key={i} className="glass-card p-4 space-y-2">
              <span className="text-2xl">{ins.icon}</span>
              <p className="text-sm text-muted-foreground">{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chat */}
      <div className="glass-card p-5 space-y-4">
        <h4 className="text-sm font-medium text-foreground">Pergunte sobre os padrões</h4>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`text-sm p-3 rounded-lg ${msg.role === 'user' ? 'bg-primary/10 text-foreground ml-8' : 'bg-muted text-muted-foreground mr-8'}`}>
              {msg.content}
            </div>
          ))}
        </div>
        <form onSubmit={handleChat} className="flex gap-2">
          <Input
            placeholder="Pergunte sobre os padrões..."
            value={chatInput} onChange={e => setChatInput(e.target.value)}
            className="bg-muted border-border"
          />
          <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  )
}
