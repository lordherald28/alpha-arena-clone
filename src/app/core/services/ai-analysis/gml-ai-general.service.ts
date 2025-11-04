import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { AiResponse, Candlestick, TypeMarket } from "../../models";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';

import { environment } from "../../../environments/environment";
import { environment as envProd } from '../../../environments/environment.prod';

// Importaciones para indicadores técnicos
import { GenerateServicePrompt } from "../helpers/ia/generate-prompt-ia.services";

@Injectable({ providedIn: 'root' })
export class GlmAiGeneralService {

    //Inject
    private readonly http = inject(HttpClient);
    private readonly generatePrompt = inject(GenerateServicePrompt);

    // Configuración DeepSeek/OpenRouter
    private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    private apiKey = environment.deepseek.apiKey; // Tu key de OpenRouter
    // deepseek/deepseek-v3.1-terminus:exacto
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
            model: 'deepseek/deepseek-v3.1-terminus:exacto',
            messages: [
                {
                    role: 'system',
                    content: `Eres un experto analista de trading cuantitativo.
                    REGLAS ESTRICTAS:
                     - confidence debe ser número entre 0-100 (ej: 65.5)
                     - NO uses porcentajes en el valor numérico
                     - Formato JSON válido siempre
                     Analiza los datos de mercado de forma objetiva y selecciona la estrategia óptima basándote en el análisis técnico completo. 
                     Proporciona una única decisión de trading en formato JSON y RESPONDER EN ESPAÑOL.`
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.35,    // ← PUNTO ÓPTIMO
            top_p: 0.92,
            max_tokens: 600,
            frequency_penalty: 0.1,  // Evita repeticiones
            presence_penalty: 0.05   // Mantiene contexto
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

                    // ✅ FIX DEFINITIVO para la confianza
                    let confidence = parseFloat(decisionJson.confidence);
                    console.log('confidence: ', confidence)

                    // Normalizar SIEMPRE a porcentaje 0-100
                    if (confidence > 1000) {
                        confidence = confidence / 100;        // 4250 → 42.5
                    } else if (confidence > 100) {
                        confidence = confidence / 10;         // 425 → 42.5
                    } else if (confidence > 1 && confidence <= 100) {
                        // Ya está bien: 42.5 → 42.5
                    } else if (confidence <= 1) {
                        confidence = confidence * 100;        // 0.425 → 42.5
                    }

                    // Asegurar que esté entre 0-100
                    confidence = Math.max(0, Math.min(100, confidence));

                    return {
                        decision: decisionJson.decision,
                        confidence: confidence/*  Number(confidence.toFixed(1)) */, // ← NORMALIZADO
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