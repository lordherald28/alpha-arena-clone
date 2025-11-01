import { computed, inject, Injectable, signal, WritableSignal } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { AiResponse, Balance, Candlestick, TypeMarket } from "../models";
import { Observable } from "rxjs";
import { map } from 'rxjs/operators';

import { environment } from "../../environments/environment";
import { environment as envProd } from '../../environments/environment.prod';
import { PaperTradingService } from "./paper-trading.service";

// Importaciones para indicadores técnicos
import { RSI, EMA, ATR, MACD, Stochastic, CCI, ADX, BollingerBands } from 'technicalindicators';
import { StoreAppService } from "../store/store-app.service";

@Injectable({ providedIn: 'root' })
export class GlmAiGeneralService {

    private apiUrl = environment.production ? envProd.glmAi.baseUrl : environment.glmAi.baseUrl;
    private paperTrading = inject(PaperTradingService);
    private readonly http = inject(HttpClient);
    accountBalance: WritableSignal<number> = signal<number>(0);

    readonly currentAtr = signal<number>(0);
    readonly currentMarketData = signal<any>(null);
    readonly marketConfig = computed(() => this.StoreService.getDataMarket());

    private StoreService = inject(StoreAppService);

    constructor() {
        this.paperTrading.getAccountBalance().subscribe((balance: Balance[]) => {
            this.accountBalance.set(+balance[0].available)
        });
        // this.marketConfig.set(this.StoreService.getDataMarket());
    }

