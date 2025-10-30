// services/trading-logic.service.ts
import { inject, Inject, Injectable, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CoinexService } from './coinex.service';
import { TradingExecutionService } from './trading-execution.service';
import { GlmAiService } from './glm-ai.service';
import { Candlestick, AiResponse } from '../models';
import { environment } from '../../environments/environment';
import { ITradingService } from '../base/trading-service.interface';
import { PaperTradingService } from './paper-trading.service';

@Injectable({
  providedIn: 'root'
})
export class TradingLogicService {
  //Inject 
  private paperTradingService = inject(PaperTradingService); // ✅ Nuevo

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

  constructor(
    @Inject('ITradingService')
    private coinexService: ITradingService,
    private tradingExecution: TradingExecutionService, // ✅ NUEVO
    private glmAiService: GlmAiService
  ) { }

  // ✅ MANTENER métodos existentes que funcionan
  public startAnalysis(): void {
    if (this.isRunning()) return;

    this.isRunning.set(true);
    console.log('Iniciando análisis de trading...');

    // Ejecutar análisis inmediatamente y luego cada intervalo
    this.runAnalysisCyclePaper();
    this.analysisSubscription = interval(5 * 60 * 1000) // Cada 5 minutos
      .subscribe(() => this.runAnalysisCyclePaper());
  }

  public stopAnalysis(): void {
    if (!this.isRunning()) return;

    this.isRunning.set(false);
    if (this.analysisSubscription) {
      this.analysisSubscription.unsubscribe();
      this.analysisSubscription = null;
    }
    console.log('Análisis de trading detenido.');
  }

  private runAnalysisCyclePaper(): void {
    console.log('🔄 Ejecutando ciclo de análisis...');

    this.coinexService.getCandles(
      environment.trading.pair,
      environment.trading.interval,
      environment.trading.candleLimit
    ).subscribe(candles => {
      this.candles.set(candles);
      this.lastUpdate.set(new Date());

      // ✅ ACTUALIZAR PAPER TRADING con el precio actual
      const currentPrice = candles[candles.length - 1].close;
      this.paperTradingService.checkOrders(currentPrice);

      // Análisis de IA
      this.glmAiService.analyzeMarket(candles).subscribe(aiResponse => {
        this.aiResponse.set(aiResponse);

        // ✅ EJECUTAR EN PAPER TRADING en lugar de real
        if (this.shouldExecuteOrder(aiResponse)) {
          this.executePaperOrder(aiResponse.decision);
        }
      });
    });
  }

  /**
    * Ejecutar orden en Paper Trading
    */
  private executePaperOrder(decision: 'BUY' | 'SELL' | 'HOLD'): void {
    const order = {
      market: environment.trading.pair,
      side: decision.toLowerCase() as 'BUY' | 'SELL',
      amount: '0.001' // Cantidad fija para testing
    };

    console.log(`📝 Ejecutando orden PAPER: ${decision}`, order);

    this.paperTradingService.placeMarketOrder(order).subscribe({
      next: (result) => {
        console.log(`✅ Orden PAPER ${decision} ejecutada:`, result);
        this.tradingStatus.update(status => ({
          ...status,
          lastOrder: `PAPER ${decision} ${order.amount} ${order.market}`,
          totalTrades: status.totalTrades + 1
        }));
      },
      error: (error) => {
        console.error(`❌ Error en orden PAPER ${decision}:`, error);
      }
    });
  }

  private runAnalysisCycle(): void {
    console.log('Ejecutando ciclo de análisis...');
    this.coinexService.getCandles(
      environment.trading.pair,
      environment.trading.interval,
      environment.trading.candleLimit
    ).subscribe(candles => {
      this.candles.set(candles);
      this.lastUpdate.set(new Date());

      this.glmAiService.analyzeMarket(candles).subscribe(response => {
        this.aiResponse.set(response);
        console.log('Decisión de IA:', response);

        // ✅ NUEVO: Lógica de ejecución MEJORADA
        if (this.shouldExecuteOrder(response)) {
          this.executeOrder(response.decision);
        }
      });
    });
  }

  // ✅ NUEVO: Método para determinar si ejecutar orden
  private shouldExecuteOrder(aiResponse: AiResponse): boolean {
    const minConfidence = 0.75;
    const isTradingActive = this.tradingStatus().active;

    return isTradingActive &&
      aiResponse.decision !== 'HOLD' &&
      aiResponse.confidence >= minConfidence;
  }

  // ✅ NUEVO: Método para ejecutar órdenes (USANDO EL NUEVO SERVICIO)
  private executeOrder(decision: 'BUY' | 'SELL' | 'HOLD'): void {
    const order = {
      market: environment.trading.pair,
      side: decision.toLowerCase() as 'buy' | 'sell',
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
    console.log('🛑 Trading automático DETENIDO');
  }

  // ✅ NUEVO: Método para trading manual
  public placeManualOrder(side: 'buy' | 'sell', amount: string = '0.001'): void {
    const order = {
      market: environment.trading.pair,
      side: side,
      amount: amount
    };

    console.log(`👤 Orden MANUAL ${side}:`, order);

    this.tradingExecution.placeMarketOrder(order).subscribe({
      next: () => {
        console.log(`✅ Orden manual ${side} ejecutada`);
        this.tradingStatus.update(status => ({
          ...status,
          lastOrder: `MANUAL ${side} ${amount} ${order.market}`,
          totalTrades: status.totalTrades + 1
        }));
      },
      error: (error) => {
        console.error(`❌ Error en orden manual ${side}:`, error);
      }
    });
  }

  // ✅ NUEVO: Método para actualizar balance manualmente
  public refreshBalance(): void {
    this.tradingExecution.getAccountBalance().subscribe();
  }
}