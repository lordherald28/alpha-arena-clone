import { Component, input, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingOrder } from '../../../core/models';
import { PaperTradingService } from '../../../core/services/paper-trading.service';
import { RealTimePriceService } from '../../../core/services/real-time-price.service';
import { DESITION } from '../../../core/utils/const.utils';
import { StoreAppService } from '../../../core/store/store-app.service';

@Component({
  selector: 'app-orden-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orden-list.component.html',
  styleUrls: ['./orden-list.component.scss']
})
export class OrdenListComponent implements OnInit, OnDestroy {
  public entradaDesdePadre = input<string>('');

  // Services
  private realTimePrice = inject(RealTimePriceService);
  private paperTrading = inject(PaperTradingService);
  private storeApp = inject(StoreAppService);

  // Señal del precio actual
  public currentPrice = this.realTimePrice.currentPrice;

  // ✅ CORREGIDO: Señal computada que se actualiza automáticamente
  public ordenesConPNL = computed(() => {
    const orders = this.paperTrading.getPaperOrders().open;
    const currentPrice = this.currentPrice();

    console.log('🔄 Recalculando P&L - Precio actual:', currentPrice);

    return orders.map(order => ({
      ...order,
      pnlActual: this.calculateCurrentPNL(order, currentPrice)
    }));
  });

  // ✅ CORREGIDO: Summary también reactivo
  public summary = computed(() => {
    const ordenes = this.ordenesConPNL();
    return {
      total: ordenes.length,
      compras: ordenes.filter(o => o.side === DESITION.BUY).length,
      ventas: ordenes.filter(o => o.side === DESITION.SELL).length,
      pnlTotal: ordenes.reduce((sum, o) => sum + o.pnlActual, 0)
    };
  });

  market = this.storeApp.getSignalMarket();

  ngOnInit(): void {
    // Conectar al mercado deseado
    // const market = 'ETHUSDT'; // Ajusta según tu mercado??
    this.realTimePrice.connect(this.market().market);

    console.log('📊 Inicializando componente de órdenes con precio real-time');
  }

  ngOnDestroy(): void {
    this.realTimePrice.disconnect();
  }

  // Método CORREGIDO para calcular P&L
  private calculateCurrentPNL(order: TradingOrder, currentPrice: number | null): number {
    if (!currentPrice) return 0;

    console.log('📝 Calculando P&L para orden:', {
      id: order.id,
      side: order.side,
      orderPrice: order.price,
      currentPrice: currentPrice,
      amount: order.amount,
      valorPosicion: order.price * order.amount
    });

    let pnl = 0;
    if (order.side === DESITION.BUY) {
      // Para órdenes BUY: (Precio Actual - Precio Entrada) / Precio Entrada * 100
      const diferenciaPrecio = currentPrice - order.price;
      pnl = (diferenciaPrecio / order.price) * 100;
      console.log(`💰 P&L COMPRA: ((${currentPrice} - ${order.price}) / ${order.price}) * 100 = ${pnl.toFixed(2)}%`);
    } else {
      // Para órdenes SELL: (Precio Entrada - Precio Actual) / Precio Entrada * 100  
      const diferenciaPrecio = order.price - currentPrice;
      pnl = (diferenciaPrecio / order.price) * 100;
      console.log(`💰 P&L VENTA: ((${order.price} - ${currentPrice}) / ${order.price}) * 100 = ${pnl.toFixed(2)}%`);
    }

    return pnl;
  }

  /**
   * Método para probar el cálculo
   */
  runQuickTest(): void {
    const orders = this.paperTrading.getPaperOrders().open;
    const currentPrice = this.currentPrice();

    console.log('🧪 TEST - Precio actual:', currentPrice);
    console.log('🧪 TEST - Órdenes:', orders);

    orders.forEach(order => {
      const pnl = this.calculateCurrentPNL(order, currentPrice);
      console.log(`🧪 TEST - Orden ${order.id} P&L: ${pnl}`);
    });
  }

  // Tus métodos existentes (mantener sin cambios)
  getSideClass(side: string): string {
    return side === DESITION.BUY ? 'side-buy' : 'side-sell';
  }

  getPNLClass(pnl: number): string {
    return pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : 'pnl-zero';
  }

  formatNumber(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }
}