    analyzeMarket(candles: Candlestick[]): Observable<AiResponse> {
        const prompt = this.buildPrompt(candles);

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

    private buildPrompt(candles: Candlestick[]): string {
        if (candles.length < 200) {
            return "No hay suficientes velas para realizar un análisis completo. Proporciona al menos 200 velas.";
        }

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        try {
            // ✅ VALORES ACTUALES CON VALIDACIÓN
            const lastCandle = candles[candles.length - 1];
            const lastClose = lastCandle.close;
            const lastVolume = lastCandle.volume;

            // ✅ CÁLCULOS DE INDICADORES PRINCIPALES CON MANEJO DE ERRORES
            const rsi7 = this.safeCalculate(() => this.calculateRSI(closes, 7), [50]);
            const rsi14 = this.safeCalculate(() => this.calculateRSI(closes, 14), [50]);
            const ema20 = this.safeCalculate(() => this.calculateEMA(closes, 20), [lastClose]);
            const ema50 = this.safeCalculate(() => this.calculateEMA(closes, 50), [lastClose]);
            const ema200 = this.safeCalculate(() => this.calculateEMA(closes, 200), [lastClose]);

            const atr14 = this.safeCalculate(() => this.calculateATR(highs, lows, closes, 14), [0]);
            const macd = this.safeCalculate(() => this.calculateMACD(closes), [{}]);
            const stoch = this.safeCalculate(() => this.calculateStochastic(highs, lows, closes, 14, 3), [{}]);
            const cci = this.safeCalculate(() => this.calculateCCI(highs, lows, closes, 20), [0]);
            const adx = this.safeCalculate(() => this.calculateADX(highs, lows, closes, 14), [{}]);

            // ✅ CÁLCULO DE BOLLINGER BANDS CON VALIDACIÓN ROBUSTA
            const bb = this.safeCalculate(() => this.calculateBollingerBands(closes, 20, 2), {
                upper: [lastClose * 1.1],
                middle: [lastClose],
                lower: [lastClose * 0.9]
            });

            // ✅ CÁLCULOS DE VOLUMEN Y ESTRUCTURA DE MERCADO
            const volumeProfile = this.calculateVolumeProfile(volumes);
            const marketStructure = this.calculateMarketStructure(highs, lows, closes);
            const pivotPoints = this.calculatePivotPoints(highs, lows, closes);

            // ✅ VALORES DE INDICADORES CON VALIDACIÓN DE LENGTH
            const lastRsi7 = this.getLastValue(rsi7, 50);
            const lastRsi14 = this.getLastValue(rsi14, 50);

            const lastEma20 = this.getLastValue(ema20, lastClose);
            const lastEma50 = this.getLastValue(ema50, lastClose);
            const lastEma200 = this.getLastValue(ema200, lastClose);

            const lastAtr14 = this.getLastValue(atr14, 0);
            const lastMacd = this.getLastValue(macd, {});
            const lastStochK = stoch && stoch.length > 0 ? (stoch[stoch.length - 1]?.k || 50) : 50;

            const lastWilliamsR = this.safeCalculate(() => this.calculateWilliamsR(highs, lows, closes, 14), 0);
            const lastCci = this.getLastValue(cci, 0);
            const lastAdx = adx && adx.length > 0 ? (adx[adx.length - 1]?.adx || 0) : 0;

            // ✅ VALORES DE BOLLINGER BANDS CON VALIDACIÓN ROBUSTA
            const lastBbUpper = bb && bb.upper && bb.upper.length > 0 ? bb.upper[bb.upper.length - 1] : lastClose * 1.1;
            const lastBbMiddle = bb && bb.middle && bb.middle.length > 0 ? bb.middle[bb.middle.length - 1] : lastClose;
            const lastBbLower = bb && bb.lower && bb.lower.length > 0 ? bb.lower[bb.lower.length - 1] : lastClose * 0.9;

            // ✅ ESTADOS DERIVADOS GENERALES CON VALIDACIÓN
            const trendAlignment = this.calculateTrendAlignment(lastEma20, lastEma50, lastEma200, lastClose);
            const momentumState = this.calculateMomentumState(lastRsi14, lastStochK, lastCci, lastWilliamsR);
            const volatilityState = this.calculateVolatilityState(lastAtr14, lastClose, lastBbUpper, lastBbLower);
            const marketCondition = this.calculateMarketCondition(lastAdx, lastRsi14, volatilityState);
            const pricePosition = this.calculatePricePosition(lastClose, marketStructure);

            // ✅ GESTIÓN DE RIESGO
            const accountBalance = this.accountBalance();
            const openPositions = this.paperTrading.getOpenOrdersNumber(this.marketConfig().market);

            // Actualizar señales
            this.currentAtr.set(lastAtr14);
            this.currentMarketData.set({
                rsi: lastRsi14,
                trend: trendAlignment.primary,
                marketCondition: marketCondition.regime
            });

            // ✅ CONSTRUIR PROMPT DINÁMICO
            return this.generatePrompt({
                // Datos básicos
                symbol: this.marketConfig().market,
                timeframe: this.marketConfig().interval,
                lastClose,
                lastVolume,
                accountBalance,
                availableMargin: accountBalance * 0.8, // Estimación

                // Indicadores de tendencia
                lastEma20,
                lastEma50,
                lastEma200,
                lastAdx,

                // Osciladores de momentum
                lastRsi7,
                lastRsi14,
                lastStochK,
                lastWilliamsR,
                lastCci,

                // Volatilidad y volumen
                lastAtr14,
                lastBbUpper,
                lastBbMiddle,
                lastBbLower,
                avgVolume: volumeProfile.avgVolume,

                // Estructura de mercado
                supportLevels: marketStructure.supportLevels,
                resistanceLevels: marketStructure.resistanceLevels,
                pivotPoints,

                // Estados derivados generales
                trendAlignment,
                momentumState,
                volatilityState,
                marketCondition,
                pricePosition,
                openPositions,

                // Datos MACD para análisis
                macd: lastMacd
            });

        } catch (error: any) {
            console.error('❌ Error en cálculos técnicos:', error);
            return `Error calculando indicadores: ${error.message}. Verifica los datos de entrada.`;
        }
    }

    // ✅ MÉTODOS DE SEGURIDAD PARA CÁLCULOS
    private safeCalculate<T>(calculation: () => T, defaultValue: T): T {
        try {
            const result = calculation();
            if (result === undefined || result === null) {
                console.warn('Cálculo retornó undefined/null, usando valor por defecto');
                return defaultValue;
            }

            // Validar arrays vacíos
            if (Array.isArray(result) && result.length === 0) {
                console.warn('Array de cálculo vacío, usando valor por defecto');
                return defaultValue;
            }

            return result;
        } catch (error) {
            console.warn('Error en cálculo, usando valor por defecto:', error);
            return defaultValue;
        }
    }

    private getLastValue<T>(array: T[] | undefined, defaultValue: T): T {
        if (!array || array.length === 0) {
            return defaultValue;
        }
        return array[array.length - 1];
    }

    // ✅ MÉTODOS DE CÁLCULO DE ESTADOS DERIVADOS GENERALES (se mantienen igual)
    private calculateTrendAlignment(ema20: number, ema50: number, ema200: number, price: number): any {
        const trends = {
            shortTerm: price > ema20 ? 'BULLISH' : 'BEARISH',
            mediumTerm: price > ema50 ? 'BULLISH' : 'BEARISH',
            longTerm: price > ema200 ? 'BULLISH' : 'BEARISH'
        };

        const alignmentScore = [
            trends.shortTerm === 'BULLISH' ? 1 : 0,
            trends.mediumTerm === 'BULLISH' ? 1 : 0,
            trends.longTerm === 'BULLISH' ? 1 : 0
        ].reduce((a, b) => a + b, 0);

        return {
            ...trends,
            alignmentScore,
            primary: alignmentScore >= 2 ? 'BULLISH' : 'BEARISH',
            description: this.getTrendDescription(alignmentScore)
        };
    }

    private calculateMomentumState(rsi: number, stochK: number, cci: number, williamsR: number): any {
        return {
            rsiState: this.getRsiState(rsi),
            stochState: this.getStochState(stochK),
            cciState: this.getCciState(cci),
            williamsState: this.getWilliamsState(williamsR),
            overallMomentum: this.calculateOverallMomentum(rsi, stochK, cci, williamsR)
        };
    }

    private calculateVolatilityState(atr: number, price: number, bbUpper: number, bbLower: number): any {
        const atrPercent = (atr / price) * 100;
        const bbWidthPercent = ((bbUpper - bbLower) / price) * 100;

        return {
            atrPercent: parseFloat(atrPercent.toFixed(2)),
            bbWidthPercent: parseFloat(bbWidthPercent.toFixed(2)),
            volatilityRegime: this.getVolatilityRegime(atrPercent, bbWidthPercent),
            bbPosition: this.getBbPosition(price, bbUpper, bbLower)
        };
    }

    private calculateMarketCondition(adx: number, rsi: number, volatilityState: any): any {
        return {
            trendStrength: this.getTrendStrength(adx),
            marketRegime: this.getMarketRegime(adx, rsi, volatilityState.atrPercent),
            tradingEnvironment: this.getTradingEnvironment(adx, rsi, volatilityState.atrPercent)
        };
    }

    private calculatePricePosition(price: number, marketStructure: any): any {
        const validSupports = marketStructure.supportLevels.filter((s: number) => s < price);
        const validResistances = marketStructure.resistanceLevels.filter((r: number) => r > price);

        const nearestSupport = validSupports.length > 0 ? Math.max(...validSupports) : price * 0.95;
        const nearestResistance = validResistances.length > 0 ? Math.min(...validResistances) : price * 1.05;

        const supportDistance = ((price - nearestSupport) / price) * 100;
        const resistanceDistance = ((nearestResistance - price) / price) * 100;

        return {
            nearestSupport: parseFloat(nearestSupport.toFixed(4)),
            nearestResistance: parseFloat(nearestResistance.toFixed(4)),
            supportDistancePercent: parseFloat(supportDistance.toFixed(2)),
            resistanceDistancePercent: parseFloat(resistanceDistance.toFixed(2)),
            positionInRange: this.getPositionInRange(supportDistance, resistanceDistance)
        };
    }

    // ✅ MÉTODOS AUXILIARES PARA ESTADOS DERIVADOS (se mantienen igual)
    private getTrendDescription(score: number): string {
        switch (score) {
            case 3: return 'FUERTE_TENDENCIA_ALCISTA';
            case 2: return 'TENDENCIA_ALCISTA_MODERADA';
            case 1: return 'TENDENCIA_BAJISTA_MODERADA';
            case 0: return 'FUERTE_TENDENCIA_BAJISTA';
            default: return 'INDEFINIDO';
        }
    }

    private getRsiState(rsi: number): string {
        if (rsi >= 70) return 'SOBRECOMPRADO';
        if (rsi <= 30) return 'SOBREVENDIDO';
        if (rsi > 55) return 'ALCISTA';
        if (rsi < 45) return 'BAJISTA';
        return 'NEUTRO';
    }

    private getStochState(stochK: number): string {
        if (stochK >= 80) return 'SOBRECOMPRADO';
        if (stochK <= 20) return 'SOBREVENDIDO';
        return 'NEUTRO';
    }

    private getCciState(cci: number): string {
        if (cci > 100) return 'FUERTE_ALCISTA';
        if (cci < -100) return 'FUERTE_BAJISTA';
        if (cci > 0) return 'ALCISTA';
        if (cci < 0) return 'BAJISTA';
        return 'NEUTRO';
    }

    private getWilliamsState(williamsR: number): string {
        if (williamsR >= -20) return 'SOBRECOMPRADO';
        if (williamsR <= -80) return 'SOBREVENDIDO';
        return 'NEUTRO';
    }

    private calculateOverallMomentum(rsi: number, stochK: number, cci: number, williamsR: number): string {
        const signals = [
            this.getRsiState(rsi),
            this.getStochState(stochK),
            this.getCciState(cci),
            this.getWilliamsState(williamsR)
        ];

        const bullishSignals = signals.filter(s => s.includes('ALCISTA') || s === 'SOBREVENDIDO').length;
        const bearishSignals = signals.filter(s => s.includes('BAJISTA') || s === 'SOBRECOMPRADO').length;

        if (bullishSignals > bearishSignals) return 'ALCISTA';
        if (bearishSignals > bullishSignals) return 'BAJISTA';
        return 'NEUTRO';
    }

    private getVolatilityRegime(atrPercent: number, bbWidthPercent: number): string {
        if (atrPercent > 4 || bbWidthPercent > 8) return 'ALTA_VOLATILIDAD';
        if (atrPercent < 1 || bbWidthPercent < 2) return 'BAJA_VOLATILIDAD';
        return 'VOLATILIDAD_NORMAL';
    }

    private getBbPosition(price: number, bbUpper: number, bbLower: number): string {
        const bbMiddle = (bbUpper + bbLower) / 2;
        if (price > bbUpper) return 'POR_ENCIMA_BANDA_SUPERIOR';
        if (price < bbLower) return 'POR_DEBAJO_BANDA_INFERIOR';
        if (price > bbMiddle) return 'MITAD_SUPERIOR_BANDAS';
        return 'MITAD_INFERIOR_BANDAS';
    }

    private getTrendStrength(adx: number): string {
        if (adx > 40) return 'FUERTE';
        if (adx > 25) return 'MODERADO';
        if (adx > 20) return 'DEBIL';
        return 'SIN_TENDENCIA';
    }

    private getMarketRegime(adx: number, rsi: number, atrPercent: number): string {
        if (adx < 20 && atrPercent < 2) return 'RANGING_CALM';
        if (adx < 20 && atrPercent >= 2) return 'RANGING_VOLATILE';
        if (adx >= 25 && atrPercent < 3) return 'TRENDING_CALM';
        if (adx >= 25 && atrPercent >= 3) return 'TRENDING_VOLATILE';
        return 'TRANSITION';
    }

    private getTradingEnvironment(adx: number, rsi: number, atrPercent: number): string {
        if (adx > 25) return 'ENTORNO_TENDENCIAL';
        if (rsi > 70 || rsi < 30) return 'ENTORNO_MEAN_REVERSION';
        if (atrPercent < 1) return 'ENTORNO_BREAKOUT_POTENCIAL';
        return 'ENTORNO_NEUTRO';
    }

    private getPositionInRange(supportDist: number, resistanceDist: number): string {
        const totalRange = supportDist + resistanceDist;
        if (totalRange === 0) return 'MEDIO_RANGO'; // Evitar división por cero

        const position = (supportDist / totalRange) * 100;
        if (position < 30) return 'CERCA_SOPORTE';
        if (position > 70) return 'CERCA_RESISTENCIA';
        return 'MEDIO_RANGO';
    }

    // ✅ MÉTODOS DE CÁLCULO DE INDICADORES TÉCNICOS (se mantienen igual)
    private calculateRSI(closes: number[], period: number): number[] {
        return RSI.calculate({ period, values: closes });
    }

    private calculateEMA(closes: number[], period: number): number[] {
        return EMA.calculate({ period, values: closes });
    }

    private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
        return ATR.calculate({ high: highs, low: lows, close: closes, period });
    }

