// services/trading-logic.service.ts
import { inject, Inject, Injectable, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { TradingExecutionService } from './trading-execution.service';
import { GlmAiGeneralService } from './gml-ai-general.service';
import { Candlestick, AiResponse } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { PaperTradingService } from './paper-trading.service';
import { StoreAppService } from '../store/store-app.service';
import { WSocketCoinEx } from './ws-coinex.service';

@Injectable({
  providedIn: 'root'
})
export class TradingLogicService {

  //Inject 
  private readonly paperTrading = inject(PaperTradingService);
  private readonly wSocketCoinEx = inject(WSocketCoinEx);
  private readonly storeApp = inject(StoreAppService);

  // Signals para el estado reactivo (MANTENER lo que ya funciona)
  public candles = signal<Candlestick[]>([]);
  public aiResponse = signal<AiResponse | null>(null);
  public isRunning = signal<boolean>(false);
  public lastUpdate = signal<Date | null>(null);

  // ✅ NUEVO: Signal para el estado de trading
  public tradingStatus = signal<{
    active: boolean;
    lastOrder: string | null;
    totalTrades: number;
  }>({
    active: false,
    lastOrder: null,
    totalTrades: 0
  });

  private analysisSubscription: Subscription | null = null;

  market = this.storeApp.getSignalMarket();
  currentPrice = 0 /* this.wSocketCoinEx.currentPrice; */

  constructor(
    @Inject('ITradingService')
    private coinexService: ITradingService,
    private tradingExecution: TradingExecutionService, // ✅ NUEVO
    private glmAiService: GlmAiGeneralService
  ) { }

  /**
   * Iniciar análisis (SOLO análisis, NO ejecución)
   */
  public startAnalysis(/* market?: TypeMarket */): void {
    if (this.isRunning()) return;

    this.isRunning.set(true);
    // console.log('🧠 Iniciando análisis de mercado...', this.wSocketCoinEx.isConnected());
    // this.realTImeService.isConnected() === false && this.realTImeService.connect(this.market().market);

    // Ejecutar análisis inmediatamente y luego cada intervalo
    this.runAnalysisCycle(/* market */);
    // ✅ HABILITAR TRADING AUTOMÁTICO AL INICIAR
    this.enableAutoTrading();
    this.analysisSubscription = interval(5 * 60 * 1000).subscribe(() => {
      this.runAnalysisCycle();
    });
  }

  // En TradingLogicService  
  logTradingStatus(): void {
    console.log('🔍 Estado del trading automático:', {
      autoTrading: this.paperTrading.getAutoTradingStatus(),
      isRunning: this.isRunning(),
      openOrders: this.paperTrading.getPaperOrders().open.length,
      balance: this.paperTrading.getPaperBalance()
    });
  }

  /**
   * Ciclo de análisis (SOLO análisis)
   */
  private runAnalysisCycle(/* market?: TypeMarket */): void {
    // console.log('🔄 Ejecutando ciclo de análisis...', new Date().toLocaleTimeString());

    this.coinexService.getCandles().subscribe(candles => {
      this.candles.set(candles);
      this.lastUpdate.set(new Date());

      // ✅ OBTENER PRECIO ACTUAL CORRECTAMENTE
      // const currentPrice = candles[candles.length - 1].close;
      // console.log(`💰 Precio actual: ${this.currentPrice()}`);

      // 1. Primero verificar y cerrar órdenes existentes
      // this.paperTrading.checkOrders(currentPrice);

      // 2. Análisis de IA
      this.glmAiService.analyzeMarket(candles).subscribe(aiResponse => {
        this.aiResponse.set(aiResponse);
        // console.log('🧠 Decisión de IA:', aiResponse);

        // ✅ ENVIAR DECISIÓN CON PRECIO ACTUAL
        this.paperTrading.processAIDecision(aiResponse, 1000/* this.currentPrice() */);
      });
    });
  }

  /**
   * Métodos de control del trading automático
   */
  enableAutoTrading(): void {
    this.paperTrading.setAutoTrading(true);
    console.log('🚀 Trading automático ACTIVADO');
  }

  disableAutoTrading(): void {
    this.paperTrading.setAutoTrading(false);
    console.log('🛑 Trading automático DESACTIVADO');
  }

  /**
   * Orden manual (para testing)
   */
  placeManualOrder(side: 'BUY' | 'SELL', amount: string = '0.001'): void {
    const currentPrice = this.candles()[this.candles().length - 1]?.close || 50000;
    this.paperTrading.placeMarketOrder({
      market: this.market().market,
      side: side,
      amount: amount
    }).subscribe();
  }

  public stopAnalysis(): void {
    if (!this.isRunning()) return;

    this.isRunning.set(false);
    if (this.analysisSubscription) {
      this.analysisSubscription.unsubscribe();
      this.analysisSubscription = null;
    }
    // debugger
    // this.wSocketCoinEx.disconnect();
    // this
    console.log('Análisis de trading detenido.');
  }

  // ✅ NUEVO: Métodos para controlar el trading automático
  public startTrading(): void {
    this.tradingStatus.update(status => ({ ...status, active: true }));
    console.log('🚀 Trading automático ACTIVADO');

    // Cargar balance inicial
    // this.tradingExecution.getAccountBalance().subscribe();
  }

  public stopTrading(): void {
    this.tradingStatus.update(status => ({ ...status, active: false }));
    // this.realTImeService.disconnect();
    console.log('🛑 Trading automático DETENIDO');
  }



  // ✅ NUEVO: Método para actualizar balance manualmente
  public refreshBalance(): void {
    this.tradingExecution.getAccountBalance().subscribe();
  }
}