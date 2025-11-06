// services/paper-trading.service.ts

import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { TradingOrder, PaperTradingConfig, Candlestick, Balance, statusOrder, AiResponse, TypeMarket, MarketTicksSize } from '../../models';
import { ITradingService } from '../../base/trading-service.interface';
import { CoinexService } from '../coinex/coinex.service';
import { environment } from '../../../environments/environment';
import { DESITION, eSTATUS } from '../../utils/const.utils';

// ✅ Importa a los servicios del core
import { StoreAppService } from '../../store/store-app.service';
import { BalanceService } from '../helpers/trading/balance.service';
import { OrderManagerService } from '../helpers/trading/order-manager.service';
import { RiskManagementService } from '../helpers/trading/risk-management.service';
import { environment as envProd } from '../../../environments/environment.prod';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PaperTradingService implements ITradingService, OnDestroy {

  // --- Inyección de Servicios Especialistas (El Equipo) ---
  private readonly balanceService = inject(BalanceService);
  private readonly orderManagerService = inject(OrderManagerService);
  private readonly riskManagement = inject(RiskManagementService);
  private readonly storeAppService = inject(StoreAppService);
  private readonly serviceCoinex = inject(CoinexService);
  private readonly http = inject(HttpClient);

  // --- Estado Reactivo Interno del Director (Vistas del Estado Central) ---
  private readonly balance = computed(() => this.balanceService.balance());
  public readonly openOrders = computed(() => this.orderManagerService.openOrders());
  public readonly closedOrders = computed(() => this.orderManagerService.closedOrders());
  public readonly orderHistory = computed(() => this.orderManagerService.orderHistory());
  private readonly currentPriceMarketSymbol = this.storeAppService.currentPrice;
  private readonly marketData = computed(() => this.storeAppService.marketDataConfig());
  public readonly marketStatusTicksSize = signal<MarketTicksSize>({
    tick_size: '',
    leverage: []
  });;

  // --- Estado de Control del Director ---
  // private autoTradingEnabled = signal<boolean>(false); // TODO: Pasar esto al store app, para que este centralizado
  private autoTradingEnabled = computed(() => this.storeAppService.autoTradingEnableStoreApp());
  private lastAIDecision = signal<{ decision: string, confidence: number } | null>(null);
  private config: PaperTradingConfig;
  private readonly BASE_URL = !environment.production ? '/api' : envProd.coinex.baseUrl;

  constructor() {
    this.config = {
      initialBalance: this.balance().USDT || environment.paperTrading.initialBalance,
      fee: environment.paperTrading.fee,
      defaultRiskPercent: environment.paperTrading.defaultRisk
    };
    this.setupAutoOrderMonitoring();
    this.updateBalanceUser();
    this.stateAutoTrading();

    // DEBUG
    // effect(() => {
    //   console.log('En paper trading el ticks 📏Ticks Size:📏', this.marketStatusTicksSize().tick_size);
    // })
  }

  getMarketStatusTicksSize(marketData: TypeMarket): Observable<MarketTicksSize> {

    const url = `${this.BASE_URL}/futures/market`;
    const params = new HttpParams()
      .set('market', marketData.market.toUpperCase())

    return this.http.get<any>(url, { params, headers: { 'Access-Control-Allow-Origin': '*' } })
      .pipe(
        tap(response => {console.log('📏 Raw API Response:', response.data[0]);   this.marketStatusTicksSize.set(response.data[0]);}),
        map(response => {

          if (response.code === 0 && response.data) {
            const result = {
              leverage: response.data.leverage || [],
              tick_size: response.data.tick_size || '0.0001', // Valor por defecto
              market: response.data.market || marketData.market
            };

            // this.marketStatusTicksSize.set(result);
            return result;
          } else {
            throw new Error(`CoinEx Error ${response.code}: ${response.message}`);
          }
        }),
        catchError(error => {
          console.error('Error fetching tick size:', error);
          return of({
            leverage: [],
            tick_size: '',
            market: ''
          });
        })

      )
  }

  ngOnDestroy(): void {
    // No hay suscripciones que limpiar aquí, todo se maneja con effects.
  }

  // --- Lógica de Monitoreo y Actualización en Tiempo Real ---

  stateAutoTrading(): void {
    effect(() => {
      console.log(`🤖 Trading automático: ${this.autoTradingEnabled() ? 'ACTIVADO' : 'DESACTIVADO'}`);
    })
  }

  // --- Métodos Públicos de la API del Director ---

  /**
    * @description Coloca una orden manual de mercado simulada.
    * @param params Parámetros de la orden.
    * @returns {TradingOrder} La orden que fue ejecutada.
    * @throws {Error} Si no hay margen suficiente.
    */
  placeMarketOrder(params: { market: string; side: 'BUY' | 'SELL' | 'HOLD'; amount: number; }): TradingOrder {
    try {
      const currentPrice = this.currentPriceMarketSymbol();

      const order: TradingOrder = {
        id: `paper_${Date.now()}`,
        market: params.market || this.marketData().market,
        side: params.side,
        type: 'market',
        amount: params.amount,
        price: currentPrice,
        timestamp: Date.now(),
        status: statusOrder.filled
      };

      // ✅ Obtener el valor ACTUAL de la señal
      const marketInfo = this.marketStatusTicksSize();
      console.log('📏 Market Info en placeMarketOrder:', marketInfo);

      if (!marketInfo || !marketInfo.tick_size) {
        console.warn('⚠️ Tick size no disponible, usando valor por defecto');
        // Usar un valor por defecto o lanzar error
        const defaultTickSize = '0.0001';
        const { tp, sl } = this.riskManagement.calculateTpSlByFixedRisk(
          order.side,
          currentPrice,
          { ...marketInfo, tick_size: defaultTickSize }
        );
        order.tp = tp;
        order.sl = sl;
      } else {
        // ✅ Tick size disponible, calcular normalmente
        const { tp, sl } = this.riskManagement.calculateTpSlByFixedRisk(
          order.side,
          currentPrice,
          marketInfo
        );
        order.tp = tp;
        order.sl = sl;
      }

      console.log('🎯 ORDEN CREADA:', { ...order, method: 'FixedRisk-based' });

      this.executeOrder(order);
      return order;

    } catch (error: any) {
      throw new Error(`Error al colocar la orden: ${error.message}`);
    }
  }

  /**
   * @description Recibe la decisión de la IA y la procesa para ejecutar una orden si corresponde.
   */
  processAIDecision(aiResponse: AiResponse, currentPrice: number, atr?: number): void {

    // console.log(`🤖 Procesando decisión de IA:`, { decision: aiResponse.decision, confidence: aiResponse.confidence });

    this.lastAIDecision.set({ decision: aiResponse.decision, confidence: aiResponse.confidence });

    if (this.autoTradingEnabled()) {
      if (this.riskManagement.shouldExecuteOrder(aiResponse, this.openOrders().length, this.balance().available, atr, currentPrice)) {
        console.log(`🚀 Ejecutando orden automática: ${aiResponse.decision}`);
        this.executeAutoOrder(aiResponse.decision, currentPrice, atr);
      } else {
        console.log(`⏸️ Orden no ejecutada: condiciones no cumplidas`);
      }
    } else {
      console.log('❌ Trading automático DESHABILITADO - no se ejecuta orden');
    }
  }
  // --- Métodos de Consulta (Getters) ---

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

  getOpenOrdersNumber(market: string): number {
    return this.openOrders().filter(order => order.market === market).length;
  }

  getPaperOrders(): { open: TradingOrder[], closed: TradingOrder[] } {
    return {
      open: this.openOrders(),
      closed: this.closedOrders()
    };
  }

  // --- Implementación de la interfaz ITradingService ---
  // Estos métodos se mantienen para cumplir con el contrato, pero la lógica principal
  // se maneja con los métodos más específicos de arriba.

  getCandles(): Observable<Candlestick[]> {
    return this.serviceCoinex.getCandles(this.marketData());
  }

  getAccountBalance(): Observable<Balance> {
    const balance = this.balance();
    return of(balance);
    // return of([
    //   { currency: 'USDT', available: balance.USDT.toFixed(8), totalUSDT: balance.totalUSDT.toFixed(8), frozen: '0' },
    //   { currency: 'BTC', available: balance.BTC.toFixed(8), frozen: '0' }
    // ]);
  }
  // --- Métodos Privados de Ejecución (Orquestación) ---

  private executeOrder(order: TradingOrder): void {
    if (this.balance().available >= order.amount) {
      this.orderManagerService.addOrder(order);
      this.balanceService.reserveFunds(order.amount);
      // console.log(`✅ ${order.side} abierta: $${order.amount} a precio ${order.price}`);
    } else {
      throw new Error(`Margen insuficiente: ${this.balance().available} USDT < ${order.amount} USDT`);
    }
  }

  private closeOrders(orders: TradingOrder[]): void {
    if (orders.length === 0) return;
    this.orderManagerService.closeOrders(orders);
    orders.forEach(order => {
      if (order.closePrice) {
        const finalPNL = (order.side === DESITION.BUY)
          ? (order.closePrice - order.price) * order.amount
          : (order.price - order.closePrice) * order.amount;
        this.balanceService.closeOrderFunds(order.amount, finalPNL);
        console.log(`🔒 Orden cerrada: ${order.side} - P&L: $${finalPNL.toFixed(2)}`);
      }
    });
  }

  private executeAutoOrder(decision: 'BUY' | 'SELL' | 'HOLD', currentPrice: number, atr?: number): void {
    const orderSize = this.riskManagement.calculatePositionSize(this.balance().available, this.config.defaultRiskPercent);
    if (orderSize > 0) {
      const order: TradingOrder = {
        id: `auto_${Date.now()}`,
        market: this.marketData().market,
        side: decision,
        type: 'market',
        amount: orderSize,
        price: currentPrice,
        timestamp: Date.now(),
        status: eSTATUS.FILLED
      };
      // const { tp, sl } = atr
      //   ? this.riskManagement.calculateTpSlByAtr(decision, currentPrice, atr)
      //   : this.riskManagement.calculateTpSlByPercent(decision, currentPrice, this.config.defaultRiskPercent);
      
      const { tp, sl } = this.riskManagement.calculateTpSlByFixedRisk(decision, currentPrice, this.marketStatusTicksSize());
      order.tp = tp;
      order.sl = sl;
      this.executeOrder(order);
      console.log(`🤖 ORDEN AUTOMÁTICA ${decision} ejecutada:`, { amount: order.amount, price: order.price, tp: order.tp, sl: order.sl, method: atr ? 'ATR-based' : 'Percent-based' });
    }
  }

  private updateBalanceUser(): void {
    effect(() => {
      const openOrders = this.openOrders();
      const currentPrice = this.currentPriceMarketSymbol();

      if (openOrders.length > 0 && currentPrice) {
        const totalPNL = openOrders.reduce((sum, order) => {
          const pnl = (order.side === DESITION.BUY)
            ? (currentPrice - order.price) * order.amount
            : (order.price - currentPrice) * order.amount;
          return sum + pnl;
        }, 0);
        this.balanceService.updateRealTimePnL(totalPNL);
      }
    }, { allowSignalWrites: true });
  }

  private setupAutoOrderMonitoring(): void {
    effect(() => {
      const currentPrice = this.currentPriceMarketSymbol();
      const openOrders = this.openOrders();

      if (currentPrice > 0 && openOrders.length > 0) {
        const ordersToClose = openOrders.filter(order =>
          (order.side === DESITION.BUY && (currentPrice >= order.tp! || currentPrice <= order.sl!)) ||
          (order.side === DESITION.SELL && (currentPrice <= order.tp! || currentPrice >= order.sl!))
        );
        if (ordersToClose.length > 0) {
          this.closeOrders(ordersToClose);
        }
      }
    }, { allowSignalWrites: true });
  }

}