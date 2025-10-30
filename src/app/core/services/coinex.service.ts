import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
import { Balance, Candlestick, Order } from '../models';
import { ITradingService } from '../base/trading-service.interface';

import { environment } from '../../environments/environment';
import { environment as envProd } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class CoinexService implements ITradingService {
  private readonly BASE_URL = '/api';

  private readonly VALID_INTERVALS = [
    '1min', '3min', '5min', '15min', '30min',
    '1h', '2h', '4h', '6h', '12h',
    '1day', '3day', '1week', '1month'
  ];

  constructor(private http: HttpClient) { console.log('BASE_URL: ', this.BASE_URL) }

  getAccountBalance(): Observable<Balance[]> {
    return of([]);
  }

  getOpenOrders(market: string): Observable<Order[]> {
    return of([]);
  }

  placeMarketOrder(params: { market: string; side: string; amount: string; }): Observable<any> {
    return of(null);
  }

  getCandles(market: string, interval: string, limit: number): Observable<Candlestick[]> {
    if (!this.VALID_INTERVALS.includes(interval)) {
      return throwError(() => new Error(`Intervalo no válido. Usa: ${this.VALID_INTERVALS.join(', ')}`));
    }

    const url = `${this.BASE_URL}/futures/market`;


    const params = new HttpParams()
      .set('market', market.toUpperCase())
      .set('limit', limit.toString())
      .set('period', interval)
    // .set('period', '');

    console.log('🔍 Parámetros enviados:', {
      market: market.toUpperCase(),
      period: interval,
      limit: limit.toString()
    });

    return this.http.get<any>(url, { params, headers: { 'Access-Control-Allow-Origin': '*' } }).pipe(
      map(response => {
        if (response.code === 0 && response.data) {
          const candles = response.data.map((item: any) => ({
            timestamp: item.created_at,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume)
          }));
          return candles;
        } else {
          throw new Error(`CoinEx Error ${response.code}: ${response.message}`);
        }
      })
    );
  }
}