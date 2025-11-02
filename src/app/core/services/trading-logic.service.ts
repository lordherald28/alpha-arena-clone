// services/trading-logic.service.ts
import { inject, Inject, Injectable, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { TradingExecutionService } from './trading-execution.service';
import { GlmAiGeneralService } from './gml-ai-general.service';
import { Candlestick, AiResponse, TypeMarket } from '../models';
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
  // public candles = signal<Candlestick[]>([]);
  // public aiResponse = signal<AiResponse | null>(null);
  public isRunning = signal<boolean>(false);
  // public lastUpdate = signal<Date | null>(null);

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
  // ✅ NUEVA PROPIEDAD para la suscripción del WebSocket
  private websocketSubscription: Subscription | null = null;

  // market = this.storeApp.getSignalMarket();
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
  public startAnalysis(market?: TypeMarket): void {
    if (this.isRunning()) return;

    // Se suscriba a wSocketCoinEx.getMarketData$() para recibir los datos en tiempo real.
    if (market) {
      this.wSocketCoinEx.connect(market);
      this.websocketSubscription = this.wSocketCoinEx.getMarketData$().subscribe(data => {
        if (data) {
          // Aquí puedes manejar los datos recibidos en tiempo real
          console.log('Datos de mercado en tiempo real:', data);
          // Por el momento es un solo symbol [0], pero mas adelante se hara un Diccionario para pasarle el key del simbolo
          this.storeApp.MarkInfo.set(data.data.state_list[0]);
          this.storeApp.currentPrice.set(+data.data.state_list[0].mark_price);
          console.log('Precio actual actualizado en storeApp: ', this.storeApp.currentPrice());
        }
      });
    }

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

  // En TradingLogicService   Estado, por el momento, solo se loguea en consola
  logTradingStatus(): void {
    console.log('🔍 Estado del trading automático:', {
      autoTrading: this.paperTrading.getAutoTradingStatus(),
      isRunning: this.isRunning(),
      openOrders: this.storeApp.openOrders().length,
      balance: this.storeApp.paperBalance()
    });
  }

  /**
   * Ciclo de análisis (SOLO análisis)
   */
  private runAnalysisCycle(/* market?: TypeMarket */): void {
    // console.log('🔄 Ejecutando ciclo de análisis...', new Date().toLocaleTimeString());

    this.coinexService.getCandles().subscribe(candles => {
      // this.candles.set(candles);
      // Me dijeron q los signal se trabajan mejor desde el store asi, no se si es verdad, pero se puede probar con encapsulamiento, metodo setCandlesData
      this.storeApp.candles.set(candles);
      // this.lastUpdate.set(new Date());

      // ✅ OBTENER PRECIO ACTUAL CORRECTAMENTE
      // const currentPrice = candles[candles.length - 1].close;
      // console.log(`💰 Precio actual: ${this.currentPrice()}`);

      // 1. Primero verificar y cerrar órdenes existentes
      // this.paperTrading.checkOrders(currentPrice);

      // 2. Análisis de IA
      this.glmAiService.analyzeMarket(candles).subscribe(aiResponse => {
        // this.aiResponse.set(aiResponse);
        // me dijeron q los signal se trabajan mejor desde el store asi, no se si es verdad, pero se puede probar con encapsulamiento, metodo setCandlesData
        let aiResponseHistory = this.storeApp.aiResponseHistory();
        aiResponseHistory.unshift(aiResponse);
        this.storeApp.aiResponseHistory.set(aiResponseHistory);

        // console.log('🧠 Decisión de IA:', aiResponse);

        // ✅ ENVIAR DECISIÓN CON PRECIO ACTUAL
        const currentPrice = this.storeApp.currentPrice();
        // Ejecutar la decisión de trading con la condicion corto circuito, dime si est bien asi?
        currentPrice && this.paperTrading.processAIDecision(aiResponse, currentPrice); // no se si guardarlo en una variblae local el tradinglogic o usar el del storeApp directamente
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

  public stopAnalysis(market?: TypeMarket): void {
    if (!this.isRunning()) return;

    // UnSubscriber
    this.websocketSubscription?.unsubscribe();
    this.websocketSubscription = null;
    this.wSocketCoinEx.disconnect(market!);
    this.isRunning.set(false);
    if (this.analysisSubscription) {
      this.analysisSubscription.unsubscribe();
      this.analysisSubscription = null;
    }

    console.log('Análisis de trading detenido.');
  }

}