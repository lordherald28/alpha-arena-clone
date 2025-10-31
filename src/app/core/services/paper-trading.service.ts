// services/paper-trading.service.ts
import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TradingOrder, PaperTradingConfig, Candlestick, Balance } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { CoinexService } from './coinex.service';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class PaperTradingService implements ITradingService {
  private balance = signal<Balance>({
    USDT: environment.paperTrading.initialBalance, // Balance inicial en USDT
    BTC: 0,
    totalUSDT: environment.paperTrading.initialBalance,
    currency: '',
    available: '',
    frozen: 0
  });

  private openOrders = signal<TradingOrder[]>([]);
  private closedOrders = signal<TradingOrder[]>([]);
  private orderHistory = signal<TradingOrder[]>([]);

  private autoTradingEnabled = signal<boolean>(false);
  private lastAIDecision = signal<{ decision: string, confidence: number } | null>(null);

  private config: PaperTradingConfig = {
    initialBalance: +this.balance().USDT,
    fee: environment.paperTrading.fee,
    defaultRiskPercent: environment.paperTrading.defaultRisk
  };

  constructor(
    private readonly serviceCoinex: CoinexService
  ) {
    console.log('📊 Paper Trading iniciado con balance:', this.balance());
  }

  getCandles(market: string, interval: string, limit: number): Observable<Candlestick[]> {
    return this.serviceCoinex.getCandles(market, interval, limit)
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
    const atrMultiplierSL = 1.5;   // 1.5 x ATR para SL
    const atrMultiplierTP = 2.25;  // 2.25 x ATR para TP

    if (side === 'BUY') {
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

    if (side === 'BUY') {
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
   * Ejecutar orden y actualizar balance
   */
  private executeOrder(order: TradingOrder): void {
    const fee = order.amount * order.price * this.config.fee;

    if (order.side === 'BUY') {
      const cost = order.amount * order.price + fee;

      if (this.balance().USDT >= cost) {
        this.balance.update(bal => ({
          ...bal,
          USDT: bal.USDT - cost,
          BTC: bal.BTC + order.amount,
          totalUSDT: this.calculateTotalValue(bal.USDT - cost, bal.BTC + order.amount, order.price)
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ COMPRA ejecutada: ${order.amount} BTC @ $${order.price} por ${cost} USDT`);
      } else {
        throw new Error(`Saldo insuficiente: ${this.balance().USDT} USDT < ${cost} USDT`);
      }

    } else if (order.side === 'SELL') {
      const revenue = order.amount * order.price - fee;

      if (this.balance().BTC >= order.amount) {
        this.balance.update(bal => ({
          ...bal,
          USDT: bal.USDT + revenue,
          BTC: bal.BTC - order.amount,
          totalUSDT: this.calculateTotalValue(bal.USDT + revenue, bal.BTC - order.amount, order.price)
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ VENTA ejecutada: ${order.amount} BTC @ $${order.price} por ${revenue} USDT`);
      } else {
        throw new Error(`BTC insuficiente: ${this.balance().BTC} BTC < ${order.amount} BTC`);
      }
    }
  }

  /**
   * Verificar órdenes abiertas contra el precio actual
   */
  checkOrders(currentPrice: number): void {
    const openOrders = this.openOrders();
    const ordersToClose: TradingOrder[] = [];

    openOrders.forEach(order => {
      let closeReason: 'tp' | 'sl' | null = null;

      if (order.side === 'BUY') {
        if (order.tp && currentPrice >= order.tp) {
          closeReason = 'tp';
        } else if (order.sl && currentPrice <= order.sl) {
          closeReason = 'sl';
        }
      } else {
        if (order.tp && currentPrice <= order.tp) {
          closeReason = 'tp';
        } else if (order.sl && currentPrice >= order.sl) {
          closeReason = 'sl';
        }
      }

      if (closeReason) {
        order.status = 'closed';
        order.closePrice = currentPrice;
        order.closeReason = closeReason;
        order.pnl = this.calculatePNL(order);
        ordersToClose.push(order);
      }
    });

    if (ordersToClose.length > 0) {
      this.closeOrders(ordersToClose);
    }
  }

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
    return 50000;
  }

  /**
   * ✅ NUEVO: Obtener ATR actual (necesitas implementar esto)
   */
  private getCurrentATR(): number | null {
    // TODO: Implementar obtención de ATR actual
    // Por ahora retornar null para usar fallback
    return null;
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
      available: '',
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
    atr?: number  // ✅ NUEVO: Parámetro ATR opcional
  ): void {
    console.log(`🤖 Procesando decisión de IA:`, {
      decision: aiResponse.decision,
      confidence: aiResponse.confidence,
      atr: atr,
      autoTradingEnabled: this.autoTradingEnabled(),
      currentPrice: currentPrice
    });

    this.lastAIDecision.set(aiResponse);

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
        side: decision,
        type: 'market',
        amount: orderConfig.amount,
        price: currentPrice,
        timestamp: Date.now(),
        status: 'filled'
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
   * Calcular tamaño de orden automática basado en balance y riesgo
   */
  private calculateAutoOrderSize(decision: 'BUY' | 'SELL' | 'HOLD', currentPrice: number): { amount: number } {
    const balance = this.balance();
    const riskPercent = 0.02; // 2% del balance por operación

    if (decision === 'BUY') {
      const maxInvestment = balance.USDT * riskPercent;
      const amount = maxInvestment / currentPrice;
      return { amount: this.roundAmount(amount) };
    } else if (decision === 'SELL') {
      const maxSale = balance.BTC * riskPercent;
      return { amount: this.roundAmount(maxSale) };
    }

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
    const minConfidence = 0.7; // ✅ REDUCIDO a 0.7 según nuevo prompt

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
    if (this.openOrders().length >= 3) {
      console.log('⚠️ Máximo de órdenes abiertas alcanzado');
      return false;
    }

    // Verificar balance suficiente
    const balance = this.balance();
    if (aiResponse.decision === 'BUY' && balance.USDT < 1) {
      console.log('⚠️ Balance USDT insuficiente para compra');
      return false;
    }

    if (aiResponse.decision === 'SELL' && balance.BTC <= 0) {
      console.log('⚠️ Balance BTC insuficiente para venta');
      return false;
    }

    console.log(`✅ Condiciones cumplidas para ejecutar ${aiResponse.decision}`);
    return true;
  }
}