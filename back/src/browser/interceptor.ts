import { Page, Frame } from 'playwright'
import { logger } from '../utils/logger.js'
import { candleService } from '../services/candleService.js'
import { saveCandle } from '../services/supabaseService.js'

let GLOBAL_LAST_ROUND_ID = '';

export function getRawFrames() { return []; }
export function getDetectedWSUrls() { return []; }

/**
 * Inicia a interceptação Híbrida (Histórico da Barra + WebSocket Realtime)
 */
export async function startInterception(page: Page): Promise<void> {
  logger.info('🔍 Iniciando interceptação Híbrida FINAL...')
  
  // 1. WebSocket Nativo (Interceptação de baixo nível)
  page.on('websocket', ws => {
    if (ws.url().includes('aviator') || ws.url().includes('p-j-0-h')) {
      ws.on('framereceived', f => {
        // Tratamos sempre como Buffer para não corromper o binário
        const payload = Buffer.isBuffer(f.payload) ? f.payload : Buffer.from(f.payload);
        tryParseCandle(payload);
      });
    }
  });

  const frame = await forceReloadGameIframe(page);
  
  if (frame) {
    // 2. Sincroniza o que já está na tela (bolinhas coloridas)
    await scrapeHistory(frame);
    
    // 3. Polling interno de segurança (Redundância)
    startPolling(frame);
  }

  // Se o usuário der F5, o bot se reanexa automaticamente
  page.on('framenavigated', f => {
    if (f.url().includes('p-j-0-h')) {
      logger.info('🔄 Navegação detectada, reativando monitoramento...');
      setTimeout(() => startPolling(f), 2000);
    }
  });

  logger.info('✅ Monitoramento total ativo!');
}

/**
 * Scrape das bolinhas que já aparecem no topo do jogo
 */
async function scrapeHistory(frame: Frame) {
  logger.info('📜 Sincronizando histórico visual da barra...');
  try {
    await frame.waitForTimeout(5000);
    const historyData = await frame.evaluate(() => {
      // Seletores padrão do Aviator para a barra de histórico
      const selectors = '.payouts-block .payout, .stats-list .payout, .bubble-multiplier';
      const items = Array.from(document.querySelectorAll(selectors));
      return items.map(el => {
        const text = el.textContent?.trim() || '';
        const val = parseFloat(text.replace('x', ''));
        return (!isNaN(val) && val > 0) ? { val, id: `hist_${val}_${Math.random().toString(36).substr(2, 5)}` } : null;
      }).filter(Boolean);
    });

    if (historyData.length > 0) {
      // Pegamos as últimas 35 encontradas
      const cleanHistory = historyData.slice(0, 35);
      logger.info(`📦 Sucesso! ${cleanHistory.length} velas sincronizadas do histórico.`);
      for (const item of cleanHistory.reverse()) {
        const candle = candleService.addCandle(item!.val, item!.id);
        await saveCandle(candle);
      }
    }
  } catch (err) {}
}

async function forceReloadGameIframe(page: Page): Promise<Frame | null> {
  try {
    await page.evaluate(() => {
      const gameIframe = Array.from(document.querySelectorAll('iframe')).find(f =>
        f.src && (f.src.includes('p-j-0-h') || f.src.includes('aviator'))
      ) as HTMLIFrameElement;
      if (gameIframe) {
        const src = gameIframe.src;
        gameIframe.src = '';
        setTimeout(() => { gameIframe.src = src; }, 100);
      }
    });
    await page.waitForTimeout(6000);
    return page.frames().find(f => f.url().includes('p-j-0-h') || f.url().includes('aviator')) || null;
  } catch (err) { return null; }
}

function startPolling(frame: Frame): void {
  const url = frame.url();
  if (!url || url === 'about:blank' || !url.includes('p-j-0-h')) return;
  if ((frame as any)._isCapturing) return;
  (frame as any)._isCapturing = true;

  let lastIndex = 0;
  const interval = setInterval(async () => {
    try {
      if (frame.isDetached()) return clearInterval(interval);
      const messages = await frame.evaluate((idx) => {
        const msgs = (window as any).__wsMessages || [];
        return msgs.slice(idx);
      }, lastIndex);

      if (messages && messages.length > 0) {
        lastIndex += messages.length;
        for (const msg of messages) {
          const payload = msg.isBinary ? Buffer.from(msg.payload, 'base64') : Buffer.from(msg.payload);
          tryParseCandle(payload);
        }
      }
    } catch (e) {
      clearInterval(interval);
      (frame as any)._isCapturing = false;
    }
  }, 400);
}

// ─── PARSER DE ALTA PRECISÃO ─────────────────────────────────────────────────

function tryParseCandle(buf: Buffer): void {
  try {
    let mult: number | null = null;
    let rId: string | null = null;
    const payloadStr = buf.toString('utf8');

    // 1. Tenta extrair via JSON (Texto plano)
    if (payloadStr.trim().startsWith('{')) {
      try {
        const data = JSON.parse(payloadStr);
        // Regra de Ouro: Ignora pacotes do tipo 'f' (fly/subindo)
        if (data.type === 'f' || data.type === 'stage') return;
        
        mult = data.crash || data.multiplier || (data.data && data.data.multiplier);
        rId = data.round_id || data.id || (data.data && data.data.id);
      } catch (e) {}
    }

    // 2. Tenta extrair via Binário (Protocolo Spribe)
    if (mult === null && buf.length > 35) {
      // Só procuramos o multiplicador se o pacote for de encerramento (crash/history)
      const markers = ['crash', 'maxMultiplier', 'history'];
      for (const m of markers) {
        const idx = buf.indexOf(m, 0, 'utf8');
        if (idx !== -1) {
          // O valor final é sempre um Double (8 bytes) Big Endian após o marcador
          const val = buf.readDoubleBE(idx + m.length);
          if (!isNaN(val) && val >= 1.0 && val < 50000) {
            mult = Number(val.toFixed(2));
            // Busca o ID da rodada para validar que NÃO é um tick de subida
            const idIdx = buf.indexOf('id', 0, 'utf8');
            if (idIdx !== -1) {
              rId = buf.slice(idIdx + 2, idIdx + 14).toString('utf8').replace(/[^a-zA-Z0-9]/g, '');
            }
            break;
          }
        }
      }
    }

    // SALVAMENTO ÚNICO: Só salva se tiver MULTIPLICADOR e um ID DE RODADA
    if (mult && mult >= 1 && rId) {
      // Se o ID for igual ao último, é duplicata do mesmo pacote. Ignora.
      if (rId === GLOBAL_LAST_ROUND_ID) return;
      
      GLOBAL_LAST_ROUND_ID = rId;

      logger.info(`🕯️ Vela Realtime Detectada: ${mult.toFixed(2)}x (Round: ${rId})`);
      const candle = candleService.addCandle(mult, rId);
      saveCandle(candle);
    }
  } catch (err) {
    // Silencia erros binários para não poluir o terminal
  }
}