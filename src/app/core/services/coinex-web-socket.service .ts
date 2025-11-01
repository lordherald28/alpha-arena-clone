import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import * as pako from 'pako';
import { Market } from '../models';

@Injectable({
    providedIn: 'root'
})
export class CoinExSimpleService {
    private ws: WebSocket | null = null;

    readonly isConnected = signal<boolean>(false);
    readonly marketData = signal<Market | null>(null);
    readonly connectionError = signal<string | null>(null);

    private dataSubject = new Subject<Market>();
    public data$ = this.dataSubject.asObservable();

    constructor() { }

    /**
     * Conectar al WebSocket de CoinEx
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
            this.isConnected.set(true);
            this.connectionError.set(null);

            // Enviar mensaje de suscripción
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

            if (event.data instanceof Blob) {
                console.log('📦 Blob GZIP recibido, tamaño:', event.data.size);

                try {
                    // Descomprimir el GZIP
                    const decompressedData = await this.decompressGzip(event.data);
                    console.log('✅ Datos descomprimidos:', decompressedData);

                    // Parsear el JSON
                    const parsedData = JSON.parse(decompressedData);
                    console.log('🎯 JSON Parseado:', parsedData);

                    // Procesar los datos
                    this.processMessage(parsedData);

                } catch (error: any) {
                    console.error('❌ Error procesando GZIP:', error);
                    this.connectionError.set(`Error procesando datos: ${error.message}`);
                }
            } else {
                console.warn('⚠️ Tipo de dato no esperado:', typeof event.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ ERROR WebSocket:', error);
            this.isConnected.set(false);
            this.connectionError.set('Error de conexión WebSocket');
        };

        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket CERRADO:', event.code, event.reason);
            this.isConnected.set(false);
            this.connectionError.set(`Conexión cerrada: ${event.code} - ${event.reason || 'Sin razón'}`);
        };
    }

    /**
     * Descomprimir GZIP usando pako
     */
    private async decompressGzip(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    const uint8Array = new Uint8Array(arrayBuffer);

                    // Descomprimir con pako
                    const decompressed = pako.inflate(uint8Array, { to: 'string' });
                    resolve(decompressed);

                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    /**
     * Procesar mensaje parseado
     */
    private processMessage(parsedMessage: any): void {
        console.log('🔥 MENSAJE PROCESADO:', parsedMessage);

        // Manejar datos de mercado
        if (parsedMessage?.method === 'state.update' && parsedMessage.data?.state_list) {
            const marketList = parsedMessage.data.state_list;

            if (marketList && marketList.length > 0) {
                const marketInfo = marketList[0]; // Primer mercado de la lista

                const marketData: Market = {
                    market: marketInfo.market,
                    last: marketInfo.last,
                    open: marketInfo.open,
                    close: marketInfo.close,
                    high: marketInfo.high,
                    low: marketInfo.low,
                    volume: marketInfo.volume,
                    volume_sell: marketInfo.volume_sell,
                    volume_buy: marketInfo.volume_buy,
                    value: marketInfo.value,
                    index_price: marketInfo.index_price,
                    mark_price: marketInfo.mark_price,
                    open_interest_volume: marketInfo.open_interest_size, // Mapear nombre
                    period: marketInfo.period
                };

                console.log('📊 DATOS DE MERCADO LISTOS:', marketData);

                // Actualizar señal
                this.marketData.set(marketData);

                // Emitir a suscriptores
                this.dataSubject.next(marketData);
            }
            return;
        }

        // Manejar confirmación de suscripción
        if (parsedMessage?.id && parsedMessage?.result === 'success') {
            console.log('✅ Suscripción confirmada');
            return;
        }

        // Manejar ping
        if (parsedMessage?.method === 'server.ping') {
            console.log('🏓 Ping recibido');
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    method: 'server.pong',
                    params: [],
                    id: Date.now()
                }));
            }
            return;
        }

        console.log('📨 Mensaje no procesado:', parsedMessage);
    }

    /**
     * Desconectar WebSocket
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected.set(false);
            console.log('🔌 WebSocket desconectado');
        }
    }

    /**
     * Obtener datos como Observable
     */
    getMarketData(): Observable<Market> {
        return this.data$;
    }

    /**
     * Obtener estado de conexión
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected(),
            error: this.connectionError(),
            market: this.marketData()?.market || 'Ninguno'
        };
    }

    /**
     * Cambiar de mercado
     */
    changeMarket(newMarket: string): void {
        console.log(`🔄 Cambiando a mercado: ${newMarket}`);
        this.disconnect();
        setTimeout(() => this.connect(newMarket), 500);
    }
}