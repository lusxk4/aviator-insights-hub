import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCandles } from '@/hooks/useCandles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const { user } = useAuth()
  const { candles, clearAll } = useCandles()
  const [wsUrl, setWsUrl] = useState(localStorage.getItem('ws_url') || 'ws://localhost:3001')
  const [streakThreshold, setStreakThreshold] = useState(localStorage.getItem('streak_threshold') || '4')
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('sound_enabled') === 'true')
  const [newPassword, setNewPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveWsUrl = () => {
    localStorage.setItem('ws_url', wsUrl)
    toast.success('URL do servidor salva! Recarregue para aplicar.')
  }

  const saveSettings = () => {
    localStorage.setItem('streak_threshold', streakThreshold)
    localStorage.setItem('sound_enabled', String(soundEnabled))
    toast.success('Configurações salvas!')
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message)
    else { toast.success('Senha atualizada!'); setNewPassword('') }
  }

  const handleClearData = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await clearAll()
    toast.success('Todos os dados foram apagados')
    setConfirmDelete(false)
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(candles, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'aviator_data.json'; a.click()
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0 max-w-2xl">
      <h2 className="text-xl font-bold text-foreground">Configurações</h2>

      <div className="glass-card p-5 space-y-4">
        <h3 className="font-medium text-foreground">Conta</h3>
        <p className="text-sm text-muted-foreground">Email: {user?.email}</p>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Nova senha</label>
          <div className="flex gap-2">
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-muted border-border" placeholder="Nova senha" />
            <Button onClick={handleChangePassword} variant="outline">Alterar</Button>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="font-medium text-foreground">Servidor WebSocket</h3>
        <div className="flex gap-2">
          <Input value={wsUrl} onChange={e => setWsUrl(e.target.value)} className="bg-muted border-border font-mono text-sm" />
          <Button onClick={saveWsUrl} variant="outline">Salvar</Button>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="font-medium text-foreground">Notificações</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Som ao receber rosa</span>
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Limiar de alerta de streak (azuis)</label>
          <Input type="number" value={streakThreshold} onChange={e => setStreakThreshold(e.target.value)} className="bg-muted border-border w-24" />
        </div>
        <Button onClick={saveSettings} variant="outline" size="sm">Salvar preferências</Button>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="font-medium text-foreground">Dados</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportJSON}>Exportar JSON</Button>
          <Button variant="destructive" onClick={handleClearData}>
            {confirmDelete ? '⚠️ Confirmar exclusão' : 'Limpar todos os dados'}
          </Button>
        </div>
        {confirmDelete && <p className="text-xs text-destructive">Clique novamente para confirmar a exclusão de todos os dados.</p>}
      </div>
    </div>
  )
}
