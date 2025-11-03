import { computed, effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { AiResponse, Balance, Candlestick, Market, TradingOrder, TypeMarket } from '../models';
import { environment } from '../../environments/environment';
import { KEY_MARKET_CONFIG_DATA } from '../utils/const.utils';
import { BalanceService } from '../services/helpers/trading/balance.service';
import { OrderManagerService } from '../services/helpers/trading/order-manager.service';

@Injectable({
  providedIn: 'root'
})
export class StoreAppService {

  // Inject
  // ✅ Inyecta el servicio del core
  private readonly balanceService = inject(BalanceService);
  private readonly orderManagerService = inject(OrderManagerService);

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
  public readonly paperBalance = computed(() => this.balanceService.balance()); // (el balance de paper trading)

  public readonly openOrders = computed(() => this.orderManagerService.openOrders());
  public readonly closedOrders = computed(() => this.orderManagerService.closedOrders());
  public readonly ordersHistory = computed(() => this.orderManagerService.orderHistory());

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

  // ✅ NUEVO: Método para actualizar vela en tiempo real
  updateRealtimeCandle(newCandle: Candlestick): void {
    const currentCandles = this.candles();

    if (currentCandles.length === 0) {
      this.candles.set([newCandle]);
      return;
    }

    const lastCandle = currentCandles[currentCandles.length - 1];
    const isSameTimePeriod = this.isSameCandlePeriod(lastCandle, newCandle);

    if (isSameTimePeriod) {
      // ✅ ACTUALIZAR última vela existente
      const updatedCandles = [...currentCandles];
      updatedCandles[updatedCandles.length - 1] = {
        ...lastCandle,
        high: Math.max(lastCandle.high, newCandle.high),
        low: Math.min(lastCandle.low, newCandle.low),
        close: newCandle.close
      };
      this.candles.set(updatedCandles);
    } else {
      // ✅ AGREGAR nueva vela
      this.candles.set([...currentCandles, newCandle]);
    }
  }

  // ✅ NUEVO: Determinar si es el mismo período de vela
  private isSameCandlePeriod(candle1: Candlestick, candle2: Candlestick): boolean {
    // Asumiendo velas de 5 minutos - ajusta según tu timeframe
    const time1 = Math.floor(candle1.timestamp / (5 * 60 * 1000));
    const time2 = Math.floor(candle2.timestamp / (5 * 60 * 1000));
    return time1 === time2;
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
