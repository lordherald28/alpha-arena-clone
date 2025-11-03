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

@Injectable({
  providedIn: 'root'
})
export class TradingLogicService {

  //Inject 
  private readonly paperTrading = inject(PaperTradingService);
  private readonly wSocketCoinEx = inject(WSocketCoinEx);
  private readonly storeApp = inject(StoreAppService);

  // Signals para el estado reactivo (MANTENER lo que ya funciona)
  public isRunning = signal<boolean>(false);

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

  private subscripciones = new Array<Subscription>();

  constructor(
    @Inject('ITradingService')
    private coinexService: ITradingService,
    private glmAiService: GlmAiGeneralService
  ) { }

  /**
   * Iniciar análisis (SOLO análisis, NO ejecución)
   */
  public startAnalysis(market?: TypeMarket): void {
    if (this.isRunning()) return;

    const marketTYpe = this.storeApp.marketDataConfig();
    if (marketTYpe) {
      // 1 Conectarme al historico CoinEx Service
      this.coinexService.getCandles(marketTYpe).subscribe((canldes) => {
        // 2 una vez recibida las velas, me conecto al socket
        if (canldes.length > 0) {
          // 3 ACtualizar el store app
          this.storeApp.candles.set(canldes);
          this.wSocketCoinEx.connect(marketTYpe);
          // 3 nos subscribimos al wSocketCoinEx
          // En TradingLogicService - MODIFICAR el WebSocket subscription
          this.wSocketCoinEx.getMarketData$().subscribe(data => {
            if (data && data.data && data.data.state_list[0]) {
              const marketData = data.data.state_list[0];

              // 1. Actualizar precio actual y la informacion del mercado
              this.storeApp.currentPrice.set(+marketData.mark_price);
              this.storeApp.MarkInfo.set(data.data.state_list[0]);
              // 2. ✅ CREAR VELA EN TIEMPO REAL
              const newCandle: Candlestick = {
                timestamp: Date.now(), // O usa el timestamp del WebSocket si está disponible
                open: +marketData.open,
                high: +marketData.high,
                low: +marketData.low,
                close: +marketData.mark_price,
                volume: +marketData.volume
              };

              // 3. ✅ ACTUALIZAR STORE CON MÉTODO DE TIEMPO REAL
              this.storeApp.updateRealtimeCandle(newCandle);

              // 4. Actualizar el isRunning a true
              this.isRunning.set(true);

              console.log('🔄 Vela actualizada en tiempo real:', newCandle);
            }
          });
        }
      })
    }
    // Ejecutar análisis inmediatamente y luego cada intervalo
    // this.runAnalysisCycle(/* market */);
    // ✅ HABILITAR TRADING AUTOMÁTICO AL INICIAR
    this.enableAutoTrading();
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

    // this.subscripciones.push(this.coinexService.getCandles(this.storeApp.marketDataConfig()).subscribe(candles => {
    // this.candles.set(candles);
    // Me dijeron q los signal se trabajan mejor desde el store asi, no se si es verdad, pero se puede probar con encapsulamiento, metodo setCandlesData
    // this.storeApp.candles.set(candles);
    // this.lastUpdate.set(new Date());

    // ✅ OBTENER PRECIO ACTUAL CORRECTAMENTE
    // const currentPrice = candles[candles.length - 1].close;
    // console.log(`💰 Precio actual: ${this.currentPrice()}`);

    // 1. Primero verificar y cerrar órdenes existentes, cerrar no, evitar limite de ordenes abiertas, asi evitamos llamar a la IA
    const accountBalance = this.storeApp.paperBalance().USDT;
    const openPositions = this.storeApp.openOrders().length;
    const typeMarket = this.storeApp.marketDataConfig();
    const currentPrice = this.storeApp.currentPrice();
    const candles = this.storeApp.candles();

    if (openPositions === LIMI_OPEN_ORDERS) return void 0;
    // this.paperTrading.checkOrders(currentPrice);

    // 2. Análisis de IA
    // return
    this.subscripciones.push(this.glmAiService.analyzeMarket(candles, accountBalance, openPositions, typeMarket).subscribe(aiResponse => {

      let aiResponseHistory = this.storeApp.aiResponseHistory();
      aiResponseHistory.unshift(aiResponse);
      this.storeApp.aiResponseHistory.set(aiResponseHistory);

      console.log('🧠 Decisión de IA:', aiResponse);

      // ✅ ENVIAR DECISIÓN CON PRECIO ACTUAL

      // Ejecutar la decisión de trading con la condicion corto circuito, dime si est bien asi?
      currentPrice && this.paperTrading.processAIDecision(aiResponse, currentPrice); // no se si guardarlo en una variblae local el tradinglogic o usar el del storeApp directamente
    }));
    // }));
  }

  /**
   * Métodos de control del trading automático
   */
  enableAutoTrading(): void {
    this.paperTrading.setAutoTrading(true);
    // console.log('🚀 Trading automático ACTIVADO');
  }

  disableAutoTrading(): void {
    this.paperTrading.setAutoTrading(false);
    console.log('🛑 Trading automático DESACTIVADO');
  }

  public stopAnalysis(market?: TypeMarket): void {
    if (!this.isRunning()) return;

    // UnSubscribers
    if (this.subscripciones.length > 0) {
      this.subscripciones.forEach((sub) => sub.unsubscribe())
    }

    this.wSocketCoinEx.disconnect(market!);
    this.isRunning.set(false);
    console.log('Análisis de trading detenido.');
  }

}