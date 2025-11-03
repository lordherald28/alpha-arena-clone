import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Market, TypeMarket } from '../../models';
import { environment } from '../../../environments/environment';

// —— Mensajes WS
export interface CoinexStateMsg {
    method: 'state.update';
    data: { market: string; state_list: Array<Market /* { market: string; last: string; mark_price: string; high: string; low: string; } */> };
    id: number | null;
}
export interface CoinexDealsMsg {
    method: 'deals.update';
    data: { market: string; deal_list: Array<{ deal_id: number; created_at: number; side: 'buy' | 'sell'; price: string; amount: string; }> };
    id: number | null;
}

@Injectable({ providedIn: 'root' })
export class WSocketCoinEx {
    private marketState$ = new BehaviorSubject<CoinexStateMsg | null>(null); // opcional
    private deals$ = new BehaviorSubject<CoinexDealsMsg | null>(null);       // para velas

    private wsocket!: WebSocket;
    private url = environment.coinex.wsUrl || 'wss://socket.coinex.com/v2/futures';
    private lastId = 0;

    connect(tm: TypeMarket): void {
        this.wsocket = new WebSocket(this.url);

        this.wsocket.onopen = () => {
            const subState = { method: 'state.subscribe', params: { market_list: [tm.market] }, id: ++this.lastId };
            const subDeals = { method: 'deals.subscribe', params: { market_list: [tm.market] }, id: ++this.lastId };
            this.wsocket.send(JSON.stringify(subState)); // solo precio 24h si lo necesitas
            this.wsocket.send(JSON.stringify(subDeals)); // trades en vivo
        };

        this.wsocket.onmessage = async (event: MessageEvent) => {
            if (!(event.data instanceof Blob)) return;
            try {
                const ds = new DecompressionStream('gzip');
                const text = await new Response(event.data.stream().pipeThrough(ds)).text();
                const msg = JSON.parse(text);

                if (msg?.method === 'state.update') this.marketState$.next(msg as CoinexStateMsg);
                if (msg?.method === 'deals.update') this.deals$.next(msg as CoinexDealsMsg);
            } catch (e) {
                console.error('WS parse error', e);
            }
        };

        this.wsocket.onclose = e => console.log('WS cerrado', e.code, e.wasClean);
    }

    disconnect(tm: TypeMarket): void {
        if (!this.wsocket) return;
        const u1 = { method: 'state.unsubscribe', params: { market_list: [tm.market] }, id: ++this.lastId };
        const u2 = { method: 'deals.unsubscribe', params: { market_list: [tm.market] }, id: ++this.lastId };
        this.wsocket.send(JSON.stringify(u1));
        this.wsocket.send(JSON.stringify(u2));
        this.wsocket.close();
    }

    getMarketState$(): Observable<CoinexStateMsg | null> { return this.marketState$.asObservable(); }
    getDeals$(): Observable<CoinexDealsMsg | null> { return this.deals$.asObservable(); }
}
