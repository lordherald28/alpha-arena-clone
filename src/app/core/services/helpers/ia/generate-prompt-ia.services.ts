import { inject, Injectable } from "@angular/core";
import { Candlestick, TypeMarket } from "../../../models";

import { IndicatorServices } from '../indicators.service';
import { StoreAppService } from "../../../store/store-app.service";
import { LIMI_OPEN_ORDERS } from "../../../utils/const.utils";

@Injectable({ providedIn: 'root' })
export class GenerateServicePrompt {

    // Inject
    private readonly indicators = inject(IndicatorServices);
    // private readonly store = inject(StoreAppService);

    public buildPrompt(
        candles: Candlestick[],
        accountBalance: number,
        openPositions: number,
        marketConfig: TypeMarket
    ): string {

      console.log('desde la ia: ', candles)
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
            const rsi7 = this.indicators.safeCalculate(() => this.indicators.calculateRSI(closes, 7), [50]);
            const rsi14 = this.indicators.safeCalculate(() => this.indicators.calculateRSI(closes, 14), [50]);
            const ema20 = this.indicators.safeCalculate(() => this.indicators.calculateEMA(closes, 20), [lastClose]);
            const ema50 = this.indicators.safeCalculate(() => this.indicators.calculateEMA(closes, 50), [lastClose]);
            const ema200 = this.indicators.safeCalculate(() => this.indicators.calculateEMA(closes, 200), [lastClose]);

            const atr14 = this.indicators.safeCalculate(() => this.indicators.calculateATR(highs, lows, closes, 14), [0]);
            const macd = this.indicators.safeCalculate(() => this.indicators.calculateMACD(closes), [{}]);
            const stoch = this.indicators.safeCalculate(() => this.indicators.calculateStochastic(highs, lows, closes, 14, 3), [{}]);
            const cci = this.indicators.safeCalculate(() => this.indicators.calculateCCI(highs, lows, closes, 20), [0]);
            const adx = this.indicators.safeCalculate(() => this.indicators.calculateADX(highs, lows, closes, 14), [{}]);

            // ✅ CÁLCULO DE BOLLINGER BANDS CON VALIDACIÓN ROBUSTA
            const bb = this.indicators.safeCalculate(() => this.indicators.calculateBollingerBands(closes, 20, 2), {
                upper: [lastClose * 1.1],
                middle: [lastClose],
                lower: [lastClose * 0.9]
            });

            // ✅ CÁLCULOS DE VOLUMEN Y ESTRUCTURA DE MERCADO
            const volumeProfile = this.indicators.calculateVolumeProfile(volumes);
            const marketStructure = this.indicators.calculateMarketStructure(highs, lows, closes);
            const pivotPoints = this.indicators.calculatePivotPoints(highs, lows, closes);

            // ✅ VALORES DE INDICADORES CON VALIDACIÓN DE LENGTH
            const lastRsi7 = this.indicators.getLastValue(rsi7, 50);
            const lastRsi14 = this.indicators.getLastValue(rsi14, 50);

            const lastEma20 = this.indicators.getLastValue(ema20, lastClose);
            const lastEma50 = this.indicators.getLastValue(ema50, lastClose);
            const lastEma200 = this.indicators.getLastValue(ema200, lastClose);

            const lastAtr14 = this.indicators.getLastValue(atr14, 0);
            const lastMacd = this.indicators.getLastValue(macd, {});
            const lastStochK = stoch && stoch.length > 0 ? (stoch[stoch.length - 1]?.k || 50) : 50;

            const lastWilliamsR = this.indicators.safeCalculate(() => this.indicators.calculateWilliamsR(highs, lows, closes, 14), 0);
            const lastCci = this.indicators.getLastValue(cci, 0);
            const lastAdx = adx && adx.length > 0 ? (adx[adx.length - 1]?.adx || 0) : 0;

            // ✅ VALORES DE BOLLINGER BANDS CON VALIDACIÓN ROBUSTA
            const lastBbUpper = bb && bb.upper && bb.upper.length > 0 ? bb.upper[bb.upper.length - 1] : lastClose * 1.1;
            const lastBbMiddle = bb && bb.middle && bb.middle.length > 0 ? bb.middle[bb.middle.length - 1] : lastClose;
            const lastBbLower = bb && bb.lower && bb.lower.length > 0 ? bb.lower[bb.lower.length - 1] : lastClose * 0.9;

            // ✅ ESTADOS DERIVADOS GENERALES CON VALIDACIÓN
            const trendAlignment = this.indicators.calculateTrendAlignment(lastEma20, lastEma50, lastEma200, lastClose);
            const momentumState = this.indicators.calculateMomentumState(lastRsi14, lastStochK, lastCci, lastWilliamsR);
            const volatilityState = this.indicators.calculateVolatilityState(lastAtr14, lastClose, lastBbUpper, lastBbLower);
            const marketCondition = this.indicators.calculateMarketCondition(lastAdx, lastRsi14, volatilityState);
            const pricePosition = this.indicators.calculatePricePosition(lastClose, marketStructure);

            // ✅ GESTIÓN DE RIESGO

            // ✅ CONSTRUIR PROMPT DINÁMICO
            return this.generatePrompt({
                // Datos básicos
                symbol: marketConfig,
                timeframe: marketConfig,
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
- Symbol: ${symbol.market}
- Timeframe: ${timeframe.interval}
- Last Close Price: ${lastClose.toFixed(4)}
- 24h Volume: ${lastVolume.toFixed(2)}
- Account Balance: ${accountBalance.toFixed(2)} USDT
- Available Margin: ${availableMargin.toFixed(2)} USDT
- Open Positions: ${openPositions}/${LIMI_OPEN_ORDERS}

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