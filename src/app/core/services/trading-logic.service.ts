// services/trading-logic.service.ts
import { inject, Inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { GlmAiGeneralService } from './ai-analysis/gml-ai-general.service';
import { Candlestick, TypeMarket } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { PaperTradingService } from './paper/paper-trading.service';
import { StoreAppService } from '../store/store-app.service';
import { WSocketCoinEx } from './coinex/ws-coinex.service';
import { LIMI_OPEN_ORDERS } from '../utils/const.utils';

@Injectable({ providedIn: 'root' })
export class TradingLogicService {
  private readonly paperTrading = inject(PaperTradingService);
  private readonly wSocketCoinEx = inject(WSocketCoinEx);
  private readonly storeApp = inject(StoreAppService);
  private hb?: any;

  public isRunning = signal<boolean>(false);
  public tradingStatus = signal({ active: false, lastOrder: null as string | null, totalTrades: 0 });

  private subscripciones: Subscription[] = [];

  constructor(
    @Inject('ITradingService') private coinexService: ITradingService,
    private glmAiService: GlmAiGeneralService
  ) { }

  public startAnalysis(): void {
    if (this.isRunning()) return;
    const cfg = this.storeApp.marketDataConfig();
    const ivMs = this.intervalToMs(cfg.interval);

    this.coinexService.getCandles(cfg).subscribe(hist => {
      if (!hist.length) return;
      this.storeApp.candles.set(hist);

      // --- conectar WS trades ---
      this.wSocketCoinEx.connect(cfg);
      this.wSocketCoinEx.getDeals$().subscribe(msg => {
        const list = msg?.data?.deal_list;
        if (!list?.length) return;

        // ordenar por tiempo
        const trades = [...list].sort((a, b) => a.created_at - b.created_at);

        for (const t of trades) {
          const price = +t.price;
          const ts = t.created_at;               // ms del servidor
          const bucket = ts - (ts % ivMs);       // inicio del periodo

          this.storeApp.currentPrice.set(price);

          this.storeApp.updateRealtimeCandle({
            timestamp: bucket,
            open: price, high: price, low: price, close: price,
            volume: +t.amount,
          }, ivMs); // <-- pásale el periodo
        }
        this.isRunning.set(true);
      });

      // --- latido para continuidad de velas ---
      this.startBarHeartbeat(ivMs);
    });

    // Obtener el market Info
    this.wSocketCoinEx.getMarketState$().subscribe(msg => {
      if (msg) {
        this.storeApp.MarkInfo.set(msg.data.state_list[0])
      }
    });

    this.enableAutoTrading();
  }

  // —— Helpers
  private intervalToMs(iv: string): number {
    // parser genérico: 1m, 3m, 45m, 2h, 1d, 1w
    const m = iv.trim().toLowerCase().match(/^(\d+)\s*([mhdw])$/);
    if (!m) return 60_000;
    const n = Number(m[1]);
    switch (m[2]) {
      case 'm': return n * 60_000;
      case 'h': return n * 3_600_000;
      case 'd': return n * 86_400_000;
      case 'w': return n * 604_800_000;
      default: return 60_000;
    }
  }

  // —— Análisis con IA (sin cambios)
  private runAnalysisCycle(): void {
    const accountBalance = this.storeApp.paperBalance().USDT;
    const openPositions = this.storeApp.openOrders().length;
    if (openPositions === LIMI_OPEN_ORDERS) return;

    const typeMarket = this.storeApp.marketDataConfig();
    const currentPrice = this.storeApp.currentPrice();
    const candles = this.storeApp.candles();

    this.subscripciones.push(
      this.glmAiService.analyzeMarket(candles, accountBalance, openPositions, typeMarket)
        .subscribe(aiResponse => {
          const hist = this.storeApp.aiResponseHistory();
          this.storeApp.aiResponseHistory.set([aiResponse, ...hist]);
          if (currentPrice) this.paperTrading.processAIDecision(aiResponse, currentPrice);
        })
    );
  }

  enableAutoTrading(): void { this.paperTrading.setAutoTrading(true); }
  disableAutoTrading(): void { this.paperTrading.setAutoTrading(false); }

  private startBarHeartbeat(ivMs: number) {
    clearInterval(this.hb);
    this.hb = setInterval(() => {
      const arr = this.storeApp.candles();
      if (!arr.length) return;

      const last = arr[arr.length - 1];
      const now = Date.now();                        // o usa server.time si quieres precisión
      const lastBucket = Math.floor(last.timestamp / ivMs);
      const nowBucket = Math.floor(now / ivMs);

      // si cruzamos a uno o más buckets sin trades, crea velas "vacías"
      for (let b = lastBucket + 1; b <= nowBucket; b++) {
        const ts = b * ivMs;
        const px = last.close;
        this.storeApp.updateRealtimeCandle({
          timestamp: ts,
          open: px, high: px, low: px, close: px,
          volume: 0
        }, ivMs);
      }
    }, 1000);
  }

  public stopAnalysis(/* m?: TypeMarket */): void {
    const m = this.storeApp.marketDataConfig();
    if (!this.isRunning()) return;
    this.subscripciones.forEach(s => s.unsubscribe());
    clearInterval(this.hb);
    this.wSocketCoinEx.disconnect(m!);
    this.isRunning.set(false);
  }

}
