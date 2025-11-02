import { Injectable } from "@angular/core";

// Indicators
// Importaciones para indicadores técnicos
import { RSI, EMA, ATR, MACD, Stochastic, CCI, ADX, BollingerBands } from 'technicalindicators';
import { StoreAppService } from "../../store/store-app.service";

@Injectable({ providedIn: 'root' })
export class IndicatorServices {

    // ✅ MÉTODOS DE SEGURIDAD PARA CÁLCULOS
    public safeCalculate<T>(calculation: () => T, defaultValue: T): T {
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

    public getLastValue<T>(array: T[] | undefined, defaultValue: T): T {
        if (!array || array.length === 0) {
            return defaultValue;
        }
        return array[array.length - 1];
    }

    // ✅ MÉTODOS DE CÁLCULO DE ESTADOS DERIVADOS GENERALES (se mantienen igual)
    public calculateTrendAlignment(ema20: number, ema50: number, ema200: number, price: number): any {
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

    public calculateMomentumState(rsi: number, stochK: number, cci: number, williamsR: number): any {
        return {
            rsiState: this.getRsiState(rsi),
            stochState: this.getStochState(stochK),
            cciState: this.getCciState(cci),
            williamsState: this.getWilliamsState(williamsR),
            overallMomentum: this.calculateOverallMomentum(rsi, stochK, cci, williamsR)
        };
    }

    public calculateVolatilityState(atr: number, price: number, bbUpper: number, bbLower: number): any {
        const atrPercent = (atr / price) * 100;
        const bbWidthPercent = ((bbUpper - bbLower) / price) * 100;

        return {
            atrPercent: parseFloat(atrPercent.toFixed(2)),
            bbWidthPercent: parseFloat(bbWidthPercent.toFixed(2)),
            volatilityRegime: this.getVolatilityRegime(atrPercent, bbWidthPercent),
            bbPosition: this.getBbPosition(price, bbUpper, bbLower)
        };
    }

    public calculateMarketCondition(adx: number, rsi: number, volatilityState: any): any {
        return {
            trendStrength: this.getTrendStrength(adx),
            marketRegime: this.getMarketRegime(adx, rsi, volatilityState.atrPercent),
            tradingEnvironment: this.getTradingEnvironment(adx, rsi, volatilityState.atrPercent)
        };
    }

    public calculatePricePosition(price: number, marketStructure: any): any {
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
    public getTrendDescription(score: number): string {
        switch (score) {
            case 3: return 'FUERTE_TENDENCIA_ALCISTA';
            case 2: return 'TENDENCIA_ALCISTA_MODERADA';
            case 1: return 'TENDENCIA_BAJISTA_MODERADA';
            case 0: return 'FUERTE_TENDENCIA_BAJISTA';
            default: return 'INDEFINIDO';
        }
    }

    public getRsiState(rsi: number): string {
        if (rsi >= 70) return 'SOBRECOMPRADO';
        if (rsi <= 30) return 'SOBREVENDIDO';
        if (rsi > 55) return 'ALCISTA';
        if (rsi < 45) return 'BAJISTA';
        return 'NEUTRO';
    }

    public getStochState(stochK: number): string {
        if (stochK >= 80) return 'SOBRECOMPRADO';
        if (stochK <= 20) return 'SOBREVENDIDO';
        return 'NEUTRO';
    }

    public getCciState(cci: number): string {
        if (cci > 100) return 'FUERTE_ALCISTA';
        if (cci < -100) return 'FUERTE_BAJISTA';
        if (cci > 0) return 'ALCISTA';
        if (cci < 0) return 'BAJISTA';
        return 'NEUTRO';
    }

    public getWilliamsState(williamsR: number): string {
        if (williamsR >= -20) return 'SOBRECOMPRADO';
        if (williamsR <= -80) return 'SOBREVENDIDO';
        return 'NEUTRO';
    }

    public calculateOverallMomentum(rsi: number, stochK: number, cci: number, williamsR: number): string {
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

    public getVolatilityRegime(atrPercent: number, bbWidthPercent: number): string {
        if (atrPercent > 4 || bbWidthPercent > 8) return 'ALTA_VOLATILIDAD';
        if (atrPercent < 1 || bbWidthPercent < 2) return 'BAJA_VOLATILIDAD';
        return 'VOLATILIDAD_NORMAL';
    }

    public getBbPosition(price: number, bbUpper: number, bbLower: number): string {
        const bbMiddle = (bbUpper + bbLower) / 2;
        if (price > bbUpper) return 'POR_ENCIMA_BANDA_SUPERIOR';
        if (price < bbLower) return 'POR_DEBAJO_BANDA_INFERIOR';
        if (price > bbMiddle) return 'MITAD_SUPERIOR_BANDAS';
        return 'MITAD_INFERIOR_BANDAS';
    }

    public getTrendStrength(adx: number): string {
        if (adx > 40) return 'FUERTE';
        if (adx > 25) return 'MODERADO';
        if (adx > 20) return 'DEBIL';
        return 'SIN_TENDENCIA';
    }

    public getMarketRegime(adx: number, rsi: number, atrPercent: number): string {
        if (adx < 20 && atrPercent < 2) return 'RANGING_CALM';
        if (adx < 20 && atrPercent >= 2) return 'RANGING_VOLATILE';
        if (adx >= 25 && atrPercent < 3) return 'TRENDING_CALM';
        if (adx >= 25 && atrPercent >= 3) return 'TRENDING_VOLATILE';
        return 'TRANSITION';
    }

    public getTradingEnvironment(adx: number, rsi: number, atrPercent: number): string {
        if (adx > 25) return 'ENTORNO_TENDENCIAL';
        if (rsi > 70 || rsi < 30) return 'ENTORNO_MEAN_REVERSION';
        if (atrPercent < 1) return 'ENTORNO_BREAKOUT_POTENCIAL';
        return 'ENTORNO_NEUTRO';
    }

    public getPositionInRange(supportDist: number, resistanceDist: number): string {
        const totalRange = supportDist + resistanceDist;
        if (totalRange === 0) return 'MEDIO_RANGO'; // Evitar división por cero

        const position = (supportDist / totalRange) * 100;
        if (position < 30) return 'CERCA_SOPORTE';
        if (position > 70) return 'CERCA_RESISTENCIA';
        return 'MEDIO_RANGO';
    }

    // ✅ MÉTODOS DE CÁLCULO DE INDICADORES TÉCNICOS (se mantienen igual)
    public calculateRSI(closes: number[], period: number): number[] {
        return RSI.calculate({ period, values: closes });
    }

    public calculateEMA(closes: number[], period: number): number[] {
        return EMA.calculate({ period, values: closes });
    }

    public calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
        return ATR.calculate({ high: highs, low: lows, close: closes, period });
    }

    public calculateMACD(closes: number[]): any[] {
        return MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
        });
    }

    public calculateStochastic(highs: number[], lows: number[], closes: number[], period: number, signalPeriod: number): any[] {
        return Stochastic.calculate({
            high: highs,
            low: lows,
            close: closes,
            period,
            signalPeriod
        });
    }

    public calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number[] {
        return CCI.calculate({
            high: highs,
            low: lows,
            close: closes,
            period
        });
    }

    public calculateADX(highs: number[], lows: number[], closes: number[], period: number): any[] {
        return ADX.calculate({
            high: highs,
            low: lows,
            close: closes,
            period
        });
    }

    public calculateBollingerBands(closes: number[], period: number, stdDev: number): any {
        return BollingerBands.calculate({
            period,
            values: closes,
            stdDev
        });
    }

    public calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number {
        const recentHighs = highs.slice(-period);
        const recentLows = lows.slice(-period);
        const currentClose = closes[closes.length - 1];

        const highestHigh = Math.max(...recentHighs);
        const lowestLow = Math.min(...recentLows);

        // Evitar división por cero
        if (highestHigh === lowestLow) return 0;

        return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    }

    public calculateVolumeProfile(volumes: number[]): any {
        const recentVolumes = volumes.slice(-20);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

        return {
            avgVolume: parseFloat(avgVolume.toFixed(2)),
            volumeTrend: volumes[volumes.length - 1] > avgVolume ? 'HIGH' : 'NORMAL'
        };
    }

    public calculateMarketStructure(highs: number[], lows: number[], closes: number[]): any {
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

    public calculatePivotPoints(highs: number[], lows: number[], closes: number[]): any {
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

    public findPeaks(data: number[], window: number): number[] {
        const peaks: number[] = [];
        for (let i = window; i < data.length - window; i++) {
            const isPeak = data.slice(i - window, i + window + 1)
                .every((val, idx) => idx === window || val <= data[i]);
            if (isPeak) peaks.push(data[i]);
        }
        return peaks;
    }

    public findTroughs(data: number[], window: number): number[] {
        const troughs: number[] = [];
        for (let i = window; i < data.length - window; i++) {
            const isTrough = data.slice(i - window, i + window + 1)
                .every((val, idx) => idx === window || val >= data[i]);
            if (isTrough) troughs.push(data[i]);
        }
        return troughs;
    }


}