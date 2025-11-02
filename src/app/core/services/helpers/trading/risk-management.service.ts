// src/app/services/core/risk-management.service.ts

import { computed, inject, Injectable } from '@angular/core';
import { AiResponse, TradingOrder } from '../../../models';
import {
    ATR_MULTIPLIER_SL,
    ATR_MULTIPLIER_TP,
    DESITION,
    MAX_ORDEN_OPEN,
    MINCONFIDENCE
} from '../../../utils/const.utils';
import { StoreAppService } from '../../../store/store-app.service';

/**
 * @description Servicio "puro" especializado en cálculos de gestión de riesgo.
 * No mantiene estado, solo realiza cálculos basados en los datos que recibe.
 */
@Injectable({ providedIn: 'root' })
export class RiskManagementService {
    constructor() { }

    /**
     * @description Calcula el tamaño de la posición basado en el balance disponible y un porcentaje de riesgo.
     * @param availableBalance El balance disponible en la cuenta.
     * @param riskPercent El porcentaje del balance a arriesgar (ej: 0.02 para 2%).
     * @returns El monto en USDT a arriesgar en la operación.
     */
    public calculatePositionSize(availableBalance: number, riskPercent: number): number {
        return availableBalance * riskPercent;
    }

    /**
     * @description Calcula el Take Profit y Stop Loss basado en un porcentaje de riesgo.
     * @param side El lado de la operación ('BUY' o 'SELL').
     * @param entryPrice El precio de entrada de la operación.
     * @param riskPercent El porcentaje de riesgo para el Stop Loss.
     * @param riskRewardRatio La relación riesgo/beneficio deseada para el Take Profit (ej: 1.5).
     * @returns Un objeto con los precios calculados para TP y SL.
     */
    public calculateTpSlByPercent(
        side: 'BUY' | 'SELL' | 'HOLD',
        entryPrice: number,
        riskPercent: number,
        riskRewardRatio: number = 1.5
    ): { tp: number, sl: number } {
        if (side === DESITION.BUY) {
            const sl = entryPrice * (1 - riskPercent);
            const tp = entryPrice * (1 + (riskPercent * riskRewardRatio));
            return { tp, sl };
        } else {
            const sl = entryPrice * (1 + riskPercent);
            const tp = entryPrice * (1 - (riskPercent * riskRewardRatio));
            return { tp, sl };
        }
    }

    /**
     * @description Calcula el Take Profit y Stop Loss basado en el indicador ATR.
     * @param side El lado de la operación ('BUY' o 'SELL').
     * @param entryPrice El precio de entrada de la operación.
     * @param atr El valor actual del ATR.
     * @returns Un objeto con los precios calculados para TP y SL.
     */
    public calculateTpSlByAtr(side: 'BUY' | 'SELL' | 'HOLD', entryPrice: number, atr: number): { tp: number, sl: number } {
        const atrMultiplierSL = ATR_MULTIPLIER_SL;
        const atrMultiplierTP = ATR_MULTIPLIER_TP;

        if (side === DESITION.BUY) {
            const sl = entryPrice - (atr * atrMultiplierSL);
            const tp = entryPrice + (atr * atrMultiplierTP);
            return { tp, sl };
        } else {
            const sl = entryPrice + (atr * atrMultiplierSL);
            const tp = entryPrice - (atr * atrMultiplierTP);
            return { tp, sl };
        }
    }

    /**
     * @description Determina si una orden debe ser ejecutada basándose en múltiples criterios de riesgo.
     * @param aiResponse La respuesta de la IA con la decisión y la confianza.
     * @param openOrdersCount El número actual de órdenes abiertas.
     * @param availableBalance El balance disponible en la cuenta.
     * @param atr El valor actual del ATR (opcional).
     * @param currentPrice El precio actual del mercado (necesario para la validación de volatilidad con ATR).
     * @returns `true` si la orden debe ejecutarse, `false` en caso contrario.
     */
    public shouldExecuteOrder(
        aiResponse: AiResponse,
        openOrdersCount: number,
        availableBalance: number,
        atr?: number,
        currentPrice?: number
    ): boolean {
        // 1. Validar decisión y confianza de la IA
        if (aiResponse.decision === 'HOLD' || aiResponse.confidence < MINCONFIDENCE) {
            return false;
        }

        // 2. Validar volatilidad extrema (si se proporciona ATR)
        if (atr && currentPrice && atr > currentPrice * 0.04) {
            return false;
        }

        // 3. Validar número máximo de órdenes abiertas
        if (openOrdersCount >= MAX_ORDEN_OPEN) {
            return false;
        }

        // 4. Validar balance suficiente
        if (availableBalance < 1) {
            return false;
        }

        return true;
    }
}