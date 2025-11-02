import { computed, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
import { Balance, Candlestick, TradingOrder, TypeMarket } from '../models';
import { ITradingService } from '../base/trading-service.interface';

import { environment } from '../../environments/environment';
import { environment as envProd } from '../../environments/environment.prod';
import { StoreAppService } from '../store/store-app.service';
import { IGetConfigDataMarket } from '../base/segregtion.interface';

@Injectable({
  providedIn: 'root'
})
export class CoinexService implements ITradingService {

  private readonly BASE_URL = !environment.production ? '/api' : envProd.coinex.baseUrl;
  readonly currentPriceMarketSymbol = signal<number>(0);// ← readonly para seguridad

  // ✅ Reemplazar por computed signal

  // private readonly storeAppService = inject(StoreAppService) // TODO: Quitar luego, no ahora para no romper el codigo
  // private marketData = computed(() => this.storeAppService.getDataMarket());  // TODO: Quitar luego, no ahora para no romper el codigo

  private readonly VALID_INTERVALS = [
    '1min', '3min', '5min', '15min', '30min',
    '1h', '2h', '4h', '6h', '12h',
    '1day', '3day', '1week', '1month'
  ];

  constructor(private http: HttpClient) { }

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
  getCandles(): Observable<Candlestick[]> {

    // if (!this.VALID_INTERVALS.includes(this.marketData().interval)) {
    //   return throwError(() => new Error(`Intervalo no válido. Usa: ${this.VALID_INTERVALS.join(', ')}`));
    // }

    const url = `${this.BASE_URL}/futures/kline`;


    const params = new HttpParams()
      .set('market', environment.trading.pair/* this.marketData().market.toUpperCase() */) 
      .set('limit', environment.trading.candleLimit /* this.marketData().limit.toString() */)
      .set('period', environment.trading.interval /* this.marketData().interval */)
    // .set('period', '');

    // console.log('🔍 Parámetros enviados:', this.marketData());

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