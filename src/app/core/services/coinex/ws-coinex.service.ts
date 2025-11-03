import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { BehaviorSubject } from "rxjs";
import { CoinexDealsMsg, CoinexStateMsg, TypeMarket } from "../../models";

@Injectable({ providedIn: 'root' })
export class WSocketCoinEx {
    private ws?: WebSocket;
    private url = environment.coinex.wsUrl;
    private lastId = 0;
    private currentMarket = '';
    private session = 0;

    private marketState$ = new BehaviorSubject<CoinexStateMsg | null>(null);
    private deals$ = new BehaviorSubject<CoinexDealsMsg | null>(null);

    async connect(tm: TypeMarket): Promise<void> {
        this.currentMarket = tm.market;
        const session = ++this.session;           // marca de sesión
        this.marketState$.next(null);             // evita replay del símbolo anterior
        this.deals$.next(null);

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.ws!.send(JSON.stringify({ method: 'state.subscribe', params: { market_list: [tm.market] }, id: ++this.lastId }));
            this.ws!.send(JSON.stringify({ method: 'deals.subscribe', params: { market_list: [tm.market] }, id: ++this.lastId }));
        };

        this.ws.onmessage = async (ev) => {
            if (!(ev.data instanceof Blob)) return;
            const text = await new Response(ev.data.stream().pipeThrough(new DecompressionStream('gzip'))).text();
            const msg = JSON.parse(text);
            // descarta mensajes de sesiones viejas o de otro market
            if (this.session !== session) return;

            if (msg.method === 'state.update') this.marketState$.next(msg as CoinexStateMsg);
            if (msg.method === 'deals.update' && msg.data?.market === this.currentMarket) this.deals$.next(msg as CoinexDealsMsg);
        };
    }

    disconnect(): Promise<void> {
        return new Promise(resolve => {
            const ws = this.ws;
            if (!ws) { this.marketState$.next(null); this.deals$.next(null); return resolve(); }

            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'state.unsubscribe', params: { market_list: [this.currentMarket] }, id: ++this.lastId }));
                    ws.send(JSON.stringify({ method: 'deals.unsubscribe', params: { market_list: [this.currentMarket] }, id: ++this.lastId }));
                }
            } catch { }

            ws.onmessage = ws.onopen = ws.onerror = null;
            ws.onclose = () => { this.marketState$.next(null); this.deals$.next(null); resolve(); };
            ws.close();                                // espera el cierre (handshake) :contentReference[oaicite:1]{index=1}
            this.ws = undefined;
        });
    }

    getMarketState$() { return this.marketState$.asObservable(); }
    getDeals$() { return this.deals$.asObservable(); }
}
