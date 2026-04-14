import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plane } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('type=recovery')) {
      navigate('/login')
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md glass-card p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">Senha atualizada!</h2>
          <Button onClick={() => navigate('/login')}>Ir para Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md glass-card p-8 space-y-6">
        <div className="text-center">
          <Plane className="h-8 w-8 text-primary mx-auto mb-2" />
          <h1 className="text-xl font-bold text-foreground">Nova senha</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="password" placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)} required className="bg-muted border-border" />
          <Input type="password" placeholder="Confirmar" value={confirm} onChange={e => setConfirm(e.target.value)} required className="bg-muted border-border" />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Salvando...' : 'Salvar nova senha'}</Button>
        </form>
      </div>
    </div>
  )
}
