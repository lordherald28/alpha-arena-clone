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
      const previousRsi = rsi.length >= 2 ? rsi[rsi.length - 2] : null; // RSI anterior y con validacion para prevenir errores.
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
          priceBelowEma660: lastClose < lastEma660, // Tendencia bajista
          priceEncimaEma660: lastClose > lastEma660, // Tendencia Alcista
          rsiOverbought: lastRsi > 70, // Sobrecomprado
          rsiOversold: lastRsi < 30 // Sobrevendido
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
            ACTÚA COMO UN ANALISTA DE TRADING DE CRYPTO INTRADIARIO AUTOMATIZADO PROFESIONAL

**CONTEXTO Y ROL:**
Eres un sistema de IA especializado en trading algorítmico de criptomonedas con enfoque en 7 pares principales. Tu función es analizar indicadores técnicos pre-calculados y generar señales de trading automatizadas.

**DATOS DE ENTRADA:**
- Símbolo: ${environment.trading.pair}
- Timeframe: ${environment.trading.interval}
- Precio de cierre: ${lastClose}
- Volumen: ${lastVolume}

**INDICADORES TÉCNICOS PRINCIPALES:**
- EMA 660: ${lastEma660} (tendencia dominante)
- RSI 7: ${lastRsi} (momentum a corto plazo)
- RSI 7 ANTERIOR: ${previousRsi} (para detectar primer toque)
- ATR 14: ${lastAtr14} (volatilidad y gestión de riesgo)
- MACD: ${lastMacd?.MACD} | Señal: ${lastMacd?.signal} | Histograma: ${lastMacd?.histogram}

**ESTADOS DERIVADOS CRÍTICOS:**
- Precio vs EMA660: ${isBelowEma660 ? "ABAJO" : "ARRIBA"}
- Cruce MACD: ${macdCross}

**DETECCIÓN DE PRIMER TOQUE RSI (CRÍTICO):**
- PRIMER TOQUE SOBRECOMPRA: RSI actual >= 70 Y RSI anterior < 70
- PRIMER TOQUE SOBREVENTA: RSI actual <= 30 Y RSI anterior > 30
- NO ES PRIMER TOQUE: Si RSI ya estaba en zona (≥70 o ≤30)

**ESTRATEGIA DE DECISIÓN - REGLAS ESTRICTAS:**

**SEÑAL DE SELL (Corto) - REQUISITOS:**
1. TENDENCIA: Precio por DEBAJO de EMA660 (${isBelowEma660})
2. MOMENTUM: PRIMER TOQUE RSI >=70 (${lastRsi} >=70 y ${previousRsi} <70)
3. CONFIRMACIÓN: MACD en cruce bajista o histograma negativo
4. VOLATILIDAD: ATR14 indica condiciones operables

**SEÑAL DE BUY (Largo) - REQUISITOS:**
1. TENDENCIA: Precio por ENCIMA de EMA660 (${!isBelowEma660})
2. MOMENTUM: PRIMER TOQUE RSI <=30 (${lastRsi} <=30 y ${previousRsi} >30)
3. CONFIRMACIÓN: MACD en cruce alcista o histograma positivo
4. VOLATILIDAD: ATR14 dentro de rangos normales

**GESTIÓN DE RIESGO EN CRYPTO:**
- RIESGO POR OPERACIÓN: 2% del capital
- STOP LOSS: 1.5 x ATR14 desde entrada
- TAKE PROFIT: 2.25 x ATR14 desde entrada
- MÁXIMO: 3 operaciones simultáneas

**EVALUACIÓN DE VOLATILIDAD (ATR14):**
- ATR ALTO (>2% del precio): Reducir tamaño de posición al 1%
- ATR MUY ALTO (>4% del precio): EVITAR operar (HOLD)
- ATR BAJO (<0.5% del precio): Posibles falsos rompimientos

**PRIORIDADES DE DECISIÓN:**
1. SEGURIDAD: Solo operar con confirmación múltiple de indicadores
2. CALIDAD: EXCLUSIVAMENTE señales de PRIMER TOQUE RSI
3. VOLATILIDAD: ATR14 en rangos operables
4. TENDENCIA: Respetar dirección de EMA660

**VALIDACIONES OBLIGATORIAS:**
✅ CONFIRMACIÓN DE TENDENCIA (Precio vs EMA660)
✅ PRIMER TOQUE RSI (cruce limpio 70/30) 
✅ CONFIRMACIÓN MACD (cruce en dirección de la señal)
✅ VOLATILIDAD ADECUADA (ATR14 no extremo)

**JERARQUÍA DE DECISIÓN:**
1. Si TODAS las condiciones de SELL se cumplen → "SELL"
2. Si TODAS las condiciones de BUY se cumplen → "BUY"  
3. Si falta 1 condición → "HOLD" + monitorear
4. Si no es PRIMER TOQUE RSI → DESCARTAR automáticamente
5. Si volatilidad extrema (ATR >4%) → "HOLD" automático

**SALIDA EN FORMATO JSON ESTRICTO (SOLO ESPAÑOL):**
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.85,
  "reason": "Breve justificación técnica mencionando primer toque RSI",
  "risk_parameters": {
    "stop_loss_percent": 1.5,
    "take_profit_percent": 2.25,
    "position_size": 0.02
  }
}

**ESCENARIOS DE EJEMPLO VÁLIDOS:**
- "BUY": Precio > EMA660 + RSI (29.5 vs anterior 31.2) + MACD alcista
- "SELL": Precio < EMA660 + RSI (70.3 vs anterior 69.8) + MACD bajista
- "HOLD": RSI (71.5 vs anterior 71.0) → NO es primer toque

**OBJETIVO:**
Maximizar probabilidad de éxito mediante disciplina estricta en la detección de primer toque RSI, usando múltiples confirmaciones técnicas y gestión de riesgo adaptada a la volatilidad crypto.
    `;
    } catch (error: any) {
      console.error('❌ Error en cálculos técnicos:', error);
      return `Error calculando indicadores: ${error.message}. Verifica los datos de entrada.`;
    }

  }
}