    private calculateMACD(closes: number[]): any[] {
        return MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });
    }

    private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number, signalPeriod: number): any[] {
        return Stochastic.calculate({
            high: highs,
            low: lows,
            close: closes,
            period,
            signalPeriod
        });
    }

    private calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number[] {
        return CCI.calculate({
            high: highs,
            low: lows,
            close: closes,
            period
        });
    }

    private calculateADX(highs: number[], lows: number[], closes: number[], period: number): any[] {
        return ADX.calculate({
            high: highs,
            low: lows,
            close: closes,
            period
        });
    }

    private calculateBollingerBands(closes: number[], period: number, stdDev: number): any {
        return BollingerBands.calculate({
            period,
            values: closes,
            stdDev
        });
    }

    private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number {
        const recentHighs = highs.slice(-period);
        const recentLows = lows.slice(-period);
        const currentClose = closes[closes.length - 1];

        const highestHigh = Math.max(...recentHighs);
        const lowestLow = Math.min(...recentLows);

        // Evitar división por cero
        if (highestHigh === lowestLow) return 0;

        return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    }

    private calculateVolumeProfile(volumes: number[]): any {
        const recentVolumes = volumes.slice(-20);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

        return {
            avgVolume: parseFloat(avgVolume.toFixed(2)),
            volumeTrend: volumes[volumes.length - 1] > avgVolume ? 'HIGH' : 'NORMAL'
        };
    }

    private calculateMarketStructure(highs: number[], lows: number[], closes: number[]): any {
        const lookback = 50;
        const recentHighs = highs.slice(-lookback);
        const recentLows = lows.slice(-lookback);

        const resistanceLevels = this.findPeaks(recentHighs, 5).map(level =>
            parseFloat(level.toFixed(4))
        ).slice(0, 3);

        const supportLevels = this.findTroughs(recentLows, 5).map(level =>
            parseFloat(level.toFixed(4))
        ).slice(0, 3);

        return {
            supportLevels: supportLevels.length ? supportLevels : [Math.min(...recentLows)],
            resistanceLevels: resistanceLevels.length ? resistanceLevels : [Math.max(...recentHighs)]
        };
    }

    private calculatePivotPoints(highs: number[], lows: number[], closes: number[]): any {
        const recentHigh = Math.max(...highs.slice(-20));
        const recentLow = Math.min(...lows.slice(-20));
        const recentClose = closes[closes.length - 1];

        const pivot = (recentHigh + recentLow + recentClose) / 3;
        const r1 = (2 * pivot) - recentLow;
        const s1 = (2 * pivot) - recentHigh;

        return {
            pivot: parseFloat(pivot.toFixed(4)),
            resistance1: parseFloat(r1.toFixed(4)),
            support1: parseFloat(s1.toFixed(4))
        };
    }

    private findPeaks(data: number[], window: number): number[] {
        const peaks: number[] = [];
        for (let i = window; i < data.length - window; i++) {
            const isPeak = data.slice(i - window, i + window + 1)
                .every((val, idx) => idx === window || val <= data[i]);
            if (isPeak) peaks.push(data[i]);
        }
        return peaks;
    }

    private findTroughs(data: number[], window: number): number[] {
        const troughs: number[] = [];
        for (let i = window; i < data.length - window; i++) {
            const isTrough = data.slice(i - window, i + window + 1)
                .every((val, idx) => idx === window || val >= data[i]);
            if (isTrough) troughs.push(data[i]);
        }
        return troughs;
    }

    // ✅ GENERADOR DE PROMPT DINÁMICO CON ESTADOS GENERALES
    private generatePrompt(data: any): string {
        const {
            symbol, timeframe, lastClose, lastVolume, accountBalance, availableMargin,
            lastEma20, lastEma50, lastEma200, lastAdx, lastRsi7, lastRsi14, lastStochK,
            lastWilliamsR, lastCci, lastAtr14, lastBbUpper, lastBbMiddle, lastBbLower,
            avgVolume, supportLevels, resistanceLevels, pivotPoints,
            trendAlignment, momentumState, volatilityState, marketCondition, pricePosition,
            openPositions, macd
        } = data;

        // Cálculos de gestión de riesgo
        const riskPerTrade = accountBalance * 0.02;
        const basePositionSize = accountBalance * 0.02;
        const atrPercent = (lastAtr14 / lastClose) * 100;
        const volatilityAdjustedSize = atrPercent > 3 ? basePositionSize * 0.7 : basePositionSize;

        return `
ACT AS A PROFESSIONAL AUTOMATED CRYPTO TRADING ANALYST

**CONTEXT AND ROLE:**
You are an advanced AI trading system specialized in multi-strategy cryptocurrency analysis. Your function is to objectively analyze market data and select the optimal trading strategy based on comprehensive technical analysis and adaptive risk management.

**INPUT DATA:**
- Symbol: ${symbol}
- Timeframe: ${timeframe}
- Last Close Price: ${lastClose.toFixed(4)}
- 24h Volume: ${lastVolume.toFixed(2)}
- Account Balance: ${accountBalance.toFixed(2)} USDT
- Available Margin: ${availableMargin.toFixed(2)} USDT
- Open Positions: ${openPositions}/3

**COMPREHENSIVE TECHNICAL INDICATORS:**
- Trend Indicators:
  • EMA 20: ${lastEma20.toFixed(4)} | EMA 50: ${lastEma50.toFixed(4)} | EMA 200: ${lastEma200.toFixed(4)}
  • ADX: ${lastAdx ? lastAdx.toFixed(2) : 'N/A'}

- Momentum Oscillators:
  • RSI 14: ${lastRsi14.toFixed(2)} | Stochastic %K: ${lastStochK ? lastStochK.toFixed(2) : 'N/A'}
  • RSI 7: ${lastRsi7.toFixed(2)} 
  • Williams %R: ${lastWilliamsR.toFixed(2)} | CCI: ${lastCci.toFixed(2)}

- Volatility & Volume:
  • ATR 14: ${lastAtr14.toFixed(4)} (${atrPercent.toFixed(2)}% of price)
  • Bollinger Bands: Upper ${lastBbUpper.toFixed(4)} | Middle ${lastBbMiddle.toFixed(4)} | Lower ${lastBbLower.toFixed(4)}
  • Volume: Current ${lastVolume.toFixed(2)} vs Average ${avgVolume}

- Market Structure:
  • Support Levels: ${supportLevels.join(', ')}
  • Resistance Levels: ${resistanceLevels.join(', ')}
  • Pivot Points: Pivot ${pivotPoints.pivot} | R1 ${pivotPoints.resistance1} | S1 ${pivotPoints.support1}

**OBJECTIVE MARKET ANALYSIS:**

**TREND ANALYSIS:**
- Alignment: ${trendAlignment.primary} (Score: ${trendAlignment.alignmentScore}/3)
- Short Term: ${trendAlignment.shortTerm} | Medium Term: ${trendAlignment.mediumTerm} | Long Term: ${trendAlignment.longTerm}
- Trend Strength: ${marketCondition.trendStrength}
- Description: ${trendAlignment.description}

**MOMENTUM ANALYSIS:**
- Overall Momentum: ${momentumState.overallMomentum}
- RSI State: ${momentumState.rsiState}
- Stochastic State: ${momentumState.stochState}
- CCI State: ${momentumState.cciState}
- Williams %R State: ${momentumState.williamsState}

**VOLATILITY ANALYSIS:**
- Volatility Regime: ${volatilityState.volatilityRegime}
- ATR Percentage: ${volatilityState.atrPercent}%
- Bollinger Band Width: ${volatilityState.bbWidthPercent}%
- BB Position: ${volatilityState.bbPosition}

**MARKET CONDITION:**
- Market Regime: ${marketCondition.marketRegime}
- Trading Environment: ${marketCondition.tradingEnvironment}
- Trend Strength: ${marketCondition.trendStrength}

**PRICE POSITION ANALYSIS:**
- Position in Range: ${pricePosition.positionInRange}
- Nearest Support: ${pricePosition.nearestSupport} (${pricePosition.supportDistancePercent}% below)
- Nearest Resistance: ${pricePosition.nearestResistance} (${pricePosition.resistanceDistancePercent}% above)

**RISK MANAGEMENT:**
- Base Risk: ${riskPerTrade.toFixed(2)} USDT (2%)
- Volatility Adjusted: ${volatilityAdjustedSize.toFixed(2)} USDT
- Maximum Positions: 3 (Current: ${openPositions})
- Minimum Balance: 5 USDT ${accountBalance > 5 ? '✅' : '❌'}

**STRATEGY CONSIDERATIONS:**
Based on the objective analysis above, evaluate which strategy fits best:
- TREND_FOLLOWING: Strong trends with high ADX and aligned moving averages
- MEAN_REVERSION: Extreme RSI/Stochastic levels in ranging markets
- BREAKOUT: Low volatility compression near key levels
- MOMENTUM: Strong volume with accelerating price movement

**REQUIRED OUTPUT FORMAT (JSON):**
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.00,
  "selected_strategy": "TREND_FOLLOWING" | "MEAN_REVERSION" | "BREAKOUT" | "MOMENTUM",
  "strategy_score": 85,
  "market_regime": "${marketCondition.marketRegime}",
  "reason": "Analisis técnico completo basado en: [explicar rationale]",
  "risk_parameters": {
    "position_size_usdt": ${volatilityAdjustedSize.toFixed(2)},
    "stop_loss_percent": 0.00,
    "take_profit_percent": 0.00,
    "risk_reward_ratio": 0.00
  },
  "key_indicators": {
    "primary_signal": "[Señal principal identificada]",
    "confirmation_signals": ["Señal 1", "Señal 2", "Señal 3"]
  }
}

**ANALYSIS OBJECTIVE:**
Provide the optimal trading decision based on objective technical analysis without bias toward any specific strategy. Maximize risk-adjusted returns through adaptive strategy selection and strict capital preservation.
        `;
    }
}