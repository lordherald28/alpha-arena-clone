import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, computed, Signal, input, output } from '@angular/core';
import { TradingOrder } from '../../../core/models';
import { PaperTradingService } from '../../../core/services/paper-trading.service';

@Component({
  selector: 'app-orden-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orden-list.component.html',
  styleUrls: ['./orden-list.component.scss']
})
export class OrdenListComponent implements OnInit {

  // ✅ CORRECTO: Input Signal para precio actual
  currentPrice = input<number>(0);

  entradaDesdePadre = input<number>(2);

  // OUTPUT emitir eventos al padre
  public emitirMensaje = output<string>();

  //Evento del hijo para emitir al padre
  onClickEmitirEvento(){
    this.emitirMensaje.emit('Hola papa, soy tu hijo order list.');
  }
  
  // ✅ INYECTAR servicio
  private paperTrading = inject(PaperTradingService);

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
    const currentPrice = this.currentPrice();
    return this.ordenesSignal().map(orden => ({
      ...orden,
      pnlActual: this.calculateCurrentPNL(orden, currentPrice)
    }));
  });

  constructor() { }

  ngOnInit() {
    // ❌ NO necesitas asignar manualmente con Signals
    // La reactividad es automática
  }

  // Método para formatear números
  formatNumber(value: number | undefined, decimals: number = 6): string {
    if (value === undefined || value === null) return '-';
    return value.toFixed(decimals);
  }

  // Método para formatear fecha
  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  // Método para calcular P&L
  calculateCurrentPNL(order: TradingOrder, currentPrice: number): number {
    if (!currentPrice) return 0;

    if (order.side === 'BUY') {
      return (currentPrice - order.price) * order.amount;
    } else {
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