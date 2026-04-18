import { WebSocketServer, WebSocket } from 'ws'
import { Server } from 'http'
import { candleService } from '../services/candleService.js'
import { logger } from '../utils/logger.js'
import { WSMessage } from '../types/index.js'

let wss: WebSocketServer

function buildStatus() {
  return {
    connected: true,
    loggedIn: true,
    gameOpen: true,
    totalCaptured: candleService.getTotalCaptured(),
    lastCandle: candleService.getLastCandle(),
    uptime: process.uptime(),
    lastError: null,
  }
}

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ server })
  logger.info('🔌 WebSocket server iniciado')

  wss.on('connection', (ws: WebSocket) => {
    logger.info('👤 Cliente React conectado')

    // 1. Envia histórico imediatamente ao conectar
    const history = candleService.getCandles(50)
    send(ws, { type: 'HISTORY', data: history })

    // 2. Envia status inicial
    send(ws, { type: 'STATUS_UPDATE', data: buildStatus() })

    // 3. Heartbeat para manter conexão viva
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping()
      }
    }, 30000)

    // 4. Status periódico a cada 5s para o cliente saber que o bot está vivo
    const statusInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        send(ws, { type: 'STATUS_UPDATE', data: buildStatus() })
      }
    }, 5000)

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString())
        if (data.type === 'PING') send(ws, { type: 'PONG' })
      } catch {}
    })

    ws.on('close', () => {
      clearInterval(heartbeat)
      clearInterval(statusInterval)
      logger.info('👤 Cliente React desconectado')
    })

    ws.on('error', (err) => {
      logger.error(`Erro no WebSocket cliente: ${err.message}`)
    })
  })

  // Broadcast de nova vela para todos os clientes conectados
  candleService.on('new_candle', (candle) => {
    broadcast({ type: 'NEW_CANDLE', data: candle })
    // Também atualiza o status após nova vela
    broadcast({ type: 'STATUS_UPDATE', data: buildStatus() })
  })
}

function send(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function broadcast(message: WSMessage) {
  if (!wss) return
  const payload = JSON.stringify(message)
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  })
}