import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Candlestick, AiResponse, TypeMarket } from '../../models';
import { environment } from '../../../environments/environment';
import { environment as envProd } from '../../../environments/environment.prod';
import { IndicatorServices } from '../helpers/indicators.service';
import { GenerateServicePrompt } from '../helpers/ia/generate-prompt-ia.services';

// TODO deuda tecnica aqui, hay ciertas funcionalidades o variables que no deberian ser de esta clase, deben estar en el servicio del broker
@Injectable({
  providedIn: 'root'
})
export class GlmAiService {
  private apiUrl = environment.production ? envProd.glmAi.baseUrl : environment.glmAi.baseUrl;


  private readonly http = inject(HttpClient);
  private readonly generatePrompt = inject(GenerateServicePrompt);
  private readonly indicators = inject(IndicatorServices);



  analyzeMarket(candles: Candlestick[], accountBalance: number, openPositions: number, typeMarket: TypeMarket): Observable<AiResponse> {
    const prompt = this.buildPrompt(candles, accountBalance, openPositions, typeMarket);

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

  private buildPrompt(candles: Candlestick[], accountBalance: number, openPositions: number, typeMarket: TypeMarket): string {
    if (candles.length < 50) {
      return "No hay suficientes velas para realizar un análisis. Proporciona al menos 50 velas.";
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    try {
      // ✅ CÁLCULOS CORREGIDOS con manejo de errores
      const rsi = this.indicators.calculateRSI(closes, 7);
      const ema660 = this.indicators.calculateEMA(closes, 660);

      // ✅ ATR CORREGIDO - Verifica el formato específico
      const atr14 = this.indicators.calculateATR(highs, lows, closes, 14);
      const macd = this.indicators.calculateMACD(closes);

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

      // Derivados
      const isBelowEma660 = lastClose < lastEma660;
      const isRsiOverbought = lastRsi > 70;
      const isRsiOversold = lastRsi < 30;
      const macdCross = (lastMacd?.MACD != null && lastMacd?.signal != null)
        ? (lastMacd.MACD > lastMacd.signal ? 'bullish' : 'bearish')
        : 'unknown';

      // Prompt tipo Alpha Arena
      return `
      ACT AS A PROFESSIONAL AUTOMATED INTRADAY CRYPTO TRADING ANALYST

**CONTEXT AND ROLE:**
You are an AI system specialized in algorithmic cryptocurrency trading focused on 7 major pairs. Your function is to analyze pre-calculated technical indicators and generate automated trading signals with professional risk management.

**INPUT DATA:**
- Symbol: ${environment.trading.pair}
- Timeframe: ${environment.trading.interval}
- Last Close Price: ${lastClose}
- Last Volume: ${lastVolume}
- Account Balance: ${accountBalance} USDT

**MAIN TECHNICAL INDICATORS:**
- EMA 660: ${lastEma660} (dominant trend)
- RSI 7: ${lastRsi} (short-term or long-term momentum)
- isRsiOverbought: ${isRsiOverbought}
- isRsiOversold: ${isRsiOversold}
- PREVIOUS RSI 7: ${previousRsi} (for first touch detection)
- ATR 14: ${lastAtr14} (volatility and risk management)
- MACD: ${lastMacd?.MACD} | Signal: ${lastMacd?.signal} | Histogram: ${lastMacd?.histogram}


**CRITICAL DERIVED STATES:**
- Price vs EMA660: ${isBelowEma660 ? "BELOW" : "ABOVE"}
- MACD Crossover: ${macdCross} like filter confirmation

**RISK MANAGEMENT INTEGRATION:**
- CURRENT BALANCE: ${accountBalance} USDT
- RISK PER TRADE: 2% of capital = ${accountBalance * 0.02} USDT
- POSITION SIZE CALCULATION: Based on ATR and balance
- MAX POSITION SIZE: ${accountBalance * 0.02} USDT (2% rule)


**FIRST TOUCH RSI DETECTION (CRITICAL):**
- FIRST TOUCH OVERBOUGHT: Current RSI >= 70 AND Previous RSI < 70
- FIRST TOUCH OVERSOLD: Current RSI <= 30 AND Previous RSI > 30
- NOT FIRST TOUCH: If RSI was already in zone (≥70 or ≤30)

**DECISION STRATEGY - STRICT RULES:**

**SELL SIGNAL (Short) - REQUIREMENTS:**
1. TREND: Price BELOW EMA660 (${isBelowEma660})
2. MOMENTUM: FIRST TOUCH RSI >=70 (${lastRsi} >=70 and ${previousRsi} <70)
3. CONFIRMATION: MACD in bearish crossover or negative histogram
4. VOLATILITY: ATR14 indicates operable conditions
5. RISK CAPACITY: Available balance > ${accountBalance * 0.02} USDT AND positions available > 0

**BUY SIGNAL (Long) - REQUIREMENTS:**
1. TREND: Price ABOVE EMA660 (${!isBelowEma660})
2. MOMENTUM: FIRST TOUCH RSI <=30 (${lastRsi} <=30 and ${previousRsi} >30)
3. CONFIRMATION: MACD in bullish crossover or positive histogram
4. VOLATILITY: ATR14 within normal ranges
5. RISK CAPACITY: Available balance > ${accountBalance * 0.02} USDT AND positions available > 0

**ADVANCED RISK MANAGEMENT:**
- MINIMUM BALANCE: If account balance < 20 USDT → REDUCE position size to 1%
- HIGH VOLATILITY ADJUSTMENT: If ATR > 2% of price → Reduce position size to 1%
- EXTREME VOLATILITY: If ATR > 4% of price → NO TRADING (HOLD)
- MAX DRAWDOWN PROTECTION: If account balance dropped > 10% today → REDUCE trading frequency

**VOLATILITY ASSESSMENT (ATR14):**
- NORMAL ATR (0.5%-2% of price): Standard 2% position
- HIGH ATR (>2% of price): Reduce position to 1%
- VERY HIGH ATR (>4% of price): NO TRADING (HOLD)
- LOW ATR (<0.5% of price): Possible false breakouts

**RISK-BASED DECISION PRIORITIES:**
1. CAPITAL PRESERVATION: Protect account balance above all
2. POSITION LIMITS: Respect maximum 3 simultaneous positions
3. VOLUME ADJUSTMENT: Adjust position size based on volatility
4. QUALITY: Only first touch RSI signals
5. TREND: Respect EMA660 direction

**MANDATORY VALIDATIONS:**
✅ TREND CONFIRMATION (Price vs EMA660)
✅ FIRST TOUCH RSI (clean crossover 70/30) 
✅ MACD CONFIRMATION (crossover in signal direction)
✅ ADEQUATE VOLATILITY (ATR14 not extreme)
✅ SUFFICIENT BALANCE (Available > position size)
✅ POSITION CAPACITY (Less than 3 open positions)

**DECISION HIERARCHY:**
1. If balance < 10 USDT → AUTOMATIC "HOLD" (insufficient capital)
2. If ATR > 4% → AUTOMATIC "HOLD" (extreme volatility)
3. If positions >= 3 → AUTOMATIC "HOLD" (max capacity)
4. If ALL SELL conditions met → "SELL"
5. If ALL BUY conditions met → "BUY"  
6. Otherwise → "HOLD"

**DYNAMIC POSITION SIZING:**
- Normal conditions: 2% of balance
- High volatility: 1% of balance  
- Low balance (< 20 USDT): 1% of balance
- Calculated size: ${Math.min(accountBalance * 0.02, accountBalance * 0.01 * (lastAtr14 / lastClose > 0.02 ? 0.5 : 1))} USDT

**STRICT JSON OUTPUT FORMAT (SPANISH ONLY):**
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.85,
  "reason": "Brief technical and risk management justification",
  "risk_parameters": {
    "stop_loss_percent": 1.5,
    "take_profit_percent": 2.25,
    "position_size": 0.02,
    "max_position_value": ${accountBalance * 0.02},
 
  }
}

**VALID EXAMPLE SCENARIOS:**
- "BUY": Price > EMA660 + RSI (29.5 vs previous 31.2) + Bullish MACD + Balance $100 + 1 position open
- "SELL": Price < EMA660 + RSI (70.3 vs previous 69.8) + Bearish MACD + Balance $150 + 2 positions open
- "HOLD": RSI (71.5 vs previous 71.0) → NOT first touch 
- "HOLD": Balance $8 → Insufficient capital
- "HOLD": 3 positions open → Maximum capacity reached

**OBJECTIVE:**
Maximize long-term profitability through strict risk management, capital preservation, and disciplined trading based on technical signals and account capacity.`;
    } catch (error: any) {
      console.error('❌ Error en cálculos técnicos:', error);
      return `Error calculando indicadores: ${error.message}. Verifica los datos de entrada.`;
    }

  }
}