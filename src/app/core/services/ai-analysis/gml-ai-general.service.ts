import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { AiResponse, Candlestick, TypeMarket } from "../../models";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';

import { environment } from "../../../environments/environment";
import { environment as envProd } from '../../../environments/environment.prod';

// Importaciones para indicadores técnicos
// import { RSI, EMA, ATR, MACD, Stochastic, CCI, ADX, BollingerBands } from 'technicalindicators';
import { StoreAppService } from "../../store/store-app.service";
import { GenerateServicePrompt } from "../helpers/ia/generate-prompt-ia.services";

@Injectable({ providedIn: 'root' })
export class GlmAiGeneralService {

    //Inject

    private readonly http = inject(HttpClient);
    private readonly generatePrompt = inject(GenerateServicePrompt);

    private apiUrl = environment.production ? envProd.glmAi.baseUrl : environment.glmAi.baseUrl;

    public analyzeMarket(candles: Candlestick[], accountBalance: number, openPositions: number, typeMarket: TypeMarket): Observable<AiResponse> {
        const prompt = this.generatePrompt.buildPrompt(candles, accountBalance, openPositions, typeMarket);

        // Si hay error en los cálculos, retornar HOLD inmediatamente
        if (prompt.includes('Error calculando indicadores')) {
            return new Observable(observer => {
                observer.next({
                    decision: 'HOLD',
                    confidence: 0,
                    reason: 'Error en cálculos técnicos - mercado no analizable',
                    rawJson: {}
                });
                observer.complete();
            });
        }

        const body = {
            model: 'glm-4.6',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un experto analista de trading cuantitativo. Analiza los datos de mercado de forma objetiva y selecciona la estrategia óptima basándote en el análisis técnico completo. Proporciona una única decisión de trading en formato JSON y RESPONDER EN ESPAÑOL.'
                },
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

}