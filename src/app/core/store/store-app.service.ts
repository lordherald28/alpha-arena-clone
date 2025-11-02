import { effect, Injectable, signal, WritableSignal } from '@angular/core';
import { AiResponse, Balance, Candlestick, Market, TradingOrder, TypeMarket } from '../models';
import { environment } from '../../environments/environment';
import { KEY_MARKET_CONFIG_DATA } from '../utils/const.utils';

@Injectable({
  providedIn: 'root'
})
export class StoreAppService {

  // Lo hice puglico ya q es un signal y se va a utilizar en toda la App, tu me diras.
  public readonly marketDataConfig = signal<TypeMarket>({
    interval: environment.trading.interval,
    market: environment.trading.pair,
    limit: environment.trading.candleLimit
  });

  public readonly MarkInfo = signal<Market | null>(null); // Lo hice puglico ya q es un signal y se va a utilizar en toda la App, tu me diras.

  // TODO: Nuevas variables refactorizadas
  public readonly candles = signal<Candlestick[]>([]); // (las velas históricas y actualizadas)
  public readonly currentPrice = signal<number>(0); // (el precio en tiempo real)
  public readonly paperBalance = signal<Balance | null>(null); // (el balance de paper trading)
  public readonly openOrders = signal<TradingOrder[]>([]); // (las órdenes abiertas)
  public readonly orders = signal<TradingOrder[]>([]); // (las órdenes en general)
  public readonly ordersHistory = signal<TradingOrder[]>([]); // (historial de órdenes)
  public readonly aiResponseHistory = signal<AiResponse[]>([]); // (historial de respuestas de la IA) / Para tener trazabilidad de la misma y ver una si se desea en la UI
  public readonly isLoading = signal<boolean>(false); // Si esta cargando, tema Spiner en UI


  constructor() {
    this.loadDataMarket();
    this.saveDataMarket();

    effect(() => {
      if (this.MarkInfo()) {
        console.log('Symbol cambiado: ', this.MarkInfo()?.market);
        console.log(`Precio del ${this.MarkInfo()?.market} $: `, this.MarkInfo()?.mark_price);
      }
    })
  }

  /**
   * @description Devolver el market config 
   * @returns 
   */
  getDataMarket(): TypeMarket {
    return this.marketDataConfig();
  }

  getSignalMarket() {
    return this.marketDataConfig;
  }

  getMarkInfo(): WritableSignal<Market | null> {
    return this.MarkInfo;
  }

  setMarkInfo(Market: Market): void {
    this.MarkInfo.set(Market);
  }

  /**
   * 
   */
  setDataMarket(marketData: TypeMarket): void {
    this.marketDataConfig.set(marketData);
  }

  private loadDataMarket(): void {
    if (localStorage.getItem(KEY_MARKET_CONFIG_DATA)) {
      const config_market = localStorage.getItem(KEY_MARKET_CONFIG_DATA)
      this.marketDataConfig.set(config_market ? JSON.parse(config_market) : {
        interval: environment.trading.interval,
        market: environment.trading.pair,
        limit: environment.trading.candleLimit
      });
    }
  }

  private saveDataMarket(): void {
    effect(() => {
      localStorage.setItem(KEY_MARKET_CONFIG_DATA, JSON.stringify(this.marketDataConfig()));
    })
  }
}
