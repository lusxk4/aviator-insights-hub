import { WebSocketServer, WebSocket } from 'ws'
import { Server } from 'http'
import { candleService } from '../services/candleService.js'
import { logger } from '../utils/logger.js'
import { WSMessage } from '../types/index.js'

let wss: WebSocketServer

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ server })

  logger.info('🔌 WebSocket server iniciado')

  wss.on('connection', (ws: WebSocket) => {
    logger.info('👤 Cliente React conectado')

    const history = candleService.getCandles(50)
    send(ws, { type: 'HISTORY', data: history })

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping()
      }
    }, 30000)

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString())
        if (data.type === 'PING') send(ws, { type: 'PONG' })
      } catch {}
    })

    ws.on('close', () => {
      clearInterval(heartbeat)
      logger.info('👤 Cliente React desconectado')
    })

    ws.on('error', (err) => {
      logger.error(`Erro no WebSocket cliente: ${err.message}`)
    })
  })

  candleService.on('new_candle', (candle) => {
    broadcast({ type: 'NEW_CANDLE', data: candle })
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