// services/trading-execution.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, tap } from 'rxjs';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

export interface Balance {
  currency: string;
  available: string;
  frozen: string;
}

export interface Order {
  order_id: string;
  market: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: string;
  price: string;
  status: string;
  created_at: number;
}

@Injectable({
  providedIn: 'root'
})
export class TradingExecutionService {
  // ✅ MANTENER la misma URL base que ya funciona (con proxy)
  private readonly BASE_URL = '/api';
  // private readonly ACCESS_ID = environment.coinex.apiKey;
  // private readonly SECRET_KEY = environment.coinex.apiSecret;
  private readonly ACCESS_ID = '67B9588D3B744755A1FD7BCA62FE3A41';
  private readonly SECRET_KEY = '4E63C3DAD4494B8AD52FC391F83F74EA2D6597FAE6CDAE58';
  
  // Signals para estado reactivo
  public balance = signal<Balance[]>([]);
  public openOrders = signal<Order[]>([]);

  constructor(private http: HttpClient) { }

  /**
   * Crear firma de autorización para CoinEx (igual que antes)
   */
  // private createSignature(method: string, path: string, body: string = '', timestamp: string): string {
  //   const signString = method + path + body + timestamp;
  //   return CryptoJS.HmacSHA256(signString, this.SECRET_KEY).toString(CryptoJS.enc.Hex);
  // }
 private createSignature(method: string, path: string, body: string = '', timestamp: string): string {
    // ✅ FORMA CORRECTA según documentación de CoinEx
    const signString = method + path + body + timestamp;
    
    console.log('🔐 DEBUG - Cadena para firmar:', {
      method,
      path, 
      body,
      timestamp,
      fullString: signString
    });
    
    const signature = CryptoJS.HmacSHA256(signString, this.SECRET_KEY).toString(CryptoJS.enc.Hex);
    
    console.log('🔐 DEBUG - Firma generada:', signature);
    
    return signature;
  }

  // Método para probar la autenticación
  testAuth(): Observable<any> {
    const timestamp = Date.now().toString(); // ✅ MILISEGUNDOS como string
    const method = 'GET';
    const path = '/assets/futures/balance';
    const body = ''; // ✅ String vacío para GET

    const signature = this.createSignature(method, path, body, timestamp);

    const headers = new HttpHeaders({
      'X-COINEX-KEY': this.ACCESS_ID,
      'X-COINEX-SIGN': signature,
      'X-COINEX-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    });

    console.log('🧪 DEBUG - Headers enviados:', {
      key: this.ACCESS_ID,
      timestamp: timestamp,
      signature: signature
    });

    return this.http.get(`${this.BASE_URL}${path}`, { headers }).pipe(
      tap(response => console.log('✅ RESPUESTA EXITOSA:', response)),
      catchError(error => {
        console.error('❌ ERROR en autenticación:', error);
        console.log('🔍 Detalles del error:', error.error);
        throw error;
      })
    );
  }

  getAccountBalanceTest(): Observable<any> {
    return this.testAuth(); // Usamos el método de prueba primero
  }

  /**
   * Obtener balance de la cuenta - SOLO ESTE ENDPOINT NUEVO
   */
  getAccountBalance(): Observable<Balance[]> {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/assets/futures/balance'; // ✅ Sin /v2 porque el proxy ya lo incluye

    const signature = this.createSignature(method, path, '', timestamp);

    const headers = new HttpHeaders({
      'X-COINEX-KEY': this.ACCESS_ID,
      'X-COINEX-SIGN': signature,
      'X-COINEX-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    });

    console.log('🔐 Solicitando balance...');

    return this.http.get<{ code: number; data: Balance[] }>(`${this.BASE_URL}${path}`, { headers })
      .pipe(
        map(response => {
          console.log('📨 Respuesta balance:', response);
          if (response.code === 0) {
            const balances = response.data.filter(b => parseFloat(b.available) > 0 || parseFloat(b.frozen) > 0);
            this.balance.set(balances);
            console.log('💰 Balance actualizado:', balances);
            return balances;
          }
          throw new Error(`Error ${response.code}: Failed to get balance`);
        }),
        catchError(error => {
          console.error('❌ Error obteniendo balance:', error);
          throw error;
        })
      );
  }

  /**
   * Colocar orden MARKET - SOLO ESTE ENDPOINT NUEVO
   */
  placeMarketOrder(params: {
    market: string;
    side: 'buy' | 'sell';
    amount: string;
  }): Observable<any> {
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path = '/futures/order'; // ✅ Sin /v2 porque el proxy ya lo incluye

    const orderData = {
      market: params.market,
      market_type: 'SPOT',
      side: params.side,
      type: 'market',
      amount: params.amount
    };

    const body = JSON.stringify(orderData);
    const signature = this.createSignature(method, path, body, timestamp);

    const headers = new HttpHeaders({
      'X-COINEX-KEY': this.ACCESS_ID,
      'X-COINEX-SIGN': signature,
      'X-COINEX-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    });

    console.log('🔄 Enviando orden MARKET:', orderData);

    return this.http.post(`${this.BASE_URL}${path}`, body, { headers })
      .pipe(
        tap((response: any) => {
          console.log('📨 Respuesta orden:', response);
          if (response.code === 0) {
            console.log('✅ Orden MARKET ejecutada:', response.data);
            // Actualizar balance después de la orden
            this.getAccountBalance().subscribe();
          } else {
            console.error('❌ Error en orden MARKET:', response);
          }
        }),
        catchError(error => {
          console.error('❌ Error ejecutando orden:', error);
          throw error;
        })
      );
  }
}