import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plane } from 'lucide-react'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await resetPassword(email)
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md glass-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <Plane className="h-8 w-8 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Recuperar senha</h1>
        </div>
        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Email enviado! Verifique sua caixa de entrada.</p>
            <Link to="/login"><Button variant="outline">Voltar ao login</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="email" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-muted border-border" />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</Button>
            <Link to="/login" className="text-primary hover:underline text-sm block text-center">Voltar ao login</Link>
          </form>
        )}
      </div>
    </div>
  )
}
