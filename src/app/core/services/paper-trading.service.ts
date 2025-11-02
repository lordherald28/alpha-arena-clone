// services/paper-trading.service.ts
import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { catchError, interval, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { TradingOrder, PaperTradingConfig, Candlestick, Balance, TypeMarket } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { CoinexService } from './coinex.service';
import { environment } from '../../environments/environment';
import { ATR_MULTIPLIER_SL, ATR_MULTIPLIER_TP, DESITION, eSTATUS, MAX_ORDEN_OPEN, MINCONFIDENCE } from '../utils/const.utils';

import { ATR } from 'technicalindicators';
import { StoreAppService } from '../store/store-app.service';

import { RealTimePriceService } from './real-time-price.service';
@Injectable({
  providedIn: 'root'
})
export class PaperTradingService implements ITradingService, OnDestroy {

  public balance = signal<Balance>({
    USDT: environment.paperTrading.initialBalance, // Balance inicial en USDT
    BTC: 0,
    totalUSDT: environment.paperTrading.initialBalance,
    currency: '',
    available: environment.paperTrading.initialBalance,
    frozen: 0
  });

  public openOrders = signal<TradingOrder[]>([]);
  private closedOrders = signal<TradingOrder[]>([]);
  private orderHistory = signal<TradingOrder[]>([]);

  private autoTradingEnabled = signal<boolean>(false);
  private lastAIDecision = signal<{ decision: string, confidence: number } | null>(null);

  private $subs = new Subscription();

  private $candles = signal<Candlestick[]>([]);
  private $currentAtr = signal<number>(0);

  private config: PaperTradingConfig = {
    initialBalance: +this.balance().USDT,
    fee: environment.paperTrading.fee,
    defaultRiskPercent: environment.paperTrading.defaultRisk // TODO ver como calcular y determinar si el riesto debe ser muy bajo por poco capital disponible
  };

  // inject
  private readonly storeAppService = inject(StoreAppService);
  private readonly realTimePriceService = inject(RealTimePriceService);

  constructor(
    private readonly serviceCoinex: CoinexService,
  ) {
    this.setupAutoOrderMonitoring();

    // ✅ NUEVO: Efecto para actualizar el balance total con el P&L en tiempo real
    this.updateBalanceUser();
  }
  readonly currentPriceMarketSymbol = this.realTimePriceService.currentPrice;

  private updateBalanceUser() {
    effect(() => {
      const openOrders = this.openOrders();
      const currentPrice = this.currentPriceMarketSymbol();

      if (openOrders.length > 0 && currentPrice) {
        const totalPNL = openOrders.reduce((sum, order) => {
          let pnl = 0;
          if (order.side === DESITION.BUY) {
            pnl = (currentPrice - order.price) * order.amount;
          } else {
            pnl = (order.price - currentPrice) * order.amount;
          }
          return sum + pnl;
        }, 0);

        // Actualizar el totalUSDT con el P&L acumulado
        this.balance.update(bal => ({
          ...bal,
          totalUSDT: bal.USDT + totalPNL
        }));
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void {
    this.$subs.unsubscribe();
  }

  private setupAutoOrderMonitoring(): void {
    effect(() => {
      const currentPrice = this.currentPriceMarketSymbol();
      const openOrders = this.openOrders();

      if (currentPrice > 0 && openOrders.length > 0) {
        // Versión optimizada de checkOrders
        const ordersToClose = openOrders.filter(order => {
          (order.side === DESITION.BUY && (currentPrice >= order.tp! || currentPrice <= order.sl!)) ||
            (order.side === DESITION.SELL && (currentPrice <= order.tp! || currentPrice >= order.sl!))
        });
        if (ordersToClose.length > 0) {
          this.closeOrders(ordersToClose);
        }
      }
    }, { allowSignalWrites: true });
  }

  // ✅ Método separado para monitoreo de precios
  private startPriceMonitoring(): void {
    this.$subs = interval(30000).pipe( // Cada 30 segundos
      switchMap(() => this.getCandles()),
      tap(response => this.$candles.set(response)),
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

  getCandles(): Observable<Candlestick[]> {
    const candles = this.serviceCoinex.getCandles();
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

  // En PaperTradingService - método mejorado
  placeMarketOrder(params: { market: string; side: 'BUY' | 'SELL' | 'HOLD'; amount: string; }): Observable<any> {
    return new Observable(observer => {
      try {
        const currentPrice = this.getCurrentMarketPrice();
        const amount = parseFloat(params.amount);
        debugger
        const order: TradingOrder = {
          id: `paper_${Date.now()}`,
          market: this.realTimePriceService.marketData().market,
          side: params.side,
          type: 'market',
          amount: amount,
          price: currentPrice,
          timestamp: Date.now(),
          status: 'filled'
        };

        // Calcular TP/SL
        const atr = this.$currentAtr();
        // const { tp, sl } = atr ?
        //   this.calculateTPnSLByATR(params.side, currentPrice, atr) :
        const { tp, sl } = this.calculateTPnSLByPercent(params.side, currentPrice);

        order.tp = tp;
        order.sl = sl;

        // ✅ MEJOR LOGGING
        console.log('🎯 ORDEN CREADA - TP/SL ajustados para crypto:', {
          marketCurrent: this.realTimePriceService.marketData().market,
          market: params.market,
          side: params.side,
          entry: currentPrice,
          tp: order.tp,
          sl: order.sl,
          distanceTP: ((order.tp - currentPrice) / currentPrice * 100).toFixed(2) + '%',
          distanceSL: ((currentPrice - order.sl) / currentPrice * 100).toFixed(2) + '%',
          method: atr ? 'ATR-based' : 'Percent-based'
        });

        this.executeOrder(order);

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

  // En PaperTradingService - método corregido
  /**
   * ✅ CORREGIDO: Calcular TP/SL basado en ATR - AJUSTADO PARA CRYPTO
   */
  private calculateTPnSLByATR(side: 'BUY' | 'SELL' | 'HOLD', entryPrice: number, atr: number): { tp: number, sl: number } {
    // ✅ USAR LAS NUEVAS CONSTANTES MÁS PEQUEÑAS
    const atrMultiplierSL = ATR_MULTIPLIER_SL;   // 0.5 x ATR para SL
    const atrMultiplierTP = ATR_MULTIPLIER_TP;   // 1.0 x ATR para TP

    console.log('🎯 Calculando TP/SL con ATR para crypto:', {
      entryPrice,
      atr,
      atrPercent: ((atr / entryPrice) * 100).toFixed(2) + '%',
      slMultiplier: atrMultiplierSL,
      tpMultiplier: atrMultiplierTP
    });

    if (side === DESITION.BUY) {
      const sl = entryPrice - (atr * atrMultiplierSL);
      const tp = entryPrice + (atr * atrMultiplierTP);

      console.log(`📈 LONG ATR: Entrada $${entryPrice}, SL $${sl.toFixed(2)}, TP $${tp.toFixed(2)}`);

      return { tp, sl };
    } else {
      const sl = entryPrice + (atr * atrMultiplierSL);
      const tp = entryPrice - (atr * atrMultiplierTP);

      console.log(`📉 SHORT ATR: Entrada $${entryPrice}, SL $${sl.toFixed(2)}, TP $${tp.toFixed(2)}`);

      return { tp, sl };
    }
  }

  // En PaperTradingService - método corregido
  /**
   * ✅ CORREGIDO: Calcular TP/SL por porcentaje - AJUSTADO PARA CRYPTO
   */
  private calculateTPnSLByPercent(side: 'BUY' | 'SELL' | 'HOLD', entryPrice: number): { tp: number, sl: number } {
    const riskPercent = this.config.defaultRiskPercent; // Ahora 0.5% en lugar de 2%
    const riskRewardRatio = 1.5; // Mantener 1.5:1

    console.log('🎯 Calculando TP/SL para crypto:', {
      entryPrice,
      riskPercent: (riskPercent * 100) + '%',
      riskRewardRatio
    });

    if (side === DESITION.BUY) {
      const sl = entryPrice * (1 - riskPercent);
      const tp = entryPrice * (1 + (riskPercent * riskRewardRatio));

      console.log(`📈 LONG: Entrada $${entryPrice}, SL $${sl.toFixed(2)} (${((entryPrice - sl) / entryPrice * 100).toFixed(2)}%), TP $${tp.toFixed(2)} (${((tp - entryPrice) / entryPrice * 100).toFixed(2)}%)`);

      return { tp, sl };
    } else {
      const sl = entryPrice * (1 + riskPercent);
      const tp = entryPrice * (1 - (riskPercent * riskRewardRatio));

      console.log(`📉 SHORT: Entrada $${entryPrice}, SL $${sl.toFixed(2)} (${((sl - entryPrice) / entryPrice * 100).toFixed(2)}%), TP $${tp.toFixed(2)} (${((entryPrice - tp) / entryPrice * 100).toFixed(2)}%)`);

      return { tp, sl };
    }
  }

  /**
   * Ejecutar orden y actualizar balance - SIMPLIFICADO PARA FUTUROS
   */
  private executeOrder(order: TradingOrder): void {
    // En futuros, no compramos el activo, solo operamos con el precio
    // El "amount" representa el tamaño de la posición en USDT

    if (order.side === DESITION.BUY) {
      // Para LONG: restamos el monto de la posición del available
      if (this.balance().available >= order.amount) {
        this.balance.update(bal => ({
          ...bal,
          available: bal.available - order.amount,
          // Mantenemos USDT igual porque no estamos gastando, solo reservando margen
          totalUSDT: bal.totalUSDT // Se actualizará con el P&L en tiempo real
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ LONG abierta: $${order.amount} a precio ${order.price}`);
      } else {
        throw new Error(`Margen insuficiente: ${this.balance().available} USDT < ${order.amount} USDT`);
      }

    } else if (order.side === DESITION.SELL) {
      // Para SHORT: igualmente restamos el monto del available
      if (this.balance().available >= order.amount) {
        this.balance.update(bal => ({
          ...bal,
          available: bal.available - order.amount,
          totalUSDT: bal.totalUSDT
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ SHORT abierta: $${order.amount} a precio ${order.price}`);
      } else {
        throw new Error(`Margen insuficiente: ${this.balance().available} USDT < ${order.amount} USDT`);
      }
    }

    console.log('💰 Balance actualizado:', this.balance());
  }

  /**
   * Cerrar órdenes y actualizar balance - CORREGIDO
   */
  private closeOrders(orders: TradingOrder[]): void {
    orders.forEach(order => {
      if (order.closePrice) {
        // Calcular P&L final de la orden
        let finalPNL = 0;
        if (order.side === DESITION.BUY) {
          finalPNL = (order.closePrice - order.price) * order.amount;
        } else {
          finalPNL = (order.price - order.closePrice) * order.amount;
        }

        // Liberar el margen y actualizar el balance real
        this.balance.update(bal => ({
          ...bal,
          available: bal.available + order.amount, // Liberar margen
          USDT: bal.USDT + finalPNL, // Aplicar P&L real al balance
          totalUSDT: bal.USDT + finalPNL
        }));

        console.log(`🔒 Orden cerrada: ${order.side} - P&L: $${finalPNL.toFixed(2)}`);
      }
    });

    // Remover órdenes de las abiertas
    this.openOrders.update(openOrders =>
      openOrders.filter(order => !orders.find(o => o.id === order.id))
    );

    // Agregar al historial
    this.closedOrders.update(closedOrders => [...closedOrders, ...orders]);
    this.orderHistory.update(history => [...history, ...orders]);
  }

  /**
   * Obtener órdenes abiertas
   */
  getOpenOrders(market: string): Observable<any[]> {
    const orders = this.openOrders().filter(order => order.market === market);
    console.log('getOpenOrders: ', orders)
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

  getOpenOrdersNumber(market: string): number {
    const orders = this.openOrders().filter((order: TradingOrder) => order.market === market);
    return orders.length;
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
    // return this.glmService.currentAtr();
    return 0
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
   * ✅ ACTUALIZADO: Lógica para ejecutar orden automática con ATR ESTE ES EL Q SE USA
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