import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Candlestick, AiResponse } from '../models';
import { environment } from '../../environments/environment';
import { SMA, RSI, MACD } from 'technicalindicators';

@Injectable({
  providedIn: 'root'
})
export class GlmAiService {
  private apiUrl = environment.glmAi.baseUrl;

  constructor(private http: HttpClient) { }

  analyzeMarket(candles: Candlestick[]): Observable<AiResponse> {
    const prompt = this.buildPrompt(candles);

    const body = {
      model: 'glm-4-flash', // o 'glm-4' para más capacidad
      messages: [
        { role: 'system', content: 'Eres un experto analista de trading cuantitativo. Tu tarea es analizar datos de mercado y proporcionar una única decisión de trading en formato JSON.' },
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

    // --- Cálculo de Indicadores ---
    const sma20 = SMA.calculate({ period: 20, values: closes });
    const sma50 = SMA.calculate({ period: 50, values: closes });
    const rsi = RSI.calculate({ period: 14, values: closes });
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const lastCandle = candles[candles.length - 1];
    const lastSma20 = sma20[sma20.length - 1];
    const lastSma50 = sma50[sma50.length - 1];
    const lastRsi = rsi[rsi.length - 1];
    const lastMacd = macd[macd.length - 1];

    // --- El Prompt "Estilo Alpha Arena" ---
    return `
Analiza el siguiente escenario de mercado para el par ${environment.trading.pair} en el timeframe ${environment.trading.interval}.

**Datos Actuales:**
- Precio de Cierre (Última Vela): ${lastCandle.close}
- Volumen (Última Vela): ${lastCandle.volume}

**Indicadores Técnicos Clave:**
- SMA 20: ${lastSma20}
- SMA 50: ${lastSma50}
- RSI (14): ${lastRsi}
- MACD: ${lastMacd.MACD}, Señal: ${lastMacd.signal}, Histograma: ${lastMacd.histogram}

**Contexto del Mercado:**
- El precio actual está ${lastCandle.close > lastSma20 ? 'por encima' : 'por debajo'} de la SMA 20.
- El precio actual está ${lastCandle.close > lastSma50 ? 'por encima' : 'por debajo'} de la SMA 50.
- La SMA 20 está ${lastSma20 > lastSma50 ? 'por encima' : 'por debajo'} de la SMA 50, indicando una tendencia ${lastSma20 > lastSma50 ? 'alcista' : 'bajista'} a mediano plazo.
- El RSI se encuentra en la zona de ${lastRsi > 70 ? 'sobrecompra' : lastRsi < 30 ? 'sobreventa' : 'neutral'}.
- El cruce del MACD es ${lastMacd?.MACD != null && lastMacd?.signal != null && lastMacd.MACD > lastMacd.signal ? 'alcista (MACD por encima de la señal)' : 'bajista (MACD por debajo de la señal)'}.

**Tarea:**
Basado en toda la información proporcionada, determina la acción de trading más prudente.

**Instrucciones de Salida:**
Responde ÚNICAMENTE con un objeto JSON. No incluyas ningún texto adicional antes o después. El JSON debe tener la siguiente estructura:
\`\`\`json
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.85,
  "reason": "Proporciona una breve y clara justificación de tu decisión, mencionando los indicadores clave que la respaldan."
}
\`\`\`
`;
  }
}