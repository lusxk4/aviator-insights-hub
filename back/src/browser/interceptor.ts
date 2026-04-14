import { Page, Frame } from 'playwright'
import { logger } from '../utils/logger.js'
import { candleService } from '../services/candleService.js'
import { saveCandle } from '../services/supabaseService.js'

let GLOBAL_LAST_ROUND_ID = '';

export function getRawFrames() { return []; }
export function getDetectedWSUrls() { return []; }

/**
 * Inicia a interceptação Híbrida (Barra de Histórico + WebSocket Realtime)
 */
export async function startInterception(page: Page): Promise<void> {
  logger.info('🔍 Iniciando interceptação Híbrida (Histórico + Realtime)...')
  
  // 1. Monitoramento via WebSocket (Para pegar a vela no exato momento do crash)
  page.on('websocket', ws => {
    if (ws.url().includes('aviator') || ws.url().includes('p-j-0-h')) {
      ws.on('framereceived', f => tryParseCandle(f.payload.toString(), false));
    }
  });

  // 2. Reinicia o iframe para garantir contexto limpo
  const frame = await forceReloadGameIframe(page);
  
  if (frame) {
    // 3. Sincroniza o histórico VISUAL (as bolinhas que já estão lá)
    await scrapeHistory(frame);
    
    // 4. Mantém o polling para mensagens injetadas via Launcher
    startPolling(frame);
  }

  // Proteção para reconexão em caso de navegação
  page.on('frameattached', f => setTimeout(() => startPolling(f), 2000));
  page.on('framenavigated', f => setTimeout(() => startPolling(f), 1000));

  logger.info('✅ Sistema Híbrido Ativo!');
}

/**
 * Lê a barra de histórico (bolinhas coloridas) para popular o banco inicialmente
 */
async function scrapeHistory(frame: Frame) {
  logger.info('📜 Sincronizando histórico real da barra de bolinhas...');
  try {
    // Aguarda o carregamento visual dos elementos
    await frame.waitForTimeout(5000);

    const historyData = await frame.evaluate(() => {
      // Seletores específicos da barra de histórico do Aviator
      const selectors = '.payouts-block .payout, .stats-list .payout, .history-item, .bubble-multiplier';
      const items = Array.from(document.querySelectorAll(selectors));
      
      return items.map(el => {
        const text = el.textContent?.trim() || '';
        const val = parseFloat(text.replace('x', ''));
        if (!isNaN(val) && val > 0) {
          return {
            val: val,
            id: `hist_${val}_${Math.random().toString(36).substr(2, 5)}`
          };
        }
        return null;
      }).filter((item): item is {val: number, id: string} => item !== null);
    });

    if (historyData.length > 0) {
      // Pegamos apenas as últimas 35 para evitar pegar "lixo" de cache
      const cleanHistory = historyData.slice(0, 35);
      logger.info(`📦 Sincronizando ${cleanHistory.length} velas reais encontradas na barra.`);
      
      // Inverte para salvar na ordem cronológica correta no banco
      for (const item of cleanHistory.reverse()) {
        const candle = candleService.addCandle(item.val, item.id);
        await saveCandle(candle);
      }
    } else {
      logger.warn('⚠️ Não foi possível ler a barra de histórico. O jogo pode estar em carregamento.');
    }
  } catch (err: any) {
    logger.error(`❌ Erro no Scrape: ${err.message}`);
  }
}

async function forceReloadGameIframe(page: Page): Promise<Frame | null> {
  try {
    logger.info('🔄 Preparando contexto do jogo...');
    const frameFound = await page.evaluate(() => {
      const gameIframe = Array.from(document.querySelectorAll('iframe')).find(f =>
        f.src && (f.src.includes('p-j-0-h') || f.src.includes('aviator'))
      ) as HTMLIFrameElement;
      if (gameIframe) {
        const src = gameIframe.src;
        gameIframe.src = '';
        setTimeout(() => { gameIframe.src = src; }, 100);
        return true;
      }
      return false;
    });
    
    await page.waitForTimeout(6000);
    const frames = page.frames();
    return frames.find(f => f.url().includes('p-j-0-h') || f.url().includes('aviator')) || null;
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
          tryParseCandle(msg.payload, msg.isBinary);
        }
      }
    } catch (e) {
      clearInterval(interval);
      (frame as any)._isCapturing = false;
    }
  }, 400);
}

function tryParseCandle(payload: string, isBinary: boolean): void {
  try {
    let mult: number | null = null;
    let rId: string | null = null;

    if (isBinary) {
      const buf = Buffer.from(payload, 'base64');
      if (buf.length < 15) return;
      const markers = ['crash', 'maxMultiplier', 'final_multiplier'];
      for (const m of markers) {
        const idx = buf.indexOf(m, 0, 'utf8');
        if (idx !== -1) {
          mult = buf.readDoubleBE(idx + m.length);
          const idIdx = buf.indexOf('id', 0, 'utf8');
          if (idIdx !== -1) rId = buf.slice(idIdx + 2, idIdx + 14).toString('utf8').replace(/[^a-zA-Z0-9]/g, '');
          break;
        }
      }
    } else {
      const trimmed = payload.trim();
      if (!trimmed.startsWith('{')) return;
      const data = JSON.parse(trimmed);
      
      // Filtro Spribe: ignore pacotes de 'type': 'f' (fly/voo), aceite 'v' (valor final)
      if (data.type === 'f') return;

      mult = data.crash || data.multiplier || (data.data && data.data.multiplier);
      rId = data.round_id || data.id || (data.data && data.data.id);
    }

    if (mult && mult >= 1 && rId) {
      if (rId === GLOBAL_LAST_ROUND_ID) return;
      GLOBAL_LAST_ROUND_ID = rId;
      logger.info(`🕯️ Vela Detectada (Realtime): ${mult.toFixed(2)}x`);
      const candle = candleService.addCandle(mult, rId);
      saveCandle(candle);
    }
  } catch (err) {}
}  iS5-Twe-Ehe-Fr9