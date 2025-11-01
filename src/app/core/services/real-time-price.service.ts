// services/real-time-price.service.ts
import { Injectable, signal, inject } from '@angular/core';

import { Subscription } from 'rxjs';
import { CoinExGzipService } from './coinex-gzip.service';

@Injectable({
    providedIn: 'root'
})
export class RealTimePriceService {
    private coinExService = inject(CoinExGzipService);
    private subscription: Subscription | null = null;

    // Signals para datos en tiempo real
    public currentPrice = signal<number>(0);
    public marketData = signal<any>(null);
    public isConnected = signal<boolean>(false);

    connect(market: string): void {
        this.coinExService.connect(market);

        this.subscription = this.coinExService.messages$.subscribe({
            next: (data) => {
                // this.marketData.set(data.data.state_list[0]);
                this.extractPrice(data);
                this.isConnected.set(true);
            },
            error: (error) => {
                console.error('Error en conexión WebSocket:', error);
                this.isConnected.set(false);
            }
        });
    }

    private extractPrice(data: any): void {
        try {
            // ✅ AGREGUÉ: try-catch para manejo de errores
            if (data.method === 'state.update' /* && data.params */) {
                const marketData = data.data.state_list[0];
                this.marketData.set(marketData);
                // ✅ MODIFIQUÉ: Búsqueda más robusta del precio en diferentes campos
                const price = marketData.last || marketData.close || marketData.price || marketData.current;

                if (price && !isNaN(parseFloat(price))) {
                    const numericPrice = parseFloat(price);
                    console.log('💰 Precio extraído:', numericPrice); // ✅ AGREGUÉ: log
                    this.currentPrice.set(numericPrice);
                } else {
                    console.warn('⚠️ No se pudo extraer precio válido de:', marketData); // ✅ AGREGUÉ
                }
            }
        } catch (error) {
            console.error('❌ Error extrayendo precio:', error); // ✅ AGREGUÉ
        }
    }
    disconnect(): void {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
        this.coinExService.disconnect();
        this.isConnected.set(false);
        this.currentPrice.set(0);
        this.marketData.set(null);
    }

    getCurrentPrice(): number {
        return this.currentPrice();
    }

    unsubscribe(): void {
        this.isConnected.set(false);
        this.currentPrice.set(0);
        this.marketData.set(null);
        this.coinExService.unsubscribe();
        console.log('🔌 WebSocket unsubscribe');
    }
}