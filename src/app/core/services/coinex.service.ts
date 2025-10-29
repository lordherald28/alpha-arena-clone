import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Candlestick, Order } from '../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CoinexService {
  private baseUrl = environment.coinex.baseUrl;

  constructor(private http: HttpClient) { }

  getCandles(market: string, interval: string, limit: number): Observable<Candlestick[]> {
    const url = `${this.baseUrl}/market/kline?market=${market}&type=${interval}&limit=${limit}`;
    return this.http.get<any[][]>(url).pipe(
      map(data => data.map(item => ({
        timestamp: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      })))
    );
  }

  // NOTA: Colocar órdenes es más complejo y requiere firma HMAC.
  // Esto es un placeholder para mostrar la intención.
  // En un caso real, esto debería llamar a un backend tuyo.
  placeOrder(order: { market: string; type: string; side: string; amount: string; price: string }): Observable<any> {
    console.warn('La colocación de órdenes debe hacerse a través de un backend seguro por razones de firma de API.');
    // Ejemplo de cómo sería la llamada (no funcionará sin firma)
    // const url = `${this.baseUrl}/spot/order`;
    // const body = { ...order, access_id: environment.coinex.apiKey };
    // const headers = this.createSignedHeaders(body); // Necesitarías una función para firmar
    // return this.http.post(url, body, { headers });
    return new Observable(observer => {
      observer.next({ status: 'simulated', message: 'Order would be placed here' });
      observer.complete();
    });
  }
}