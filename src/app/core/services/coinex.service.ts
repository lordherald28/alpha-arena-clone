import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
import { Balance, Candlestick, Order } from '../models';
import { ITradingService } from '../base/trading-service.interface';

@Injectable({
  providedIn: 'root'
})
export class CoinexService implements ITradingService {
  private readonly BASE_URL = '/api';

  // Intervalos válidos según CoinEx
  private readonly VALID_INTERVALS = [
    '1min', '3min', '5min', '15min', '30min',
    '1h', '2h', '4h', '6h', '12h',
    '1day', '3day', '1week', '1month'
  ];

  constructor(private http: HttpClient) { }



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
    // Validar que el intervalo sea válido
    if (!this.VALID_INTERVALS.includes(interval)) {
      return throwError(() => new Error(`Intervalo no válido. Usa: ${this.VALID_INTERVALS.join(', ')}`));
    }

    // const url = `${this.BASE_URL}/spot/kline`;
    const url = `${this.BASE_URL}/futures/kline?market=${market}&limit=${limit}&period=${interval}`;
    // Construir parámetros cuidadosamente
    const params = new HttpParams()
      .set('market', market.toUpperCase()) // Asegurar mayúsculas
      .set('type', interval)
      .set('limit', limit.toString());

    console.log('🔍 Parámetros enviados:', {
      market: market.toUpperCase(),
      type: interval,
      limit: limit.toString()
    });

    return this.http.get<any>(url, { params }).pipe(
      map(response => {
        // console.log('📨 Respuesta RAW de CoinEx:', response);

        if (response.code === 0 && response.data) {
          // ✅ MAPEO CORREGIDO - CoinEx devuelve objetos, no arrays
          const candles = response.data.map((item: any) => ({
            timestamp: item.created_at, // Ya está en milisegundos
            open: parseFloat(item.open), // Convertir string a number
            high: parseFloat(item.high), // Convertir string a number
            low: parseFloat(item.low),   // Convertir string a number
            close: parseFloat(item.close), // Convertir string a number
            volume: parseFloat(item.volume) // Convertir string a number
          }));

          // console.log('✅ Velas convertidas correctamente:', candles.length);
          // console.log('📊 Ejemplo de vela:', candles[0]);
          return candles;
        } else {
          throw new Error(`CoinEx Error ${response.code}: ${response.message}`);
        }
      })
    );
  }
}