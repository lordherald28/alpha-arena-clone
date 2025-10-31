// services/paper-trading.service.ts
import { effect, inject, Injectable, OnDestroy, OnInit, Signal, signal } from '@angular/core';
import { catchError, interval, Observable, of, Subscription, switchMap } from 'rxjs';
import { TradingOrder, PaperTradingConfig, Candlestick, Balance, AiResponse } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { CoinexService } from './coinex.service';
import { environment } from '../../environments/environment';
import { ATR_MULTIPLIER_SL, ATR_MULTIPLIER_TP, DESITION, eRiskRewards, eSTATUS, MAX_ORDEN_OPEN, MINCONFIDENCE, typeRiskRewards } from '../utils/const.utils';
import { GlmAiService } from './glm-ai.service';

import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class PaperTradingService implements ITradingService, OnDestroy {

  private balance = signal<Balance>({
    USDT: environment.paperTrading.initialBalance, // Balance inicial en USDT
    BTC: 0,
    totalUSDT: environment.paperTrading.initialBalance,
    currency: '',
    available: 0,
    frozen: 0
  });

  private openOrders = signal<TradingOrder[]>([]);
  private closedOrders = signal<TradingOrder[]>([]);
  private orderHistory = signal<TradingOrder[]>([]);

  private autoTradingEnabled = signal<boolean>(false);
  private lastAIDecision = signal<{ decision: string, confidence: number } | null>(null);

  private glmService = inject(GlmAiService);
  private marketData = signal<{ market: string, interval: string, limit: number }>({
    market: environment.trading.pair,
    interval: environment.trading.interval,
    limit: 1
  });

  private $subs = new Subscription();

  private config: PaperTradingConfig = {
    initialBalance: +this.balance().USDT,
    fee: environment.paperTrading.fee,
    defaultRiskPercent: environment.paperTrading.defaultRisk // TODO ver como calcular y determinar si el riesto debe ser muy bajo por poco capital disponible
  };

  constructor(
    private readonly serviceCoinex: CoinexService
  ) {
    console.log('📊 Paper Trading iniciado con balance:', this.balance());
    console.log(`📞 Obteniendo el ultimo precio del symbol: ${this.marketData().market}`);
    this.setupAutoOrderMonitoring();
  }
  readonly currentPriceMarketSymbol = signal<number>(0);

  ngOnDestroy(): void {
    this.$subs.unsubscribe();
  }


  private setupAutoOrderMonitoring(): void {
    effect(() => {
      const currentPrice = this.currentPriceMarketSymbol();
      const openOrders = this.openOrders();

      if (currentPrice > 0 && openOrders.length > 0) {
        // Versión optimizada de checkOrders
        const ordersToClose = openOrders.filter(order =>
          (order.side === DESITION.BUY && (currentPrice >= order.tp! || currentPrice <= order.sl!)) ||
          (order.side === DESITION.SELL && (currentPrice <= order.tp! || currentPrice >= order.sl!))
        );

        if (ordersToClose.length > 0) {
          this.closeOrders(ordersToClose);
        }
      }
    });
  }

  // ✅ Método separado para monitoreo de precios
  private startPriceMonitoring(): void {
    this.$subs = interval(30000).pipe( // Cada 30 segundos
      switchMap(() => this.getCandles(this.marketData().market, this.marketData().interval, this.marketData().limit)),
      catchError(err => {
        console.error('Price monitoring error:', err);
        return of(null);
      })
    ).subscribe(candles => {
      if (candles && candles.length > 0) {
        this.currentPriceMarketSymbol.set(candles[0].close);
      }
    });
  }

  getCandles(market: string, interval: string, limit: number): Observable<Candlestick[]> {
    const candles = this.serviceCoinex.getCandles(market, interval, limit);
    //Actualiza los datos del market data
    this.marketData.set({ market, interval, limit });
    return candles;
  }

  /**
   * Obtener balance simulado
   */
  getAccountBalance(): Observable<any[]> {
    const balance = this.balance();
    return of([
      {
        currency: 'USDT',
        available: balance.USDT.toFixed(8),
        initialBalance: environment.paperTrading.initialBalance,
        totalUSDT: balance.totalUSDT.toFixed(8),
        frozen: '0'
      },
      {
        currency: 'BTC',
        available: balance.BTC.toFixed(8),
        frozen: '0'
      }
    ]);
  }

  /**
   * Colocar orden de mercado simulada
   */
  placeMarketOrder(params: { market: string; side: 'BUY' | 'SELL' | 'HOLD'; amount: string; }): Observable<any> {
    return new Observable(observer => {
      try {
        const currentPrice = this.getCurrentMarketPrice();
        const amount = parseFloat(params.amount);

        const order: TradingOrder = {
          id: `paper_${Date.now()}`,
          market: params.market,
          side: params.side,
          type: 'market',
          amount: amount,
          price: currentPrice,
          timestamp: Date.now(),
          status: 'filled'
        };

        // ✅ ACTUALIZADO: Usar ATR para TP/SL (si está disponible)
        const atr = this.getCurrentATR(); // Necesitarás implementar esto
        const { tp, sl } = atr ?
          this.calculateTPnSLByATR(params.side, currentPrice, atr) :
          this.calculateTPnSLByPercent(params.side, currentPrice);

        order.tp = tp;
        order.sl = sl;

        this.executeOrder(order);

        console.log('📝 Orden PAPER ejecutada:', order);

        observer.next({
          code: 0,
          data: {
            order_id: order.id,
            status: 'filled',
            message: 'Orden de paper trading ejecutada'
          }
        });
        observer.complete();

      } catch (error) {
        observer.error({
          code: -1,
          message: `Error en paper trading: ${error}`
        });
      }
    });
  }

  /**
   * ✅ NUEVO: Calcular TP/SL basado en ATR (Estrategia crypto)
   */
  private calculateTPnSLByATR(side: 'BUY' | 'SELL' | 'HOLD', entryPrice: number, atr: number): { tp: number, sl: number } {
    const atrMultiplierSL = ATR_MULTIPLIER_SL;   // 1.5 x ATR para SL
    const atrMultiplierTP = ATR_MULTIPLIER_TP;  // 2.25 x ATR para TP

    if (side === DESITION.BUY) {
      return {
        sl: entryPrice - (atr * atrMultiplierSL),
        tp: entryPrice + (atr * atrMultiplierTP)
      };
    } else {
      return {
        sl: entryPrice + (atr * atrMultiplierSL),
        tp: entryPrice - (atr * atrMultiplierTP)
      };
    }
  }

  /**
   * ✅ MANTENIDO: Calcular TP/SL por porcentaje (como fallback)
   */
  private calculateTPnSLByPercent(side: 'BUY' | 'SELL' | 'HOLD', entryPrice: number): { tp: number, sl: number } {
    const riskRewardRatio = 2;

    if (side === DESITION.BUY) {
      const sl = entryPrice * (1 - this.config.defaultRiskPercent);
      const tp = entryPrice * (1 + (this.config.defaultRiskPercent * riskRewardRatio));
      return { tp, sl };
    } else {
      const sl = entryPrice * (1 + this.config.defaultRiskPercent);
      const tp = entryPrice * (1 - (this.config.defaultRiskPercent * riskRewardRatio));
      return { tp, sl };
    }
  }

  /**
   * Ejecutar orden y actualizar balance // TODO deuda tecnica en trading calculo de operaciones en real.
   */
  private executeOrder(order: TradingOrder): void {
    const fee = order.amount * order.price * this.config.fee;

    if (order.side === DESITION.BUY) {
      const cost = order.amount * order.price + fee; // el costo de la operacion

      if (+this.balance().available >= cost) {
        this.balance.update(bal => ({
          ...bal,
          USDT: bal.USDT - cost,
          available: bal.available - cost, // No entiendo, esto no se deberia actualizar, seria el aviable y restar.
          // BTC: bal.BTC + order.amount,
          // totalUSDT: this.calculateTotalValue(bal.USDT - cost, bal.BTC + order.amount, order.price)
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ COMPRA ejecutada: ${order.price} por ${cost} USDT`);
      } else {
        throw new Error(`Saldo insuficiente: ${this.balance().USDT} $USDT < ${cost} $USDT`);
      }

    } else if (order.side === DESITION.SELL) {
      // const revenue = order.amount * order.price - fee;
      const cost: number = order.amount * order.price + fee; // el costo de la operacion
      if (+this.balance().available >= order.amount) {
        this.balance.update(bal => ({
          ...bal,
          available: bal.available - cost, // No entiendo, esto no se deberia actualizar, seria el aviable y restar.
          // BTC: bal.BTC - order.amount,
          // totalUSDT: this.calculateTotalValue(bal.USDT + cost, bal.BTC - order.amount, order.price)
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ VENTA ejecutada: ${order.price} por ${cost} $USDT`);
      } else {
        throw new Error(`BTC insuficiente: ${this.balance().BTC} BTC < ${order.amount} BTC`);
      }
    }
  }

  /**
   * Verificar órdenes abiertas contra el precio actual
   */
  // checkOrders(currentPrice: number): void {
  //   const openOrders = this.openOrders();
  //   const ordersToClose: TradingOrder[] = [];

  //   openOrders.forEach(order => {
  //     let closeReason: typeRiskRewards = null;

  //     if (order.side === DESITION.BUY) {
  //       if (order.tp && currentPrice >= order.tp) {
  //         closeReason = eRiskRewards.TP;
  //       } else if (order.sl && currentPrice <= order.sl) {
  //         closeReason = eRiskRewards.SL;
  //       }
  //     } else {
  //       if (order.tp && currentPrice <= order.tp) {
  //         closeReason = eRiskRewards.TP;
  //       } else if (order.sl && currentPrice >= order.sl) {
  //         closeReason = eRiskRewards.SL;
  //       }
  //     }

  //     if (closeReason) {
  //       order.status = 'closed';
  //       order.closePrice = currentPrice;
  //       order.closeReason = closeReason;
  //       order.pnl = this.calculatePNL(order);
  //       ordersToClose.push(order);
  //     }
  //   });

  //   if (ordersToClose.length > 0) {
  //     this.closeOrders(ordersToClose);
  //   }
  // }

  /**
   * Calcular P&L de una orden
   */
  private calculatePNL(order: TradingOrder): number {
    if (!order.closePrice) return 0;

    if (order.side === 'BUY') {
      return (order.closePrice - order.price) * order.amount;
    } else {
      return (order.price - order.closePrice) * order.amount;
    }
  }

  /**
   * Cerrar órdenes y actualizar historial
   */
  private closeOrders(orders: TradingOrder[]): void {
    this.openOrders.update(openOrders =>
      openOrders.filter(order => !orders.find(o => o.id === order.id))
    );

    this.closedOrders.update(closedOrders => [...closedOrders, ...orders]);
    this.orderHistory.update(history => [...history, ...orders]);

    orders.forEach(order => {
      const result = order.closeReason === 'tp' ? '✅ TP' : '❌ SL';
      const pnl = order.pnl || 0;
      console.log(`${result} - Orden ${order.side.toUpperCase()} cerrada: $${pnl.toFixed(2)} PNL`);
    });
  }

  /**
   * Obtener órdenes abiertas
   */
  getOpenOrders(market: string): Observable<any[]> {
    const orders = this.openOrders().filter(order => order.market === market);
    return of(orders.map(order => ({
      order_id: order.id,
      market: order.market,
      side: order.side,
      type: order.type,
      amount: order.amount.toString(),
      price: order.price.toString(),
      status: order.status
    })));
  }

  /**
   * Obtener precio de mercado actual
   */
  private getCurrentMarketPrice(): number {
    // TODO: Implementar con signal real
    return this.currentPriceMarketSymbol();
  }

  /**
   * ✅ NUEVO: Obtener ATR actual (necesitas implementar esto)
   */
  private getCurrentATR(): number | 0 {
    // TODO: Implementar obtención de ATR actual
    // Por ahora retornar null para usar fallback
    return this.glmService.currentAtr();
  }

  /**
   * Calcular valor total en USDT
   */
  private calculateTotalValue(usdt: number, btc: number, btcPrice: number): number {
    return usdt + (btc * btcPrice);
  }

  /**
   * Métodos adicionales para control
   */
  getPaperBalance(): Balance {
    return this.balance();
  }

  getPaperOrders(): { open: TradingOrder[], closed: TradingOrder[] } {
    return {
      open: this.openOrders(),
      closed: this.closedOrders()
    };
  }

  resetPaperTrading(initialBalance: number = environment.paperTrading.initialBalance): void {
    this.balance.set({
      USDT: initialBalance,
      BTC: 0,
      totalUSDT: initialBalance,
      currency: '',
      available: 0,
      frozen: 0
    });
    this.openOrders.set([]);
    this.closedOrders.set([]);
    console.log('🔄 Paper Trading reiniciado');
  }

  getAutoTradingStatus(): boolean {
    return this.autoTradingEnabled();
  }

  /**
   * Habilitar/deshabilitar trading automático
   */
  setAutoTrading(enabled: boolean): void {
    this.autoTradingEnabled.set(enabled);
    console.log(`🤖 Trading automático: ${enabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
  }

  /**
   * ✅ ACTUALIZADO: Recibir decisión de la IA con ATR
   */
  processAIDecision(
    aiResponse: {
      decision: 'BUY' | 'SELL' | 'HOLD',
      confidence: number,
      reason: string
    },
    currentPrice: number,
    atr?: number  // ✅ Parámetro ATR opcional
  ): void {
    console.log(`🤖 Procesando decisión de IA:`, {
      decision: aiResponse.decision,
      confidence: aiResponse.confidence,
      atr: atr,
      autoTradingEnabled: this.autoTradingEnabled(),
      currentPrice: currentPrice
    });

    this.lastAIDecision.set({ decision: aiResponse.decision, confidence: aiResponse.confidence });

    if (this.autoTradingEnabled()) {
      console.log(`🔍 Evaluando condiciones para ${aiResponse.decision}...`);

      if (this.shouldExecuteOrder(aiResponse, currentPrice, atr)) {
        console.log(`🚀 Ejecutando orden automática: ${aiResponse.decision}`);
        this.executeAutoOrder(aiResponse.decision, currentPrice, atr);
      } else {
        console.log(`⏸️ Orden no ejecutada: condiciones no cumplidas`);
      }
    } else {
      console.log('❌ Trading automático DESHABILITADO - no se ejecuta orden');
    }
  }

  /**
   * ✅ ACTUALIZADO: Lógica para ejecutar orden automática con ATR
   */
  private executeAutoOrder(
    decision: 'BUY' | 'SELL' | 'HOLD',
    currentPrice: number,
    atr?: number
  ): void {
    const orderConfig = this.calculateAutoOrderSize(decision, currentPrice);

    if (orderConfig.amount > 0) {
      const order: TradingOrder = {
        id: `auto_${Date.now()}`,
        market: environment.trading.pair,
        side: decision, // es decir, me voy en largo o me voy corto.
        type: 'market',
        amount: orderConfig.amount,
        price: currentPrice,
        timestamp: Date.now(),
        status: eSTATUS.FILLED
      };

      // ✅ USAR ATR SI ESTÁ DISPONIBLE, SINO PORCENTAJE
      const { tp, sl } = atr ?
        this.calculateTPnSLByATR(decision, currentPrice, atr) :
        this.calculateTPnSLByPercent(decision, currentPrice);

      order.tp = tp;
      order.sl = sl;

      this.executeOrder(order);

      console.log(`🤖 ORDEN AUTOMÁTICA ${decision} ejecutada:`, {
        amount: order.amount,
        price: order.price,
        tp: order.tp,
        sl: order.sl,
        atr: atr,
        method: atr ? 'ATR-based' : 'Percent-based'
      });
    }
  }

  /**
   * Calcular tamaño de orden automática basado en balance y riesgo // TODO ver esto para que y hacerlo mas simple
   */
  private calculateAutoOrderSize(decision: 'BUY' | 'SELL' | 'HOLD', currentPrice: number): { amount: number } {
    const balance = this.balance();
    const riskPercent = this.config.defaultRiskPercent ?? environment.paperTrading.defaultRisk; // 2% del balance por operación

    if (decision === DESITION.BUY || DESITION.SELL) {
      const maxInvestment = +balance.available * riskPercent; // TODO REVISAR PARA PROPUESTA EN REAL disponibilidad * %riesgo (10usdt * 0.02)
      // const amount = maxInvestment / currentPrice;
      const amount = maxInvestment;
      return { amount: this.roundAmount(amount) };
    } /* else if (decision === 'SELL') {
      const maxSale = balance.BTC * riskPercent;
      return { amount: this.roundAmount(maxSale) };
    } */

    return { amount: 0 };
  }

  /**
   * Redondear cantidad a decimales válidos
   */
  private roundAmount(amount: number): number {
    return Math.floor(amount * 1000000) / 1000000;
  }

  /**
   * ✅ ACTUALIZADO: Verificar si se debe ejecutar la orden con validación de ATR
   */
  private shouldExecuteOrder(
    aiResponse: { decision: 'BUY' | 'SELL' | 'HOLD', confidence: number },
    currentPrice: number,
    atr?: number
  ): boolean {
    const minConfidence = MINCONFIDENCE; // ✅ REDUCIDO a 0.7 según nuevo prompt

    if (aiResponse.decision === 'HOLD' || aiResponse.confidence < minConfidence) {
      console.log(`⏸️ No ejecutar: ${aiResponse.decision} con confianza ${aiResponse.confidence}`);
      return false;
    }

    // ✅ NUEVO: Validar volatilidad extrema (ATR > 4% del precio)
    if (atr && atr > currentPrice * 0.04) {
      console.log(`⚠️ Volatilidad extrema (ATR ${atr} > 4% del precio) - No operar`);
      return false;
    }

    // No ejecutar si ya hay muchas órdenes abiertas
    if (this.openOrders().length >= MAX_ORDEN_OPEN) {
      console.log('⚠️ Máximo de órdenes abiertas alcanzado, no se puede ejecutar la operacion.');
      return false;
    }

    // Verificar balance suficiente // TODO verificar cual si usar el balance aviable como disponible y cual de ellos se va a actualizar.
    const balance = this.balance();
    if (+balance.available < 1) {
      console.log(`⚠️ Balance USDT insuficiente para realizar la operacion: ${balance.available} $USDT`); // TODO hacer una notificacion y mostrar mensaje en panel
      return false; // Si tienes menor que 1 USDT no se procede a realizar la operacion (BUY | SELL)
    }

    // if (aiResponse.decision === 'BUY') {
    //   console.log('⚠️ Balance USDT insuficiente para compra');
    //   return false;
    // }

    // if (aiResponse.decision === 'SELL' && balance.BTC <= 0) {
    //   console.log('⚠️ Balance BTC insuficiente para venta');
    //   return false;
    // }

    console.log(`✅ Condiciones cumplidas para ejecutar ${aiResponse.decision}`);
    return true;
  }
}