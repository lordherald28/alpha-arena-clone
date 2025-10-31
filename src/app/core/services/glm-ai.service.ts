import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Candlestick, AiResponse } from '../models';
import { environment } from '../../environments/environment';
import { environment as envProd } from '../../environments/environment.prod';

import { RSI, MACD, ATR, EMA } from 'technicalindicators';

@Injectable({
  providedIn: 'root'
})
export class GlmAiService {
  private apiUrl = environment.production ? envProd.glmAi.baseUrl : environment.glmAi.baseUrl;
  // private candles = inject(CoinexService);

  constructor(private http: HttpClient) { console.log('apiUrl: ', this.apiUrl) }

  analyzeMarket(candles: Candlestick[]): Observable<AiResponse> {
    const prompt = this.buildPrompt(candles);

    const body = {
      model: 'glm-4.6', // o 'glm-4' para más capacidad
      messages: [
        { role: 'system', content: 'Eres un experto analista de trading cuantitativo. Tu tarea es analizar datos de mercado y proporcionar una única decisión de trading en formato JSON y RESPONDER EN ESPAÑOL.' },
        { role: 'user', content: prompt }
      ]
    };

    const headers = {
      'Authorization': `Bearer ${environment.glmAi.apiKey}`,
      'Content-Type': 'application/json'
    };

    return this.http.post<any>(this.apiUrl, body, { headers }).pipe(
      map(response => {
        const content = response.choices[0].message.content;
        try {
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          const decisionJson = JSON.parse(jsonMatch ? jsonMatch[1] : content);
          return {
            decision: decisionJson.decision,
            confidence: decisionJson.confidence,
            reason: decisionJson.reason,
            rawJson: decisionJson
          };
        } catch (e) {
          console.error("Error parsing AI response:", e);
          return {
            decision: 'HOLD',
            confidence: 0,
            reason: 'Error al procesar la respuesta de la IA.',
            rawJson: content
          };
        }
      })
    );
  }

  private buildPrompt(candles: Candlestick[]): string {
    if (candles.length < 50) {
      return "No hay suficientes velas para realizar un análisis. Proporciona al menos 50 velas.";
    }

    // this.debugRSI();
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    try {
      // ✅ CÁLCULOS CORREGIDOS con manejo de errores
      const rsi = RSI.calculate({ period: 7, values: closes });
      const ema660 = EMA.calculate({ period: 660, values: closes });

      // ✅ ATR CORREGIDO - Verifica el formato específico
      const atr14 = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14
      });

