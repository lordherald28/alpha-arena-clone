import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { AiResponse, Candlestick, OllamaTradingResponse, TypeMarket } from "../../models";
import { Observable } from "rxjs";
import { map, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from "../../../environments/environment";
import { GenerateServicePrompt } from "../helpers/ia/generate-prompt-ia.services";

@Injectable({ providedIn: 'root' })
export class OllamaAIService {

    private readonly defaultConfig = {
        model: '0xroyce/plutus:latest',
        stream: false,
        options: {
            temperature: 0.3,
            top_k: 40,
            top_p: 0.9,
            num_predict: 512,
            stop: ['\n', '###'],
            num_ctx: 2048,
            repeat_penalty: 1.1,
            seed: 42
        }
    };

    private readonly http = inject(HttpClient);
    private readonly generatePrompt = inject(GenerateServicePrompt);
    private apiUrl = environment.glmAi.localUrl;

    analyzeMarket(candles: any[], accountBalance: number, openPositions: number, typeMarket: any): Observable<AiResponse> {
        const prompt = this.generatePrompt.buildPrompt(candles, accountBalance, openPositions, typeMarket);

        // ✅ SYSTEM PROMPT MEJORADO - ENFOCADO EN TREND_FOLLOWING CORRECTO
        const systemPrompt = `Eres un analista de trading CUANTITATIVO. Sigue estas REGLAS ABSOLUTAS:

**REGLAS DE TENDENCIA Y ESTRATEGIA:**
1. ✅ TREND_FOLLOWING SIGUE LA TENDENCIA:
   - Tendencia ALCISTA + TREND_FOLLOWING = SOLO BUY
   - Tendencia BAJISTA + TREND_FOLLOWING = SOLO SELL
   - NUNCA uses TREND_FOLLOWING en contra de la tendencia principal

2. ✅ INTERPRETACIÓN CORRECTA DE SEÑALES:
   - ADX > 35 = Tendencia FUERTE - seguir la dirección
   - EMAs alineadas = Confirmación de tendencia
   - Osciladores en sobreventa = POSIBLE reversión, NO confirmación

3. ✅ GESTIÓN DE RIESGO:
   - Máxima confianza: 0.75 en señales MUY claras
   - Normal: 0.4-0.6 en señales mixtas  
   - Mínima: 0.1-0.3 en alta incertidumbre

**ANÁLISIS OBJETIVO:**
- La TENDENCIA es el factor PRIMARIO
- Los osciladores son factores SECUNDARIOS
- Volumen bajo = FALTA de convicción
- Si hay duda = HOLD

Responde ÚNICAMENTE con JSON válido:
{
  "decision": "BUY|SELL|HOLD",
  "confidence": 0.00,
  "selected_strategy": "TREND_FOLLOWING|MEAN_REVERSION|BREAKOUT|MOMENTUM",
  "reason": "explicación técnica en español"
}`;

        const body = {
            model: this.defaultConfig.model,
            stream: false,
            format: 'json',
            prompt: `${systemPrompt}\n\nANALIZA ESTOS DATOS:\n${prompt}`,
            options: {
                temperature: 0.1,  // ✅ REDUCIDO A 0.1 para máxima consistencia
                seed: 42,
                num_ctx: 1024,
                num_predict: 200,  // ✅ Reducido para respuestas más concisas
                keep_alive: '30m'
            }
        };

        return this.http.post<any>(`${this.apiUrl}/api/generate`, body).pipe(
            // timeout(30000),
            map(response => {
                const content = response.response;
                console.log('🤖 Respuesta cruda de Ollama:', content);

                try {
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                    const decisionJson = JSON.parse(jsonMatch ? jsonMatch[1] : content);

                    // ✅ FILTRO DE SEGURIDAD MEJORADO: Enfocado en TREND_FOLLOWING
                    const safeDecision = this.validateTrendFollowingLogic(decisionJson, prompt);

                    return {
                        decision: safeDecision.decision,
                        confidence: safeDecision.confidence,
                        reason: safeDecision.reason,
                        selected_strategy: safeDecision.selected_strategy,
                        rawJson: decisionJson
                    };
                } catch (e) {
                    console.error("❌ Error parseando respuesta de Ollama:", e, "Contenido:", content);
                    return this.getFallbackResponse();
                }
            }),
            catchError(error => {
                console.error('❌ Error en petición Ollama:', error);
                return of(this.getFallbackResponse());
            })
        );
    }

    /**
     * ✅ FILTRO MEJORADO: Validación específica de lógica TREND_FOLLOWING
     */
    private validateTrendFollowingLogic(decisionJson: any, originalPrompt: string): any {
        const decision = decisionJson.decision || 'HOLD';
        const confidence = decisionJson.confidence || 0;
        const strategy = decisionJson.selected_strategy || '';
        let reason = decisionJson.reason || 'Sin razón';

        // Extraer información crítica del prompt
        const isBearish = originalPrompt.includes('BEARISH') && originalPrompt.includes('ADX');
        const isBullish = originalPrompt.includes('BULLISH') && originalPrompt.includes('ADX');
        const adxValue = this.extractADX(originalPrompt);
        const hasLowVolume = this.hasLowVolume(originalPrompt);

        console.log('🔍 Análisis de filtro:', {
            decision, strategy, isBearish, isBullish, adxValue, hasLowVolume
        });

        // 🚨 FILTRO CRÍTICO: TREND_FOLLOWING en dirección equivocada
        if (strategy === 'TREND_FOLLOWING') {
            if (isBearish && decision === 'BUY') {
                console.error('🚨 CRÍTICO: TREND_FOLLOWING BUY en tendencia BAJISTA - CONVERTIDO A HOLD');
                return {
                    decision: 'HOLD',
                    confidence: 0.2,
                    reason: 'ERROR: TREND_FOLLOWING mal interpretado. En tendencia bajista, TREND_FOLLOWING debe ser SELL, no BUY. ' + reason,
                    selected_strategy: 'MEAN_REVERSION'
                };
            }

            if (isBullish && decision === 'SELL') {
                console.error('🚨 CRÍTICO: TREND_FOLLOWING SELL en tendencia ALCISTA - CONVERTIDO A HOLD');
                return {
                    decision: 'HOLD',
                    confidence: 0.2,
                    reason: 'ERROR: TREND_FOLLOWING mal interpretado. En tendencia alcista, TREND_FOLLOWING debe ser BUY, no SELL. ' + reason,
                    selected_strategy: 'MEAN_REVERSION'
                };
            }
        }

        // ✅ FILTRO: Confianza excesiva en situaciones riesgosas
        let safeConfidence = confidence;
        let safeStrategy = strategy;
        let safeReason = reason;

        // Caso 1: BUY en tendencia bajista (aunque no sea TREND_FOLLOWING)
        if (decision === 'BUY' && isBearish && adxValue > 30) {
            safeConfidence = Math.min(confidence, 0.4);
            safeReason = `Confianza reducida - BUY en tendencia bajista fuerte (ADX ${adxValue}). ` + reason;
            console.warn('⚠️ BUY en tendencia bajista - confianza reducida');
        }

        // Caso 2: SELL en tendencia alcista  
        if (decision === 'SELL' && isBullish && adxValue > 30) {
            safeConfidence = Math.min(confidence, 0.4);
            safeReason = `Confianza reducida - SELL en tendencia alcista fuerte (ADX ${adxValue}). ` + reason;
            console.warn('⚠️ SELL en tendencia alcista - confianza reducida');
        }

        // Caso 3: Volumen bajo = falta de convicción
        if (hasLowVolume && confidence > 0.6) {
            safeConfidence = Math.min(confidence, 0.5);
            safeReason = `Confianza reducida - volumen bajo indica falta de convicción. ` + safeReason;
            console.warn('⚠️ Volumen bajo - confianza reducida');
        }

        // Caso 4: Confianza excesiva general
        safeConfidence = Math.min(safeConfidence, 0.8);

        return {
            decision: decision,
            confidence: safeConfidence,
            reason: safeReason,
            selected_strategy: safeStrategy
        };
    }

    /**
     * ✅ Extraer valor ADX del prompt
     */
    private extractADX(prompt: string): number {
        const adxMatch = prompt.match(/ADX: (\d+\.\d+)/);
        return adxMatch ? parseFloat(adxMatch[1]) : 0;
    }

    /**
     * ✅ Detectar volumen bajo
     */
    private hasLowVolume(prompt: string): boolean {
        // Buscar patrones de volumen bajo en el prompt
        return prompt.includes('Volume: Current') &&
            (prompt.includes('vs Average') &&
                this.extractVolumeRatio(prompt) < 0.7);
    }

    /**
     * ✅ Extraer ratio de volumen (current vs average)
     */
    private extractVolumeRatio(prompt: string): number {
        const volumeMatch = prompt.match(/Volume: Current (\d+\.\d+) vs Average (\d+\.\d+)/);
        if (volumeMatch) {
            const current = parseFloat(volumeMatch[1]);
            const average = parseFloat(volumeMatch[2]);
            return average > 0 ? current / average : 1;
        }
        return 1;
    }

    /**
     * ✅ Respuesta de fallback 
     */
    private getFallbackResponse(): AiResponse {
        return {
            decision: 'HOLD',
            confidence: 0.1,
            reason: 'Sistema de análisis no disponible - usando respuesta de fallback',
            selected_strategy: 'HOLD',
            rawJson: undefined
        };
    }

    /**
     * ✅ MÉTODO PARA PROBAR EL FILTRO MEJORADO
     */
    public testTrendFollowingFilter(): void {
        console.log('🧪 Probando filtro de TREND_FOLLOWING...');

        const testScenarios = [
            {
                name: 'TREND_FOLLOWING BUY en tendencia BAJISTA',
                prompt: 'TREND: BEARISH, ADX: 41.53, EMA bajistas',
                decisionJson: {
                    decision: 'BUY',
                    confidence: 0.85,
                    selected_strategy: 'TREND_FOLLOWING',
                    reason: 'Strong trend following signal'
                },
                expected: {
                    decision: 'HOLD',
                    confidence: 0.2,
                    strategy: 'MEAN_REVERSION'
                }
            },
            {
                name: 'TREND_FOLLOWING SELL en tendencia ALCISTA',
                prompt: 'TREND: BULLISH, ADX: 38.45, EMA alcistas',
                decisionJson: {
                    decision: 'SELL',
                    confidence: 0.8,
                    selected_strategy: 'TREND_FOLLOWING',
                    reason: 'Trend following the momentum'
                },
                expected: {
                    decision: 'HOLD',
                    confidence: 0.2,
                    strategy: 'MEAN_REVERSION'
                }
            },
            {
                name: 'BUY normal en tendencia alcista',
                prompt: 'TREND: BULLISH, ADX: 25.12',
                decisionJson: {
                    decision: 'BUY',
                    confidence: 0.7,
                    selected_strategy: 'TREND_FOLLOWING',
                    reason: 'Following uptrend'
                },
                expected: {
                    decision: 'BUY',
                    confidence: 0.7,
                    strategy: 'TREND_FOLLOWING'
                }
            }
        ];

        testScenarios.forEach((scenario, index) => {
            const result = this.validateTrendFollowingLogic(
                scenario.decisionJson,
                scenario.prompt
            );

            console.log(`\n🔍 Test ${index + 1}: ${scenario.name}`);
            console.log(`   Input: ${scenario.decisionJson.decision} (${scenario.decisionJson.confidence}) con ${scenario.decisionJson.selected_strategy}`);
            console.log(`   Output: ${result.decision} (${result.confidence}) con ${result.selected_strategy}`);
            console.log(`   Esperado: ${scenario.expected.decision} (${scenario.expected.confidence}) con ${scenario.expected.strategy}`);

            const passed = result.decision === scenario.expected.decision &&
                result.selected_strategy === scenario.expected.strategy;
            console.log(`   ${passed ? '✅ PASÓ' : '❌ FALLÓ'}`);
        });
    }
}