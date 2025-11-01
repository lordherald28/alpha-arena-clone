// services/trading-logic.service.ts
import { inject, Inject, Injectable, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { TradingExecutionService } from './trading-execution.service';
import { GlmAiService } from './glm-ai.service';
import { GlmAiGeneralService } from './gml-ai-general.service';
import { Candlestick, AiResponse, TypeMarket } from '../models';
import { environment } from '../../environments/environment';
import { ITradingService } from '../base/trading-service.interface';
import { PaperTradingService } from './paper-trading.service';
import { RealTimePriceService } from './real-time-price.service';
import { StoreAppService } from '../store/store-app.service';

@Injectable({
  providedIn: 'root'
})
export class TradingLogicService {

  //Inject 
  private readonly paperTrading = inject(PaperTradingService);
  private readonly realTImeService = inject(RealTimePriceService);
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
  currentPrice = this.realTImeService.currentPrice;

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
    console.log('🧠 Iniciando análisis de mercado...', this.realTImeService.isConnected() );
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
      console.log(`💰 Precio actual: ${this.currentPrice()}`);

      // 1. Primero verificar y cerrar órdenes existentes
      // this.paperTrading.checkOrders(currentPrice);

      // 2. Análisis de IA
      this.glmAiService.analyzeMarket(candles).subscribe(aiResponse => {
        this.aiResponse.set(aiResponse);
        // console.log('🧠 Decisión de IA:', aiResponse);

        // ✅ ENVIAR DECISIÓN CON PRECIO ACTUAL
        this.paperTrading.processAIDecision(aiResponse, this.currentPrice());
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
      market: environment.trading.pair,
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
    // this.realTImeService.unsubscribe();
    // this
    console.log('Análisis de trading detenido.');
  }


  // ✅ NUEVO: Método para ejecutar órdenes (USANDO EL NUEVO SERVICIO)
  private executeOrder(decision: 'BUY' | 'SELL' | 'HOLD'): void {
    const order = {
      market: environment.trading.pair,
      side: decision.toLowerCase() as 'BUY' | 'SELL',
      amount: environment.coinex.demoAmount || '0.001' // Cantidad pequeña para testing
    };

    console.log(`🎯 Ejecutando orden ${decision}:`, order);

    this.tradingExecution.placeMarketOrder(order).subscribe({
      next: () => {
        console.log(`✅ Orden ${decision} ejecutada exitosamente`);
        this.tradingStatus.update(status => ({
          ...status,
          lastOrder: `${decision} ${order.amount} ${order.market}`,
          totalTrades: status.totalTrades + 1
        }));
      },
      error: (error) => {
        console.error(`❌ Error en orden ${decision}:`, error);
      }
    });
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