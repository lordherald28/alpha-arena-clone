import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CoinExBasicService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<any>();
  public messages$ = this.messageSubject.asObservable();

  constructor() { }

  /**
   * Conexión básica que maneja Blobs
   */
  connect(market: string): void {
    // Cerrar conexión anterior si existe
    if (this.ws) {
      this.ws.close();
    }

    const url = 'wss://socket.coinex.com/v2/futures';
    console.log('🔗 Conectando a:', url);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket CONECTADO');

      // Mensaje de suscripción
      const message = {
        method: 'state.subscribe',
        params: { "market_list": [market] },
        id: Date.now()
      };

      console.log('📤 Enviando suscripción:', message);
      this.ws!.send(JSON.stringify(message));
    };

    this.ws.onmessage = async (event) => {
      console.log('📨 Datos recibidos - Tipo:', typeof event.data);

      // Manejar Blobs
      if (event.data instanceof Blob) {
        console.log('📦 Blob recibido, tamaño:', event.data.size);

        try {
          // Convertir Blob a texto
          const text = await this.blobToText(event.data);
          console.log('📦 Blob convertido a texto:', text);

          // Intentar parsear como JSON
          try {
            const parsedData = JSON.parse(text);
            console.log('✅ JSON Parseado:', parsedData);

            // Emitir el mensaje parseado
            this.messageSubject.next(parsedData);

          } catch (jsonError) {
            console.log('❌ No es JSON válido, contenido:', text);
          }
        } catch (error) {
          console.error('❌ Error leyendo Blob:', error);
        }
      }
      // Manejar texto directo
      else if (typeof event.data === 'string') {
        console.log('📨 Texto recibido:', event.data);
        try {
          const parsedData = JSON.parse(event.data);
          console.log('✅ JSON Parseado:', parsedData);
          this.messageSubject.next(parsedData);
        } catch (e) {
          console.log('❌ No es JSON válido');
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
   * Convertir Blob a texto
   */
  private blobToText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('🔌 WebSocket desconectado');
    }
  }

  /**
   * Obtener mensajes como Observable
   */
  getMessages(): Observable<any> {
    return this.messages$;
  }
}