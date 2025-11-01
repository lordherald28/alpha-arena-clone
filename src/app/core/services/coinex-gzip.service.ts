// services/coin-ex-gzip.service.ts
import { Injectable, signal } from '@angular/core';
import { Observable, single, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CoinExGzipService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<any>();
  public messages$ = this.messageSubject.asObservable();

  private _id = signal<number>(0);

  constructor() { }

  /**
   * Conexión que maneja GZIP
   */
  connect(market: string): void {
    if (this.ws) {
      this.ws.close();
    }

    const url = 'wss://socket.coinex.com/v2/futures';
    console.log('🔗 Conectando a:', url);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket CONECTADO');

      const message = {
        method: 'state.subscribe',
        params: { "market_list": [market] },
        id: Date.now()
      };

      this._id.set(message.id);

      // console.log('📤 Enviando suscripción:', message);
      this.ws!.send(JSON.stringify(message));
    };

    this.ws.onmessage = async (event) => {
      // console.log('📨 Datos recibidos - Tipo:', typeof event.data);

      if (event.data instanceof Blob) {
        // console.log('📦 Blob GZIP recibido, tamaño:', event.data.size);

        try {
          // Descomprimir el GZIP
          const decompressedData = await this.decompressGzip(event.data);
          // console.log('✅ Datos descomprimidos:', decompressedData);

          // Parsear el JSON
          const parsedData = JSON.parse(decompressedData);
          // console.log('🎯 JSON Parseado:', parsedData);

          this.messageSubject.next(parsedData);

        } catch (error) {
          console.error('❌ Error procesando GZIP:', error);
        }
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ ERROR WebSocket:', error);
      this.messageSubject.error(error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket CERRADO:', event.code, event.reason);
      this.messageSubject.complete();
    };
  }

  /**
   * Descomprimir datos GZIP usando la API de Compression Streams
   */
  private async decompressGzip(blob: Blob): Promise<string> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const decompressionStream = new DecompressionStream('gzip');
      const decompressedStream = new Response(
        new Blob([arrayBuffer]).stream().pipeThrough(decompressionStream)
      );

      const decompressedArrayBuffer = await decompressedStream.arrayBuffer();
      return new TextDecoder().decode(decompressedArrayBuffer);

    } catch (error) {
      console.error('❌ Error en descompresión GZIP:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('🔌 WebSocket desconectado');
    }
  }

  unsubscribe(): void {
    const message = {
      method: 'state.unsubscribe',
      params: { "market_list": [] },
      id: this._id()
    };

    // console.log('📤 Enviando suscripción:', message);
    this.ws!.send(JSON.stringify(message));
    console.log('🔌 WebSocket unsubscribe');
  }

  getMessages(): Observable<any> {
    return this.messages$;
  }
}