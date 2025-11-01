import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, computed, Signal, input, output, signal, OnDestroy } from '@angular/core';
import { TradingOrder } from '../../../core/models';
import { PaperTradingService } from '../../../core/services/paper-trading.service';
import { StoreAppService } from '../../../core/store/store-app.service';
import { DESITION } from '../../../core/utils/const.utils';
import { RealTimePriceService } from '../../../core/services/real-time-price.service';

@Component({
  selector: 'app-orden-list',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './orden-list.component.html',
  styleUrls: ['./orden-list.component.scss']
})
export class OrdenListComponent implements OnInit, OnDestroy {

  entradaDesdePadre = input<number>(2);

  // OUTPUT emitir eventos al padre
  public emitirMensaje = output<string>();

  //Evento del hijo para emitir al padre
  runQuickTest() {
    this.emitirMensaje.emit('Ejecutando prueba de Paper Trading desde OrdenListComponent');
  }

  // ✅ INYECTAR servicio
  private paperTrading = inject(PaperTradingService);
  private realTimePrice = inject(RealTimePriceService);
  private marketData = inject(StoreAppService);

  // ✅ SEÑAL COMPUTADA: Órdenes abiertas del servicio
  ordenesSignal: Signal<TradingOrder[]> = computed(() => {
    return this.paperTrading.getPaperOrders().open;
  });

  // ✅ SEÑAL COMPUTADA: Resumen de órdenes
  summary = computed(() => {
    const ordenes = this.ordenesSignal();
    return {
      total: ordenes.length,
      compras: ordenes.filter(order => order.side === 'BUY').length,
      ventas: ordenes.filter(order => order.side === 'SELL').length
    };
  });

  // ✅ SEÑAL COMPUTADA: Órdenes con P&L calculado
  ordenesConPNL = computed(() => {
    console.log('ordenes signal: ', this.ordenesSignal())
    return this.ordenesSignal().map(orden => ({
      ...orden,
      pnlActual: this.calculateCurrentPNL(orden)
    }));
  });

  // SEÑAÑ COMPUTADA: Precio actual

  public currentPrice = this.realTimePrice.currentPrice ?? 0;
  public isConnected = this.realTimePrice.isConnected;

  constructor() { }

  ngOnInit(): void {
    // Conectar al mercado deseado
    this.realTimePrice.connect(this.marketData.getDataMarket().market);
  }

  ngOnDestroy(): void {
    this.realTimePrice.disconnect();
  }
  // Método para formatear números
  formatNumber(value: number | undefined, decimals: number = 6): string {
    if (value === undefined || value === null) return '-';
    return value.toString();
  }

  // Método para formatear fecha
  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  // Método para calcular P&L
  calculateCurrentPNL(order: TradingOrder): number {
    const currentPrice = this.currentPrice();

    if (!currentPrice) return 0;

    console.log('order: ', order)
    if (order.side === DESITION.BUY) {
      console.log('order buy (currentPrice - order.price) * order.amount: ', (currentPrice - order.price) * order.amount)
      return (currentPrice - order.price) * order.amount;
    } else {
      console.log('order sell (order.price - currentPrice) * order.amount: ', (order.price - currentPrice) * order.amount)

      return (order.price - currentPrice) * order.amount;
    }
  }

  // Método para determinar clase CSS según el side
  getSideClass(side: string): string {
    return side.toLowerCase();
  }

  // Método para determinar clase CSS según P&L
  getPNLClass(pnl: number): string {
    if (pnl > 0) return 'profit';
    if (pnl < 0) return 'loss';
    return 'neutral';
  }
}