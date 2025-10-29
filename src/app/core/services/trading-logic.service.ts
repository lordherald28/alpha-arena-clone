import { Injectable, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CoinexService } from './coinex.service';
import { GlmAiService } from './glm-ai.service';
import { Candlestick, AiResponse, Order } from '../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TradingLogicService {
  // Signals para el estado reactivo
  public candles = signal<Candlestick[]>([]);
  public aiResponse = signal<AiResponse | null>(null);
  public openOrders = signal<Order[]>([]);
  public isRunning = signal<boolean>(false);
  public lastUpdate = signal<Date | null>(null);

  private analysisSubscription: Subscription | null = null;

  constructor(
    private coinexService: CoinexService,
    private glmAiService: GlmAiService
  ) { }

  public startAnalysis(): void {
    if (this.isRunning()) return;

    this.isRunning.set(true);
    console.log('Iniciando análisis de trading...');

    // Ejecutar análisis inmediatamente y luego cada intervalo
    this.runAnalysisCycle();
    this.analysisSubscription = interval(5 * 60 * 1000) // Cada 5 minutos
      .subscribe(() => this.runAnalysisCycle());
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

        // Lógica de ejecución (¡CUIDADO! Esto es un ejemplo)
        if (response.decision !== 'HOLD' && response.confidence > 0.75) {
          this.executeOrder(response.decision);
        }
      });
    });
  }

  private executeOrder(decision: 'BUY' | 'SELL'): void {
    const order = {
      market: environment.trading.pair,
      type: 'market', // Orden a mercado
      side: decision.toLowerCase(),
      amount: '0.001', // Cantidad de BTC a comprar/vender (¡ajustar!)
      price: '0' // No aplica para órdenes de mercado
    };

    console.warn(`Ejecutando orden simulada: ${decision}`);
    this.coinexService.placeOrder(order).subscribe(result => {
      console.log('Resultado de la orden:', result);
      // Aquí actualizarías el panel de órdenes
    });
  }
}