// services/trading-logic.service.ts
import { effect, inject, Inject, Injectable, signal } from '@angular/core';
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
  private aiGlmSub?: Subscription;
  // private subscripciones: Subscription[] = [];

  public isRunning = signal<boolean>(false);
  public tradingStatus = signal({ active: false, lastOrder: null as string | null, totalTrades: 0 });
  private isFirtsCallToAI = signal<boolean>(false);

  private hb?: any;
  private analysisInterval?: any;
  private readonly ANALYSIS_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

  constructor(
    @Inject('ITradingService') private coinexService: ITradingService,
    private glmAiService: GlmAiGeneralService
    // private glmAiService: OllamaAIService

  ) {
    effect(() => {
      const hasCandles = this.storeApp.candles().length > 0;
      const hasPrice = this.storeApp.currentPrice() > 0;
      const isFirstCall = this.isFirtsCallToAI();

      // ✅ ESPERAR PRECIO Y VELAS
      if (hasCandles && hasPrice && isFirstCall) {
        this.runAnalysisCycle();
        this.isFirtsCallToAI.set(false);
      }
    }, { allowSignalWrites: true })
  }

  // 1) Arranque inicial
  // public startAnalysis(): void {
  //   const cfg = this.storeApp.getDataMarket();
  //   void this.switchMarket(cfg); // reutiliza el flujo de cambio

  //   // Llamar al run por intervalo de tiempo

  //   // this.runAnalysisCycle();
  // }
  // 1. INICIAR INTERVALO
  public startAnalysis(): void {
    const cfg = this.storeApp.getDataMarket();
    void this.switchMarket(cfg);

    // Iniciar intervalo de análisis
    this.startAnalysisInterval();
  }

  // 2. CONFIGURAR INTERVALO
  private startAnalysisInterval(): void {
    // Limpiar intervalo previo
    this.stopAnalysisInterval();

    // Intervalo basado en timeframe
    const intervalMs = this.getAnalysisInterval();

    this.analysisInterval = setInterval(() => {
      this.runAnalysisCycle();
    }, intervalMs);

    console.log(`🔄 Análisis automático cada ${intervalMs / 60000} minutos`);
  }

  // 3. CALCULAR INTERVALO SEGÚN TIMEFRAME
  private getAnalysisInterval(): number {
    const marketConfig = this.storeApp.marketDataConfig();
    const tf = marketConfig.interval.toLowerCase();

    const intervals: { [key: string]: number } = {
      '1m': 30 * 60 * 1000,     // 30 min
      '5m': 2 * 60 * 60 * 1000, // 2 horas
      '15m': 3 * 60 * 60 * 1000, // 3 horas
      '1h': 4 * 60 * 60 * 1000,  // 4 horas (RECOMENDADO)
      '4h': 6 * 60 * 60 * 1000,  // 6 horas
      '1d': 12 * 60 * 60 * 1000, // 12 horas
    };

    return intervals[tf] || this.ANALYSIS_INTERVAL_MS;
  }

  // 4. DETENER INTERVALO
  private stopAnalysisInterval(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
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
      // console.log('candels 1: ', this.storeApp.candles())
      // d) WS nuevo y recién ahí RT
      this.wSocketCoinEx.connect(newCfg);

      this.stateSub = this.wSocketCoinEx.getMarketState$().subscribe(s => {

        const st = s?.data?.state_list?.[0];
        if (!st) return;
        const price = Number(st.mark_price ?? st.last);
        if (Number.isFinite(price)) this.storeApp.currentPrice.set(price);
        console.log('💶 :', this.storeApp.currentPrice())
        const marketInfo = s.data.state_list[0];
        this.storeApp.setMarkInfo(marketInfo);
        // this.storeApp.currentPrice.set(price);

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
          // this.storeApp.currentPrice.set(p);
        }
      });

      // (opcional) “latido” para rellenar velas sin trades
      // this.startBarHeartbeat(this.intervalToMs(newCfg.interval));

      this.isRunning.set(true);
      this.storeApp.setIsLoadedAnalysis(true);
      this.isFirtsCallToAI.set(true);
    });
  }

  // 5. MODIFICAR stopAnalysis
  public stopAnalysis(): void {
    if (!this.isRunning()) return;

    const m = this.storeApp.marketDataConfig();
    this.aiGlmSub?.unsubscribe();
    this.stopAnalysisInterval(); // ← NUEVA LÍNEA
    clearInterval(this.hb);
    this.wSocketCoinEx.disconnect();
    this.isRunning.set(false);
    this.storeApp.setIsLoadedAnalysis(false);
    this.storeApp.candles.set([]);
  }

  // public stopAnalysis(/* m?: TypeMarket */): void {
  //   if (!this.isRunning()) return;

  //   const m = this.storeApp.marketDataConfig();
  //   this.aiGlmSub?.unsubscribe();
  //   // this.subscripciones.forEach(s => s.unsubscribe());
  //   clearInterval(this.hb);
  //   this.wSocketCoinEx.disconnect();
  //   this.isRunning.set(false);
  //   this.storeApp.setIsLoadedAnalysis(false);
  //   this.storeApp.candles.set([]);

  //   // this.paperTrading.resetPaperTrading();
  // }
  enableAutoTrading(): void { this.paperTrading.setAutoTrading(true); }
  disableAutoTrading(): void { this.paperTrading.setAutoTrading(false); }

  // Helper canldes RT
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

  // —— Análisis con IA (sin cambios)

  private runAnalysisCycle(): void {
    const accountBalance = this.storeApp.paperBalance().USDT;
    const openPositions = this.storeApp.openOrders().length;
    if (openPositions === LIMI_OPEN_ORDERS) return;

    const typeMarket = this.storeApp.marketDataConfig();
    const currentPrice = this.storeApp.currentPrice();
    const candles = this.storeApp.candles();
    // console.log('candels 2: ', candles);

    console.log(this.storeApp.currentPrice())
    this.paperTrading.setAutoTrading(true);
    console.log('autoenebale')
    this.aiGlmSub =
      this.glmAiService.analyzeMarket(candles, accountBalance, openPositions, typeMarket)
        .subscribe(aiResponse => {
          const hist = this.storeApp.aiResponseHistory();
          this.storeApp.aiResponseHistory.set([aiResponse, ...hist]);
          if (currentPrice) this.paperTrading.processAIDecision(aiResponse, currentPrice);
        });
  }

  private intervalToMs(iv: string): number {
    const m = iv.trim().toLowerCase().match(/^(\d+)\s*([mhdw])$/);
    if (!m) return 60_000;
    const n = Number(m[1]); const u = m[2];
    return u === 'm' ? n * 60_000 : u === 'h' ? n * 3_600_000 : u === 'd' ? n * 86_400_000 : n * 604_800_000;
  }


}
