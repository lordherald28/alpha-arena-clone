// trading-service.interface.ts
import { Observable } from 'rxjs';
import { Candlestick, TradingOrder, Balance, TypeMarket, MarketTicksSize } from '../models'; // Asegúrate de que estos modelos estén definidos
import { Signal, signal } from '@angular/core';

export interface ITradingService {

    // Propiedades necesarias
    // readonly currentPriceMarketSymbol: Signal<number>;
    // Para datos de mercado
    getCandles(marketData: TypeMarket/* market: string, interval: string, limit: number */): Observable<Candlestick[]>;

    // Para información de la cuenta y trading (requieren autenticación)
    // getAccountBalance(): Observable<Balance[]>;
    placeMarketOrder(params: { market: string; side: string; amount: number; }): TradingOrder;
    getOpenOrders(market: string): Observable<TradingOrder[]>;
    getMarketStatusTicksSize(marketData: TypeMarket): Observable<MarketTicksSize>;
    // ... otros métodos comunes que necesites
}