import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { Candlestick, AiResponse, TypeMarket } from '../../models';
import { environment } from '../../../environments/environment';
import { environment as envProd } from '../../../environments/environment.prod';
import { IndicatorServices } from '../helpers/indicators.service';
import { GenerateServicePrompt } from '../helpers/ia/generate-prompt-ia.services';
import { IAService } from '../../base/index';

// TODO deuda tecnica aqui, hay ciertas funcionalidades o variables que no deberian ser de esta clase, deben estar en el servicio del broker
@Injectable({
  providedIn: 'root'
})
export class GlmAiService implements IAService {


  readonly apiUrl: string = 'https://openrouter.ai/api/v1/chat/completions';
  private apiKey = environment.deepseek.apiKey; // Tu key de OpenRouter
  // private apiUrl = environment.production ? envProd.glmAi.baseUrl : environment.glmAi.baseUrl;


  private readonly http = inject(HttpClient);
  // private readonly generatePrompt = inject(GenerateServicePrompt);
  private readonly indicators = inject(IndicatorServices);



  analyzeMarket(candles: Candlestick[], accountBalance: number, openPositions: number, typeMarket: TypeMarket): Observable<AiResponse> {
    const prompt = this.buildPrompt(candles, accountBalance, openPositions, typeMarket);

    // Aplicar pre-filtro antes de llamar a IA
    if (!this.shouldAnalyzeWithAI(candles, accountBalance, openPositions)) {
      console.log('🚫 Pre-filter: No se cumplen condiciones para llamar a IA. Retornando HOLD automático.');
      return of({
        decision: 'HOLD',
        confidence: 0,
        reason: 'Pre-filter: Condiciones de mercado no óptimas para análisis IA',
        rawJson: null
      });
    }

    const body = {
      model: 'deepseek/deepseek-v3.1-terminus:exacto',
      messages: [
        { role: 'system', content: 'Eres un experto analista de trading cuantitativo. Tu tarea es analizar datos de mercado y proporcionar una única decisión de trading en formato JSON y RESPONDER EN ESPAÑOL.' },
        { role: 'user', content: prompt }
      ],
      // top_p: 0.92,
      max_tokens: 600,
      // frequency_penalty: 0.1,  // Evita repeticiones
      // presence_penalty: 0.05   // Mantiene contexto
    };

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://zion-capital-algorithm.com', // Opcional
      'X-Title': 'Zion Capital Algorithm' // Opcional
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

  private buildPrompt(candles: Candlestick[], accountBalance: number, openPositions: number, typeMarket: TypeMarket): string {
    // if (candles.length < 50) {
    //   return "No hay suficientes velas para realizar un análisis. Proporciona al menos 50 velas.";
    // }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    try {
      // ✅ CÁLCULOS CORREGIDOS con manejo de errores
      const rsi = this.indicators.calculateRSI(closes, 7);
      const ema660 = this.indicators.calculateEMA(closes, 660);
      const atr14 = this.indicators.calculateATR(highs, lows, closes, 14);

      // ✅ Verificar que los arrays tengan datos
      if (!rsi.length || !ema660.length || !atr14.length) {
        throw new Error('Indicadores vacíos - verificar cálculos');
      }

      // Última vela
      const lastCandle = candles[candles.length - 1];
      const lastClose = lastCandle.close;

      // Últimos valores de indicadores
      const previousRsi = rsi.length >= 2 ? rsi[rsi.length - 2] : rsi[rsi.length - 1];
      const lastRsi = rsi[rsi.length - 1];
      const lastEma660 = ema660[ema660.length - 1];
      const lastAtr14 = atr14[atr14.length - 1];

      // Derivados críticos
      const priceVsEma = lastClose > lastEma660 ? "ABOVE" : "BELOW";
      const isFirstTouchOversold = lastRsi <= 30 && previousRsi > 30;
      const isFirstTouchOverbought = lastRsi >= 70 && previousRsi < 70;
      const atrPercent = (lastAtr14 / lastClose) * 100;

      // Gestión de volatilidad basada en ATR
      let volatilityCondition = "NORMAL";
      let positionSize = 0.02; // 2%

      if (atrPercent > 4) {
        volatilityCondition = "EXTREME - NO TRADING";
        positionSize = 0;
      } else if (atrPercent > 2) {
        volatilityCondition = "HIGH - REDUCE SIZE";
        positionSize = 0.01; // 1%
      }

      const maxPositionValue = accountBalance * positionSize;

      // Prompt completo y profesional
      return `
ACT AS A PROFESSIONAL AUTOMATED INTRADAY CRYPTO TRADING ANALYST

**CONTEXT AND ROLE:**
You are an AI system specialized in algorithmic cryptocurrency trading. Your function is to analyze pre-calculated technical indicators and generate automated trading signals with professional risk management.

**COMPLETE INPUT DATA:**
- Symbol: ${typeMarket.market}
- Timeframe: ${typeMarket.interval}
- Last Close Price: ${lastClose.toFixed(4)}
- EMA660: ${lastEma660.toFixed(4)}
- RSI 7: ${lastRsi.toFixed(2)}
- Previous RSI 7: ${previousRsi.toFixed(2)}
- ATR 14: ${lastAtr14.toFixed(6)}
- ATR % of Price: ${atrPercent.toFixed(2)}%
- Account Balance: ${accountBalance} USDT
- Open Positions: ${openPositions}
- Available Positions: ${Math.max(0, 3 - openPositions)}

**CRITICAL DERIVED STATES:**
- Price vs EMA660: ${priceVsEma}
- RSI First Touch Oversold (<=30): ${isFirstTouchOversold}
- RSI First Touch Overbought (>=70): ${isFirstTouchOverbought}
- Volatility Condition: ${volatilityCondition}

**STRICT TREND DIRECTION ENFORCEMENT:**
- IF PRICE ABOVE EMA660 → Only consider BUY signals (ignore sell signals)
- IF PRICE BELOW EMA660 → Only consider SELL signals (ignore buy signals)
- NO EXCEPTIONS: Never trade against the EMA660 trend direction

**DECISION STRATEGY - STRICT RULES:**

**SELL SIGNAL (Short) - ALL REQUIREMENTS MUST BE MET:**
1. TREND: Price BELOW EMA660
2. MOMENTUM: FIRST TOUCH RSI >=70 (Current RSI >=70 AND Previous RSI <70)
3. VOLATILITY: ATR14 not in extreme condition (ATR% < 4%)
4. RISK CAPACITY: Available balance > position size AND available positions > 0

**BUY SIGNAL (Long) - ALL REQUIREMENTS MUST BE MET:**
1. TREND: Price ABOVE EMA660
2. MOMENTUM: FIRST TOUCH RSI <=30 (Current RSI <=30 AND Previous RSI >30)
3. VOLATILITY: ATR14 not in extreme condition (ATR% < 4%)
4. RISK CAPACITY: Available balance > position size AND available positions > 0

**AUTOMATIC HOLD CONDITIONS (Priority Order):**
1. If available positions <= 0 → HOLD (max capacity)
2. If ATR% >= 4 → HOLD (extreme volatility)
3. If ATR% < 0.5% → HOLD (low volatility) 
4. If no first touch RSI condition → HOLD
5. If trading against EMA660 trend → HOLD


**VOLATILITY MANAGEMENT:**
- TOO LOW (ATR% < 0.5%): NO TRADING (low volatility)
- NORMAL (ATR% < 2%): Standard 2% position
- HIGH (ATR% 2-4%): Reduced 1% position
- EXTREME (ATR% >= 4%): No trading

**STRICT JSON OUTPUT FORMAT (SPANISH ONLY):**
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0,
  "symbol": "${typeMarket.market}",
  "reason": "Brief technical and risk management justification in Spanish",
  "risk_parameters": {
    "stop_loss_percent": 0.0,
    "take_profit_percent": 0.0,
    "position_size": 0.0,
    "max_position_value": 0.0
  }
}

**VALID DECISION EXAMPLES:**
- "BUY": Price > EMA660 + RSI First Touch Oversold (29.5 vs previous 31.2) + Normal Volatility + Sufficient Balance
- "SELL": Price < EMA660 + RSI First Touch Overbought (70.3 vs previous 69.8) + Normal Volatility + Sufficient Balance
- "HOLD": RSI (71.5 vs previous 71.0) → NOT first touch
- "HOLD": Price below EMA660 but RSI in oversold → Against trend
- "HOLD": ATR% > 4% → Extreme volatility

**OBJECTIVE:**
Maximize long-term profitability through strict risk management, capital preservation, and disciplined trading based on technical signals and account capacity.

**ANALYZE THE CURRENT SITUATION AND PROVIDE ONLY THE JSON RESPONSE:**
`;
    } catch (error: any) {
      console.error('❌ Error en cálculos técnicos:', error);
      return `Error calculando indicadores: ${error.message}. Verifica los datos de entrada.`;
    }
  }

