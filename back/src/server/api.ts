import express from 'express'
import { candleService } from '../services/candleService.js'
import { getRawFrames } from '../browser/interceptor.js'
import { getStatus } from '../index.js'

const router = express.Router()

router.get('/status', (req, res) => {
  res.json(getStatus())
})

router.get('/candles', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000)
  const candles = candleService.getCandles(limit)
  res.json({ candles, total: candles.length })
})

router.get('/candles/stats', (req, res) => {
  res.json(candleService.getStats())
})

router.get('/candles/last', (req, res) => {
  res.json(candleService.getLastCandle())
})

router.post('/candles/manual', (req, res) => {
  const { multiplicador } = req.body
  if (!multiplicador || isNaN(multiplicador)) {
    res.status(400).json({ error: 'Multiplicador inválido' })
    return
  }
  const candle = candleService.addCandle(parseFloat(multiplicador), `manual_${Date.now()}`)
  res.json(candle)
})

router.delete('/candles', (req, res) => {
  candleService.clear()
  res.json({ message: 'Buffer limpo' })
})

router.get('/debug/frames', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20
  res.json(getRawFrames().slice(0, limit))
})

export default router