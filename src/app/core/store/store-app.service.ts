import { effect, Injectable, signal } from '@angular/core';
import { TypeMarket } from '../models';
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


  constructor() {
    this.loadDataMarket();
    this.saveDataMarket();
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
