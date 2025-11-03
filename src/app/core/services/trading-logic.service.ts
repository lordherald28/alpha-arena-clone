// services/trading-logic.service.ts
import { inject, Inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { GlmAiGeneralService } from './ai-analysis/gml-ai-general.service';

import { ITradingService } from '../base/trading-service.interface';
import { PaperTradingService } from './paper/paper-trading.service';
import { StoreAppService } from '../store/store-app.service';
import { WSocketCoinEx } from './coinex/ws-coinex.service';
import { LIMI_OPEN_ORDERS } from '../utils/const.utils';
import { TypeMarket } from '../models';

@Injectable({ providedIn: 'root' })
export class TradingLogicService {
  private readonly paperTrading = inject(PaperTradingService);
  private readonly wSocketCoinEx = inject(WSocketCoinEx);
  private readonly storeApp = inject(StoreAppService);

  private dealsSub?: Subscription;
  private stateSub?: Subscription;
  private subscripciones: Subscription[] = [];

  public isRunning = signal<boolean>(false);
  public tradingStatus = signal({ active: false, lastOrder: null as string | null, totalTrades: 0 });

  private hb?: any;

  constructor(
    @Inject('ITradingService') private coinexService: ITradingService,
    private glmAiService: GlmAiGeneralService
  ) { }

  // 1) Arranque inicial
  public startAnalysis(): void {
    const cfg = this.storeApp.getDataMarket();
    void this.switchMarket(cfg); // reutiliza el flujo de cambio
  }

  // 2) Cambio de símbolo/intervalo
  public async switchMarket(newCfg: TypeMarket) {
    // a) corta todo lo anterior
    this.dealsSub?.unsubscribe();
    this.stateSub?.unsubscribe();

    clearInterval(this.hb);
    await this.wSocketCoinEx.disconnect();
    this.isRunning.set(false);
    this.storeApp.setIsLoadedAnalysis(false);

    // b) limpia y fija nueva config
    this.storeApp.resetForMarket(newCfg); // (método que ya te pasé: limpia candles, price, etc.)

    // c) histórico primero
    this.coinexService.getCandles(newCfg).subscribe(hist => {
      // ojo: setData antes de abrir WS
      this.storeApp.candles.set(hist);

      // d) WS nuevo y recién ahí RT
      this.wSocketCoinEx.connect(newCfg);

      this.stateSub = this.wSocketCoinEx.getMarketState$().subscribe(s => {
        const st = s?.data?.state_list?.[0];
        if (!st) return;
        const price = Number(st.mark_price ?? st.last);
        if (Number.isFinite(price)) this.storeApp.currentPrice.set(price);
        const marketInfo = s.data.state_list[0];
        this.storeApp.setMarkInfo(marketInfo);
      });

      this.dealsSub = this.wSocketCoinEx.getDeals$().subscribe(msg => {
        const list = msg?.data?.deal_list;
        if (!list?.length) return;

        const ivMs = this.intervalToMs(newCfg.interval);
        for (const t of [...list].sort((a, b) => a.created_at - b.created_at)) {
          const p = +t.price, ts = t.created_at;
          const bucket = ts - (ts % ivMs);
          this.storeApp.updateRealtimeCandle(
            { timestamp: bucket, open: p, high: p, low: p, close: p, volume: +t.amount },
            ivMs
          );
          this.storeApp.currentPrice.set(p); // TODO cuando llega la IA ver si es el precio igual al del grafico
        }
      });

      // (opcional) “latido” para rellenar velas sin trades
      // this.startBarHeartbeat(this.intervalToMs(newCfg.interval));

      this.isRunning.set(true);
      this.storeApp.setIsLoadedAnalysis(true);
    });
  }
  private intervalToMs(iv: string): number {
    const m = iv.trim().toLowerCase().match(/^(\d+)\s*([mhdw])$/);
    if (!m) return 60_000;
    const n = Number(m[1]); const u = m[2];
    return u === 'm' ? n * 60_000 : u === 'h' ? n * 3_600_000 : u === 'd' ? n * 86_400_000 : n * 604_800_000;
  }


  // public startAnalysis(): void {
  //   if (this.isRunning()) return;
  //   const cfg = this.storeApp.marketDataConfig();
  //   const ivMs = this.intervalToMs(cfg.interval);

  //   this.coinexService.getCandles(cfg).subscribe(hist => {
  //     if (!hist.length) return;
  //     this.storeApp.candles.set(hist);

  //     // --- conectar WS trades ---
  //     this.wSocketCoinEx.connect(cfg);
  //     this.wSocketCoinEx.getDeals$().subscribe(msg => {
  //       const list = msg?.data?.deal_list;
  //       if (!list?.length) return;

  //       // ordenar por tiempo
  //       const trades = [...list].sort((a, b) => a.created_at - b.created_at);

  //       for (const t of trades) {
  //         const price = +t.price;
  //         const ts = t.created_at;               // ms del servidor
  //         const bucket = ts - (ts % ivMs);       // inicio del periodo

  //         this.storeApp.currentPrice.set(price);

  //         this.storeApp.updateRealtimeCandle({
  //           timestamp: bucket,
  //           open: price, high: price, low: price, close: price,
  //           volume: +t.amount,
  //         }, ivMs); // <-- pásale el periodo
  //       }
  //       this.isRunning.set(true);
  //     });

  //     // --- latido para continuidad de velas ---
  //     this.startBarHeartbeat(ivMs);
  //   });

  //   // Obtener el market Info
  //   this.wSocketCoinEx.getMarketState$().subscribe(msg => {
  //     if (msg) {
  //       this.storeApp.MarkInfo.set(msg.data.state_list[0]);
  //       this.storeApp.currentPrice.set(+msg.data.state_list[0].mark_price || +msg.data.state_list[0].last)
  //     }
  //   });

  //   this.enableAutoTrading();
  // }

  // —— Helpers
  // private intervalToMs(iv: string): number {
  //   // parser genérico: 1m, 3m, 45m, 2h, 1d, 1w
  //   const m = iv.trim().toLowerCase().match(/^(\d+)\s*([mhdw])$/);
  //   if (!m) return 60_000;
  //   const n = Number(m[1]);
  //   switch (m[2]) {
  //     case 'm': return n * 60_000;
  //     case 'h': return n * 3_600_000;
  //     case 'd': return n * 86_400_000;
  //     case 'w': return n * 604_800_000;
  //     default: return 60_000;
  //   }
  // }

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
    this.wSocketCoinEx.disconnect();
    this.isRunning.set(false);
    this.storeApp.setIsLoadedAnalysis(false);
    this.storeApp.candles.set([]);

    // this.paperTrading.resetPaperTrading();
  }

}
