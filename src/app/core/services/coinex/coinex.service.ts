import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { Balance, Candlestick, MarketTicksSize, TradingOrder, TypeMarket, validIntervals } from '../../models';
import { ITradingService } from '../../base/trading-service.interface';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { environment as envProd } from '../../../environments/environment.prod';


@Injectable({
  providedIn: 'root'
})
export class CoinexService implements ITradingService {

  private readonly BASE_URL = !environment.production ? '/api' : envProd.coinex.baseUrl;
  readonly currentPriceMarketSymbol = signal<number>(0);// ← readonly para seguridad

  public readonly marketStatusTicksSize = signal<MarketTicksSize>({
    tick_size: '',
    leverage: []
  });

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

  placeMarketOrder(params: { market: string; side: string; amount: number; }): TradingOrder {
    return Object.assign({});
  }

  /**
   * TODO Esto no sirve recibir los datos por parametros del market data, porque cuando lo cambias no es el que viene actualizado.
   * @param market 
   * @param interval 
   * @param limit 
   * @returns 
   */
  getCandles(marketData: TypeMarket): Observable<Candlestick[]> {

    if (!validIntervals.includes(marketData.interval)) {
      return throwError(() => new Error(`Intervalo no válido. Usa: ${validIntervals.join(', ')}`));
    }

    const url = `${this.BASE_URL}/futures/kline`;
    const params = new HttpParams()
      .set('market', marketData.market.toUpperCase())
      .set('limit', marketData.limit.toString())
      .set('period', marketData.interval)

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

  getMarketStatusTicksSize(marketData: TypeMarket): Observable<MarketTicksSize> {

    const url = `${this.BASE_URL}/futures/market`;
    const params = new HttpParams()
      .set('market', marketData.market.toUpperCase())

    return this.http.get<any>(url, { params, headers: { 'Access-Control-Allow-Origin': '*' } })
      .pipe(
        // tap((response) => console.log('📏 ticks size price symbol: ', response)),
        map(response => {

          if (response.code === 0 && response.data) {
            const data = response.data;

            this.marketStatusTicksSize.set({
              leverage: data.leverage,
              tick_size: data.tick_size,
              market: data.market
            });
            return data;
          } else {
            throw new Error(`CoinEx Error ${response.code}: ${response.message}`);
          }
        }),
        catchError(error => {
          console.error('Error fetching tick size:', error);
          return of({
            leverage: [],
            tick_size: '',
            market: ''
          });
        })

      )
  }
}