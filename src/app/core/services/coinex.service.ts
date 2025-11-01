import { Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
import { Balance, Candlestick, TradingOrder, TypeMarket } from '../models';
import { ITradingService } from '../base/trading-service.interface';

import { environment } from '../../environments/environment';
import { environment as envProd } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class CoinexService implements ITradingService {

  private readonly BASE_URL = !environment.production ? '/api' : envProd.coinex.baseUrl;
  readonly currentPriceMarketSymbol = signal<number>(0);// ← readonly para seguridad

  private marketData = signal<TypeMarket>({
    market: environment.trading.pair,
    interval: environment.trading.interval,
    limit: 1
  });


  private readonly VALID_INTERVALS = [
    '1min', '3min', '5min', '15min', '30min',
    '1h', '2h', '4h', '6h', '12h',
    '1day', '3day', '1week', '1month'
  ];

  constructor(private http: HttpClient) { console.log('BASE_URL: ', this.BASE_URL) }

  setMaketData(marketData: TypeMarket): void {
    console.log('Actualizado: ', this.marketData());
    this.marketData.set(marketData)
  }


  getAccountBalance(): Observable<Balance[]> {
    return of([]);
  }

  getOpenOrders(market: string): Observable<TradingOrder[]> {
    return of([]);
  }

  placeMarketOrder(params: { market: string; side: string; amount: string; }): Observable<any> {
    return of(null);
  }

  /**
   * TODO Esto no sirve recibir los datos por parametros del market data, porque cuando lo cambias no es el que viene actualizado.
   * @param market 
   * @param interval 
   * @param limit 
   * @returns 
   */
  getCandles(market: string, interval: string, limit: number): Observable<Candlestick[]> {
    if (!this.VALID_INTERVALS.includes(interval)) {
      return throwError(() => new Error(`Intervalo no válido. Usa: ${this.VALID_INTERVALS.join(', ')}`));
    }

    const url = `${this.BASE_URL}/futures/kline`;


    const params = new HttpParams()
      .set('market', this.marketData().market.toUpperCase())
      .set('limit', this.marketData().limit.toString())
      .set('period', this.marketData().interval)
    // .set('period', '');

    console.log('🔍 Parámetros enviados:', this.marketData());

    return this.http.get<any>(url, { params, headers: { 'Access-Control-Allow-Origin': '*' } }).pipe(
      map(response => {
        if (response.code === 0 && response.data) {
          // Obtener precio actua
          this.currentPriceMarketSymbol.set(response.data[0].close);
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