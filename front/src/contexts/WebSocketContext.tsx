import { createContext, useContext } from 'react'
import { Candle, ServerStatus } from '@/types'

interface WebSocketContextType {
  candles: Candle[]
  status: ServerStatus
  connected: boolean
  lastCandle: Candle | null
  reconnect: () => void
}

export const WebSocketContext = createContext<WebSocketContextType>({
  candles: [],
  status: { connected: false, loggedIn: false, gameOpen: false, totalCaptured: 0, lastCandle: null, uptime: 0, lastError: null },
  connected: false,
  lastCandle: null,
  reconnect: () => {},
})

export function useWS() {
  return useContext(WebSocketContext)
}
