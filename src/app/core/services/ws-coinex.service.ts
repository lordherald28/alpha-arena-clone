import { inject, Injectable, signal } from "@angular/core";
import { StoreAppService } from "../store/store-app.service";
import { Market, ResponseMarketInformation, ActionSubsWS, SubscriptionMessage, TypeMarket } from "../models";
import { environment } from "../../environments/environment";
import { BehaviorSubject } from "rxjs";

export interface MessageMarketWS {
    // Subscribe to a singular market
    method: string;
    params: any;
    id: number | string;
}

@Injectable({ providedIn: 'root' })
export class WSocketCoinEx {

    // private readonly StoreAppService = inject(StoreAppService);
    private marketData$ = new BehaviorSubject<ResponseMarketInformation | null>(null);

    public messageSubs = signal<MessageMarketWS>({ method: '', params: { key: [""] }, id: 0 });

    private wsocket !: WebSocket;

    // private storeApp = inject(StoreAppService);

    private url = environment.coinex.wsUrl;

    private id: number = 0;

    constructor() { }

    connect(TypeMarket: TypeMarket): void {

        this.wsocket = new WebSocket(this.url);
        const message: SubscriptionMessage = {
            method: ActionSubsWS.subscribe,
            params: { market_list: [TypeMarket.market] },
            id: Date.now()
        };
        this.id = message.id;

        this.wsocket.onopen = ((event: Event) => {
            console.log('Abriendo: ', event);
            this.wsocket.send(JSON.stringify(message));
        });

        this.wsocket.onmessage = async (event: MessageEvent) => {
            if (event.data instanceof Blob) {

                try {
                    await this.BlobToJsonObject(event);

                } catch (error) {
                    console.error('Error al procesar el Blob o parsear el JSON:', error);
                }
            }
        }

        this.wsocket.onclose = (e) => {
            console.log(e.wasClean); // true si la conexión se cerró limpiamente
            console.log(e.code); // código de cierre
        }
    }

    private async BlobToJsonObject(event: MessageEvent<any>): Promise<Market | null> {
        const blob = event.data;

        // PASO 1: Crear un stream de descompresión (Gzip es el más común)
        const decompressionStream = new DecompressionStream('gzip');

        const descomprimido = blob.stream().pipeThrough(decompressionStream);

        const respuesta = new Response(descomprimido);

        const texto = await respuesta.text();

        const json = JSON.parse(texto) as ResponseMarketInformation;

        if (json.data) {
            // this.StoreAppService.setMarkInfo(json.data.state_list[0]);
            return json.data.state_list[0];
        }
        return null;
    }

    disconnect(TypeMarket: TypeMarket): void {
        if (this.wsocket) {
            this.wsocket.onmessage = (e) => {
                const message: SubscriptionMessage = {
                    // Cancel all subscribed markets
                    method: ActionSubsWS.unsubscribe,
                    params: { market_list: [TypeMarket.market] },
                    id: this.id
                }
                this.wsocket.send(JSON.stringify(message));
            }
            this.wsocket.close();
            console.log('🔌 WebSocket desconectado');
        }
    }

    state(): string {
        if (this.wsocket.OPEN) return 'Abierto';
        if (this.wsocket.CLOSING) return 'Conectado';
        if (this.wsocket.CLOSING) return 'Cerrando';
        return 'Cerrado';
    }
}