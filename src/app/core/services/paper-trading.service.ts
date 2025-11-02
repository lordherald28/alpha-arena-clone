// services/paper-trading.service.ts
import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { catchError, interval, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { TradingOrder, PaperTradingConfig, Candlestick, Balance, TypeMarket, statusOrder } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { CoinexService } from './coinex.service';
import { environment } from '../../environments/environment';
import { ATR_MULTIPLIER_SL, ATR_MULTIPLIER_TP, DESITION, eSTATUS, MAX_ORDEN_OPEN, MINCONFIDENCE } from '../utils/const.utils';

import { ATR } from 'technicalindicators';
import { StoreAppService } from '../store/store-app.service';
import { BalanceService } from './balance.service';
import { OrderManagerService } from './order-manager.service';

@Injectable({
  providedIn: 'root'
})
export class PaperTradingService implements ITradingService, OnDestroy {


  // ✅ Inyecta el servicio
  private readonly balanceService = inject(BalanceService);
  private readonly storeAppService = inject(StoreAppService);

  // ✅ Crea un signal local que es una "vista" reactiva del estado del BalanceService
  // ¡Así PaperTrading siempre tiene el balance actualizado de forma reactiva!
  private readonly balance = computed(() => this.balanceService.balance());

  // ✅ Haz lo mismo para las órdenes
  private readonly orderManagerService = inject(OrderManagerService); // Lo inyectaremos luego
  public openOrders = computed(() => this.orderManagerService.openOrders());
  public closedOrders = computed(() => this.orderManagerService.closedOrders());
  public orderHistory = computed(() => this.orderManagerService.orderHistory());
  private readonly currentPriceMarketSymbol = this.storeAppService.currentPrice;
  private readonly marketData = computed(() => this.storeAppService.marketDataConfig());

  // public openOrders = signal<TradingOrder[]>([]);
  // private closedOrders = signal<TradingOrder[]>([]);
  // private orderHistory = signal<TradingOrder[]>([]);

  private autoTradingEnabled = signal<boolean>(false);
  private lastAIDecision = signal<{ decision: string, confidence: number } | null>(null);

  private $subs = new Subscription();

  private $candles = signal<Candlestick[]>([]);
  private $currentAtr = signal<number>(0);

  private config: PaperTradingConfig = {
    initialBalance: +this.balanceService.balance().USDT,
    fee: environment.paperTrading.fee,
    defaultRiskPercent: environment.paperTrading.defaultRisk // TODO ver como calcular y determinar si el riesto debe ser muy bajo por poco capital disponible
  };

  // inject

  constructor(
    private readonly serviceCoinex: CoinexService,
  ) {
    this.setupAutoOrderMonitoring();
    this.updateBalanceUser();
  }

  private updateBalanceUser() {
    effect(() => {
      // ✅ ESTO ESTÁ BIEN. this.openOrders() es un computed, lo lee bien.
      const openOrders = this.openOrders();
      const currentPrice = this.currentPriceMarketSymbol();

      if (openOrders.length > 0 && currentPrice) {
        const totalPNL = openOrders.reduce((sum: any, order: any) => { // Despues tipado
          let pnl = 0;
          if (order.side === DESITION.BUY) {
            pnl = (currentPrice - order.price) * order.amount;
          } else {
            pnl = (order.price - currentPrice) * order.amount;
          }
          return sum + pnl;
        }, 0);

        // Actualizar el balance
        this.balanceService.updateRealTimePnL(totalPNL);
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
  // private startPriceMonitoring(): void {
  //   this.$subs = interval(30000).pipe( // Cada 30 segundos
  //     switchMap(() => this.getCandles()),
  //     tap(response => this.$candles.set(response)),
  //     catchError(err => {
  //       console.error('Price monitoring error:', err);
  //       return of(null);
  //     })
  //   ).subscribe(candles => {
  //     if (candles && candles.length > 0) {
  //       this.currentPriceMarketSymbol.set(candles[0].close);
  //     }
  //   });
  // }

  // getCandles(): Observable<Candlestick[]> {
  //   const candles = this.serviceCoinex.getCandles();
  //   return candles;
  // }

  /**
   * Obtener balance simulado
   */
  // getAccountBalance(): Observable<any[]> {
  //   const balance = this.balance();
  //   return of([
  //     {
  //       currency: 'USDT',
  //       available: balance.USDT.toFixed(8),
  //       initialBalance: environment.paperTrading.initialBalance,
  //       totalUSDT: balance.totalUSDT.toFixed(8),
  //       frozen: '0'
  //     },
  //     {
  //       currency: 'BTC',
  //       available: balance.BTC.toFixed(8),
  //       frozen: '0'
  //     }
  //   ]);
  // }

  // En PaperTradingService - método mejorado
  placeMarketOrder(params: { market: string; side: 'BUY' | 'SELL' | 'HOLD'; amount: string; }): Observable<any> {
    return new Observable(observer => {
      try {
        const currentPrice = this.currentPriceMarketSymbol();
        const amount = parseFloat(params.amount);

        const order: TradingOrder = {
          id: `paper_${Date.now()}`,
          market: this.marketData().market,
          side: params.side,
          type: 'market',
          amount: amount,
          price: currentPrice,
          timestamp: Date.now(),
          status: statusOrder.filled
        };

        // Calcular TP/SL
        const atr = this.$currentAtr();
        const { tp, sl } = atr ?
          this.calculateTPnSLByATR(params.side, currentPrice, atr) :
        /* const { tp, sl } =  */this.calculateTPnSLByPercent(params.side, currentPrice);

        order.tp = tp;
        order.sl = sl;

        // ✅ DEBUG LOGGING
        console.log('🎯 ORDEN CREADA - TP/SL ajustados para crypto:', {
          marketCurrent: this.storeAppService.marketDataConfig().market,
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

        // ✅ AÑADE ESTA LÍNEA: El director le pide al gestor que añada la orden.
        this.orderManagerService.addOrder(order);

        // ✅ CORRECCIÓN: El director delega la tarea al subordinado.
        this.balanceService.reserveFunds(order.amount);
        // this.storeAppService.openOrders.set(this.openOrders());
        console.log(`✅ LONG abierta: $${order.amount} a precio ${order.price}`);
      } else {
        throw new Error(`Margen insuficiente: ${this.balance().available} USDT < ${order.amount} USDT`);
      }

    } else if (order.side === DESITION.SELL) {
      // Para SHORT: igualmente restamos el monto del available
      if (this.balance().available >= order.amount) {

        // ✅ AÑADE ESTA LÍNEA: El director le pide al gestor que añada la orden.
        this.orderManagerService.addOrder(order);

        // ✅ CORRECCIÓN: El director delega la tarea al subordinado.
        this.balanceService.reserveFunds(order.amount);
        // this.storeAppService.openOrders.set(this.openOrders());
        console.log(`✅ SHORT abierta: $${order.amount} a precio ${order.price}`);
      } else {
        throw new Error(`Margen insuficiente: ${this.balance().available} USDT < ${order.amount} USDT`);
      }
    }

    // Actualizar el balance
    // this.storeAppService.paperBalance.set(this.balance()); // no se para que actualizar el balance aqui, pero buen.
  }

  // En paper-trading.service.ts

  /**
   * @description Cierra las órdenes especificadas, delegando la lógica al OrderManagerService
   * y actualizando el balance a través del BalanceService.
   */
  private closeOrders(orders: TradingOrder[]): void {
    if (orders.length === 0) return;

    // 1. ✅ Pídele al gestor de órdenes que las cierre y las mueva de lista.
    this.orderManagerService.closeOrders(orders);

    // 2. ✅ Por cada orden cerrada, actualiza el balance.
    orders.forEach(order => {
      if (order.closePrice) {
        let finalPNL = 0;
        if (order.side === DESITION.BUY) {
          finalPNL = (order.closePrice - order.price) * order.amount;
        } else {
          finalPNL = (order.price - order.closePrice) * order.amount;
        }
        // Pídele al tesorero que libere los fondos y aplique el P&L.
        this.balanceService.closeOrderFunds(order.amount, finalPNL);
        console.log(`🔒 Orden cerrada: ${order.side} - P&L: $${finalPNL.toFixed(2)}`);
      }
    });
  }

  /**
   * Obtener órdenes abiertas
   */
  getOpenOrders(market: string): Observable<any[]> {
    const orders = this.openOrders().filter((order: any) => order.market === market);
    console.log('getOpenOrders: ', orders)
    return of(orders.map((order: any) => ({
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

  getPaperOrders(): { open: TradingOrder[], closed: TradingOrder[] } {
    return {
      open: this.openOrders(),
      closed: this.closedOrders()
    };
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
        market: this.marketData().market,
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

      // DEBUG
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

    console.log(`✅ Condiciones cumplidas para ejecutar ${aiResponse.decision}`);
    return true;
  }
}