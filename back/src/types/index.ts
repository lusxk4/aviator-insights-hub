export interface Candle {
  id: string
  multiplicador: number
  cor: 'blue' | 'purple' | 'pink'
  rodada_id: string
  timestamp: string
  fonte: 'auto'
}

export interface ServerStatus {
  connected: boolean
  loggedIn: boolean
  gameOpen: boolean
  totalCaptured: number
  lastCandle: Candle | null
  uptime: number
  lastError: string | null
}

export interface WSMessage {
  type: 'NEW_CANDLE' | 'STATUS_UPDATE' | 'HISTORY' | 'ERROR' | 'PONG'
  data?: any
  message?: string
}