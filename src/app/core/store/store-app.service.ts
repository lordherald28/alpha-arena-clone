import { effect, Injectable, signal, WritableSignal } from '@angular/core';
import { Market, TypeMarket } from '../models';
import { environment } from '../../environments/environment';
import { KEY_MARKET_CONFIG_DATA } from '../utils/const.utils';

@Injectable({
  providedIn: 'root'
})
export class StoreAppService {

  private marketDataConfig = signal<TypeMarket>({
    interval: environment.trading.interval,
    market: environment.trading.pair,
    limit: environment.trading.candleLimit
  });

  private MarkInfo = signal<Market | null>(null);

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
