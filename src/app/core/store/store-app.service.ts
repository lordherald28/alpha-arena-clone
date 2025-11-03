// src/app/core/store/store-app.service.ts
import { Injectable, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { AiResponse, Candlestick, Market, TypeMarket } from '../models';
import { environment } from '../../environments/environment';
import { BalanceService } from '../services/helpers/trading/balance.service';
import { OrderManagerService } from '../services/helpers/trading/order-manager.service';
import { KEY_MARKET_CONFIG_DATA } from '../utils/const.utils';

@Injectable({ providedIn: 'root' })
export class StoreAppService {

  // Servicios de dominio
  private readonly balanceService = inject(BalanceService);
  private readonly orderManagerService = inject(OrderManagerService);

  // Config del mercado
  public readonly marketDataConfig = signal<TypeMarket>({
    interval: environment.trading.interval,
    market: environment.trading.pair,
    limit: environment.trading.candleLimit
  });

  public readonly MarkInfo = signal<Market | null>(null);

  // Estado principal
  public readonly candles = signal<Candlestick[]>([]);
  public readonly currentPrice = signal<number>(0);
  public readonly paperBalance = computed(() => this.balanceService.balance());

  public readonly openOrders = computed(() => this.orderManagerService.openOrders());
  public readonly closedOrders = computed(() => this.orderManagerService.closedOrders());
  public readonly ordersHistory = computed(() => this.orderManagerService.orderHistory());

  public readonly aiResponseHistory = signal<AiResponse[]>([]);
  public readonly isLoading = signal<boolean>(false);

  constructor() {
    this.loadDataMarket();
    this.saveDataMarket();
  }

  // ---- Getters/Setters básicos ----
  getDataMarket(): TypeMarket { return this.marketDataConfig(); }
  getSignalMarket() { return this.marketDataConfig; }
  getMarkInfo(): WritableSignal<Market | null> { return this.MarkInfo; }
  setMarkInfo(m: Market): void { this.MarkInfo.set(m); }
  setDataMarket(m: TypeMarket): void { this.marketDataConfig.set(m); }

  // ---- Tiempo real: agrega/actualiza sin romper el orden ----
  updateRealtimeCandle(bar: Candlestick, ivMs?: number): void {
    const period = ivMs ?? this.intervalToMs(this.marketDataConfig().interval);
    const arr = this.candles();
    if (!arr.length) { this.candles.set([bar]); return; }

    const last = arr[arr.length - 1];
    const sameBucket =
      Math.floor(last.timestamp / period) === Math.floor(bar.timestamp / period);

    if (sameBucket) {
      const up = {
        ...last,
        high: Math.max(last.high, bar.high),
        low: Math.min(last.low, bar.low),
        close: bar.close,
        volume: (last.volume ?? 0) + (bar.volume ?? 0),
      };
      const copy = [...arr]; copy[copy.length - 1] = up;
      this.candles.set(copy);
      return;
    }

    // evita desorden: ignora buckets viejos
    if (bar.timestamp <= last.timestamp) return;

    this.candles.set([...arr, bar]);
  }
  // ---- Utilidades ----
  isSameCandlePeriod(a: Candlestick, b: Candlestick): boolean {
    const bucket = this.intervalToMs(this.marketDataConfig().interval);
    return Math.floor(a.timestamp / bucket) === Math.floor(b.timestamp / bucket);
  }

  updateRealtimeCandlePadded(newCandle: Candlestick, ivMs: number): void {
    const arr = this.candles();
    if (arr.length === 0) { this.candles.set([newCandle]); return; }

    const last = arr[arr.length - 1];

    // mismo bucket → merge
    if (newCandle.timestamp === last.timestamp) {
      const up = {
        ...last,
        high: Math.max(last.high, newCandle.high),
        low: Math.min(last.low, newCandle.low),
        close: newCandle.close,
        volume: (last.volume ?? 0) + (newCandle.volume ?? 0)
      };
      const copy = [...arr]; copy[copy.length - 1] = up;
      this.candles.set(copy);
      return;
    }

    // si el trade cae en un bucket posterior → rellena buckets vacíos
    if (newCandle.timestamp > last.timestamp) {
      const copy = [...arr];
      let t = last.timestamp + ivMs;
      while (t < newCandle.timestamp) {
        const c = last.close;
        copy.push({ timestamp: t, open: c, high: c, low: c, close: c, volume: 0 });
        t += ivMs;
      }
      copy.push(newCandle);
      this.candles.set(copy);
    }
    // si viene atrasado, lo ignoras para no romper el orden asc.
  }

  private normalizeCandle(c: Candlestick): Candlestick {
    // asegura OHLC coherente si viene solo con precio
    const open = c.open ?? c.close;
    const close = c.close ?? open;
    const high = c.high ?? Math.max(open, close);
    const low = c.low ?? Math.min(open, close);
    const volume = c.volume ?? 0;
    return { timestamp: c.timestamp, open, high, low, close, volume };
  }

  private alignToBucket(tsMs: number, bucketMs: number): number {
    return tsMs - (tsMs % bucketMs);
  }

  private intervalToMs(iv: string): number {
    const m: Record<string, number> = {
      '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000,
      '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    };
    return m[iv] ?? 60_000;
  }

  // ---- Persistencia de config ----
  private loadDataMarket(): void {
    const raw = localStorage.getItem(KEY_MARKET_CONFIG_DATA);
    if (raw) {
      try { this.marketDataConfig.set(JSON.parse(raw)); } catch { }
    }
  }

  private saveDataMarket(): void {
    effect(() => {
      localStorage.setItem(KEY_MARKET_CONFIG_DATA, JSON.stringify(this.marketDataConfig()));
    });
  }
}
