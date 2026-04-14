import { useState, useCallback } from 'react'
import { useCandles } from '@/hooks/useCandles'
import { calcularCor, corParaLabel } from '@/utils/candleUtils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useWS } from '@/contexts/WebSocketContext'
import Papa from 'papaparse'
import { toast } from 'sonner'

const COLORS = { blue: 'hsl(217,91%,60%)', purple: 'hsl(263,70%,58%)', pink: 'hsl(330,80%,60%)' }

interface Props {
  open: boolean
  onClose: () => void
}

export default function ImportModal({ open, onClose }: Props) {
  const { addCandle, addBulk } = useCandles()
  const ws = useWS()
  const [manualText, setManualText] = useState('')
  const [csvData, setCsvData] = useState<number[]>([])
  const [importing, setImporting] = useState(false)

  const manualParsed = manualText
    .split(/[,\n]+/)
    .map(s => parseFloat(s.trim()))
    .filter(n => !isNaN(n) && n > 0)

  const handleManualImport = async () => {
    if (manualParsed.length === 0) return
    setImporting(true)
    await addBulk(manualParsed, 'manual')
    toast.success(`${manualParsed.length} velas importadas!`)
    setManualText('')
    setImporting(false)
    onClose()
  }

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const mults = results.data
          .map((row: any) => parseFloat(row.multiplicador || row.multiplier || row.value))
          .filter((n: number) => !isNaN(n) && n > 0)
        setCsvData(mults)
      }
    })
  }, [])

  const handleCsvImport = async () => {
    if (csvData.length === 0) return
    setImporting(true)
    await addBulk(csvData, 'csv')
    toast.success(`${csvData.length} velas importadas do CSV!`)
    setCsvData([])
    setImporting(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Importar velas</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="manual">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
            <TabsTrigger value="csv" className="flex-1">CSV</TabsTrigger>
            <TabsTrigger value="auto" className="flex-1">Servidor</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <textarea
              className="w-full h-32 bg-muted border border-border rounded-lg p-3 text-sm text-foreground resize-none font-mono"
              placeholder="Cole os multiplicadores separados por vírgula ou linha&#10;Ex: 1.24, 5.80, 1.01, 23.4"
              value={manualText} onChange={e => setManualText(e.target.value)}
            />
            {manualParsed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Preview: {manualParsed.length} velas</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {manualParsed.slice(0, 50).map((m, i) => {
                    const cor = calcularCor(m)
                    return <Badge key={i} variant="outline" style={{ borderColor: COLORS[cor], color: COLORS[cor] }} className="text-xs font-mono">{m.toFixed(2)}x</Badge>
                  })}
                  {manualParsed.length > 50 && <span className="text-xs text-muted-foreground">+{manualParsed.length - 50} mais</span>}
                </div>
              </div>
            )}
            <Button onClick={handleManualImport} disabled={manualParsed.length === 0 || importing} className="w-full">
              {importing ? 'Importando...' : `Importar ${manualParsed.length} velas`}
            </Button>
          </TabsContent>

          <TabsContent value="csv" className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Clique para selecionar um arquivo .csv
              </label>
              <p className="text-xs text-muted-foreground mt-2">Coluna "multiplicador" obrigatória</p>
            </div>
            {csvData.length > 0 && (
              <>
                <p className="text-sm text-foreground">{csvData.length} velas encontradas no CSV</p>
                <Button onClick={handleCsvImport} disabled={importing} className="w-full">
                  {importing ? 'Importando...' : `Importar ${csvData.length} velas`}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="auto" className="space-y-4 mt-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${ws.connected ? 'bg-success pulse-green' : 'bg-destructive'}`} />
                <span className="text-sm text-foreground">{ws.connected ? '✅ Recebendo dados automaticamente' : '❌ Servidor desconectado'}</span>
              </div>
              {!ws.connected && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Para receber dados automaticamente:</p>
                  <p>1. Clone o repositório aviator-capture-server</p>
                  <p>2. Configure o .env com suas credenciais</p>
                  <p>3. Execute: <code className="bg-muted px-1 rounded font-mono">npm run dev</code></p>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={ws.reconnect}>
                Testar conexão
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