  // ✅ NUEVO MÉTODO DE PRE-FILTRO
  private shouldAnalyzeWithAI(candles: Candlestick[], accountBalance: number, openPositions: number): boolean {
    if (candles.length < 50) {
      console.log('❌ Pre-filter: No hay suficientes velas');
      return false;
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    try {
      // Cálculos rápidos para pre-filtro
      const rsi = this.indicators.calculateRSI(closes, 7);
      const ema660 = this.indicators.calculateEMA(closes, 660);
      const atr14 = this.indicators.calculateATR(highs, lows, closes, 14);

      if (!rsi.length || !ema660.length || !atr14.length) {
        console.log('❌ Pre-filter: Indicadores vacíos');
        return false;
      }

      // Últimos valores
      const lastCandle = candles[candles.length - 1];
      const lastClose = lastCandle.close;
      const previousRsi = rsi.length >= 2 ? rsi[rsi.length - 2] : rsi[rsi.length - 1];
      const lastRsi = rsi[rsi.length - 1];
      const lastEma660 = ema660[ema660.length - 1];
      const lastAtr14 = atr14[atr14.length - 1];
      const atrPercent = (lastAtr14 / lastClose) * 100;

      // ✅ CONDICIONES DE PRE-FILTRO (EVITAR LLAMADAS INNECESARIAS A IA)
      const preFilterConditions = {
        // 1. Verificar si RSI está cerca de niveles críticos (evitar llamar cuando está en 50-60)
        isRsiNearCriticalLevels: lastRsi <= 35 || lastRsi >= 65,

        // 2. Verificar volatilidad operable
        isVolatilityOperable: atrPercent >= 0.5 && atrPercent < 4,

        // 3. Verificar capacidad de riesgo
        // hasRiskCapacity: accountBalance >= 3 && openPositions < 3, // 3 USDT mínimo y menos de 3 posiciones

        // 4. Verificar que el precio no esté extremadamente lejos del EMA (señales más probables)
        isPriceNearEma: Math.abs((lastClose - lastEma660) / lastEma660) < 0.02 // Dentro del 2%
      };

      const shouldProceed =
        preFilterConditions.isRsiNearCriticalLevels &&
        preFilterConditions.isVolatilityOperable &&
        // preFilterConditions.hasRiskCapacity &&
        preFilterConditions.isPriceNearEma;

      console.log('🔍 Pre-filter Analysis:', {
        rsi: lastRsi,
        atrPercent: atrPercent.toFixed(2) + '%',
        priceVsEma: ((lastClose - lastEma660) / lastEma660 * 100).toFixed(2) + '%',
        shouldCallAI: shouldProceed,
        conditions: preFilterConditions
      });

      return shouldProceed;

    } catch (error) {
      console.error('❌ Error en pre-filter:', error);
      return false; // En caso de error, mejor no llamar a IA
    }
  }
}