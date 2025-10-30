// services/paper-trading.service.ts
import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TradingOrder, PaperBalance, PaperTradingConfig, Candlestick } from '../models';
import { ITradingService } from '../base/trading-service.interface';
import { CoinexService } from './coinex.service';

@Injectable({
  providedIn: 'root'
})
export class PaperTradingService implements ITradingService {
  private balance = signal<PaperBalance>({
    USDT: 10,  // Balance inicial en USDT
    BTC: 0,
    totalUSDT: 10
  });

  private openOrders = signal<TradingOrder[]>([]);
  private closedOrders = signal<TradingOrder[]>([]);
  private orderHistory = signal<TradingOrder[]>([]);

  private config: PaperTradingConfig = {
    initialBalance: 10,
    fee: 0.001, // 0.1% de comisión
    defaultRiskPercent: 0.02 // 2% de riesgo por operación
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
  placeMarketOrder(params: { market: string; side: 'BUY' | 'SELL'; amount: string; }): Observable<any> {
    return new Observable(observer => {
      try {
        const currentPrice = this.getCurrentMarketPrice(); // Necesitarás implementar esto
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

        // Calcular TP/SL automáticamente basado en ATR o porcentaje fijo
        const { tp, sl } = this.calculateTPnSL(params.side, currentPrice);
        order.tp = tp;
        order.sl = sl;

        // Ejecutar la orden
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
   * Calcular Take Profit y Stop Loss
   */
  private calculateTPnSL(side: 'BUY' | 'SELL', entryPrice: number): { tp: number, sl: number } {
    const riskRewardRatio = 2; // 1:2 risk-reward

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
      // COMPRA: Gastar USDT, recibir BTC
      const cost = order.amount * order.price + fee;

      if (this.balance().USDT >= cost) {
        this.balance.update(bal => ({
          ...bal,
          USDT: bal.USDT - cost,
          BTC: bal.BTC + order.amount,
          totalUSDT: this.calculateTotalValue(bal.USDT - cost, bal.BTC + order.amount, order.price)
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ COMPRA ejecutada: ${order.amount} BTC @ $${order.price}`);
      } else {
        throw new Error('Saldo insuficiente en paper trading');
      }

    } else {
      // VENTA: Gastar BTC, recibir USDT
      const revenue = order.amount * order.price - fee;

      if (this.balance().BTC >= order.amount) {
        this.balance.update(bal => ({
          ...bal,
          USDT: bal.USDT + revenue,
          BTC: bal.BTC - order.amount,
          totalUSDT: this.calculateTotalValue(bal.USDT + revenue, bal.BTC - order.amount, order.price)
        }));

        this.openOrders.update(orders => [...orders, order]);
        console.log(`✅ VENTA ejecutada: ${order.amount} BTC @ $${order.price}`);
      } else {
        throw new Error('BTC insuficiente en paper trading');
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
        // Para órdenes de COMPRA
        if (order.tp && currentPrice >= order.tp) {
          closeReason = 'tp';
        } else if (order.sl && currentPrice <= order.sl) {
          closeReason = 'sl';
        }
      } else {
        // Para órdenes de VENTA  
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

    // Cerrar órdenes que alcanzaron TP/SL
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
   * Obtener precio de mercado actual (necesitas implementar esto)
   */
  private getCurrentMarketPrice(): number {
    // Implementar según tu fuente de datos
    // Puedes usar el último precio de las velas de CoinEx
    // Por ahora, retornamos un valor fijo
    return 50000; // Precio ejemplo //TODO signal
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
  getPaperBalance(): PaperBalance {
    return this.balance();
  }

  getPaperOrders(): { open: TradingOrder[], closed: TradingOrder[] } {
    return {
      open: this.openOrders(),
      closed: this.closedOrders()
    };
  }

  resetPaperTrading(initialBalance: number = 1000): void {
    this.balance.set({
      USDT: initialBalance,
      BTC: 0,
      totalUSDT: initialBalance
    });
    this.openOrders.set([]);
    this.closedOrders.set([]);
    console.log('🔄 Paper Trading reiniciado');
  }
}