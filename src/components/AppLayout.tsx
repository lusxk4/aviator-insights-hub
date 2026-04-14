import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { BarChart2, Radio, Target, Brain, Settings, LogOut, Plane, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { WebSocketContext } from '@/contexts/WebSocketContext'

const navItems = [
  { to: '/dashboard', icon: BarChart2, label: 'Dashboard' },
  { to: '/realtime', icon: Radio, label: 'Tempo Real' },
  { to: '/strategies', icon: Target, label: 'Estratégias' },
  { to: '/ai', icon: Brain, label: 'IA' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const ws = useWebSocket()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <WebSocketContext.Provider value={ws}>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card fixed h-full z-30">
          <div className="p-4 flex items-center gap-2 border-b border-border">
            <Plane className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-foreground">Aviator Pro</span>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.to === '/realtime' && ws.connected && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-success pulse-green" />
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
          {/* Header */}
          <header className="h-14 border-b border-border bg-card flex items-center px-4 justify-between sticky top-0 z-20">
            <button className="lg:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${ws.connected ? 'bg-success pulse-green' : 'bg-destructive'}`} />
              <span className="text-muted-foreground hidden sm:inline">
                {ws.connected ? 'Servidor conectado' : 'Servidor offline'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Mobile menu overlay */}
          {mobileOpen && (
            <div className="lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm">
              <div className="p-4 space-y-2 pt-16">
                {navItems.map(item => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card flex z-30">
          {navItems.slice(0, 4).map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`
              }
            >
              <item.icon className="h-5 w-5 mb-0.5" />
              <span>{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </WebSocketContext.Provider>
  )
}