      const macd = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });

      // ✅ Verificar que los arrays tengan datos
      if (!rsi.length || !ema660.length || !atr14.length || !macd.length) {
        throw new Error('Indicadores vacíos - verificar cálculos');
      }

      // Última vela
      const lastCandle = candles[candles.length - 1];
      const lastClose = lastCandle.close;
      const lastVolume = lastCandle.volume;

      // Últimos valores de indicadores
      const lastRsi = rsi[rsi.length - 1];
      const lastEma660 = ema660[ema660.length - 1];
      const lastAtr14 = atr14[atr14.length - 1];
      const lastMacd = macd[macd.length - 1];

      // ✅ DEBUG COMPLETO - CRÍTICO
      console.log('🐛 DEBUG COMPLETO INDICADORES:', {
        // Datos de entrada
        totalVelas: candles.length,
        ultimos5Closes: closes.slice(-5),

        // Valores actuales
        ultimaVela: {
          timestamp: new Date(lastCandle.timestamp),
          close: lastClose,
          high: lastCandle.high,
          low: lastCandle.low,
          volume: lastVolume
        },

        // Indicadores calculados
        indicadores: {
          rsi: lastRsi,
          ema660: lastEma660,
          atr14: lastAtr14,
          macd: lastMacd
        },

        // Flags calculados
        flags: {
          priceBelowEma660: lastClose < lastEma660,
          rsiOverbought: lastRsi > 70,
          rsiOversold: lastRsi < 30
        },

        // Verificación de arrays
        longitudes: {
          rsi: rsi.length,
          ema660: ema660.length,
          atr14: atr14.length,
          macd: macd.length
        }
      });

      // Derivados
      const isBelowEma660 = lastClose < lastEma660;
      const isRsiOverbought = lastRsi > 70;
      const isRsiOversold = lastRsi < 30;
      const macdCross = (lastMacd?.MACD != null && lastMacd?.signal != null)
        ? (lastMacd.MACD > lastMacd.signal ? 'bullish' : 'bearish')
        : 'unknown';

      // Si el RSI está en 34, estos flags DEBEN ser:
      console.log('🎯 VERIFICACIÓN FLAGS RSI:', {
        rsiValue: lastRsi,
        shouldBeOverbought: isRsiOverbought, // Debe ser FALSE
        shouldBeOversold: isRsiOversold,     // Debe ser TRUE
        actualOverbought: isRsiOverbought,
        actualOversold: isRsiOversold
      });

      // Prompt tipo Alpha Arena
      return `
You are an automated intraday crypto trading analyst.You receive pre - computed indicators.
Your job is to output ONLY a trading action in strict JSON Y EN ESPAÑOL at the end.

MARKET CONTEXT
    symbol: ${environment.trading.pair}
    timeframe: ${environment.trading.interval}
    last_close_price: ${lastClose}
    last_volume: ${lastVolume}

    INDICATORS(most recent value)
    ema660: ${lastEma660}
    atr14: ${lastAtr14}
    rsi7: ${lastRsi}
    macd_line: ${lastMacd?.MACD}
    macd_signal: ${lastMacd?.signal}
    macd_histogram: ${lastMacd?.histogram}
    macd_cross_state: ${macdCross}  // bullish means MACD above signal

DERIVED STATE FLAGS
    price_below_ema660: ${isBelowEma660}
    rsi_overbought_gt70: ${isRsiOverbought}
    rsi_oversold_lt30: ${isRsiOversold}

ENTRY SETUP EVALUATION
    1. Short candidate logic:
    - Condition A: price_below_ema660 === true
      - Condition B: rsi_overbought_gt70 === true
    Interpretation: If BOTH A and B are true, market may be in a rejection after an overextended move. 
   This is a potential SELL setup.
   High atr14 means high volatility and higher risk.Low atr14 means tighter ranges and possible fakeouts.
   Evaluate if SELL is still reasonable now.

2. Long candidate logic:
    - Mirror idea: If price is above ema660 AND RSI is not overbought(rsi7 < 70) AND MACD cross is bullish,
      that suggests continuation to the upside.That is a potential BUY setup.

3. HOLD logic:
    - If neither setup is clean or atr14 implies chaotic conditions that make risk / reward unclear,
      prefer HOLD.

RISK CONTEXT
atr14 represents the typical recent movement size(volatility). 
If atr14 is extremely large relative to price, the move is chaotic.
In chaos, HOLD is usually safer than chasing.

      TASK
Using ONLY the data provided above:
    - Decide the best action NOW: "BUY", "SELL", or "HOLD".
- Give a confidence score between 0 and 1(example: 0.74).
- Give a short reason mentioning the relevant signals(ema660, rsi14, macd_cross_state, atr14, etc).
- Prefer SELL if the short candidate logic is clearly met.
- Prefer BUY if the long candidate logic is clearly met.
- Otherwise HOLD.

OUTPUT FORMAT
Respond ONLY with valid JSON.No markdown fences.No commentary.No explanation before or after.
{
      "decision": "BUY" | "SELL" | "HOLD",
        "confidence": 0.85,
          "reason": "Brief justification. Reference the indicators that matter."
    }
    `;
    } catch (error: any) {
      console.error('❌ Error en cálculos técnicos:', error);
      return `Error calculando indicadores: ${error.message}. Verifica los datos de entrada.`;
    }

  }
}