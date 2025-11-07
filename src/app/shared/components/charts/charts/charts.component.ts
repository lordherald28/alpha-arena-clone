import { Component, input, effect, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CandlestickSeries, createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';

import { Subject } from 'rxjs';

import { Candlestick, Market, TradingOrder } from '../../../../core/models';
import { ControlPanelComponent } from "../../../../features/dashboard/components/control-panel/control-panel.component";
import { TradingLogicService } from '../../../../core/services/trading-logic.service';
import { StoreAppService } from '../../../../core/store/store-app.service';
import { OrderManagerService } from '../../../../core/services/helpers/trading/order-manager.service';
import { IPriceLine, LineStyle } from 'lightweight-charts'; // 

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule, ControlPanelComponent],
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss']
})
export class ChartsComponent implements AfterViewInit, OnDestroy {

  // Inject
  private readonly tradingLogic = inject<TradingLogicService>(TradingLogicService);
  private readonly storeApp = inject<StoreAppService>(StoreAppService);
  private readonly orderManager = inject(OrderManagerService); // <-- AÑADE ESTA INYECCIÓN

  public isLoadAnalysis = computed(() => this.storeApp.getIsLoadedAnalysis());

  // ✅ INPUT REACTIVO
  public candles = input<Candlestick[]>([]);
  public symbol = input<Market>();
  public currentPrice = input<number>(0);

  // Chart
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  private chart!: IChartApi;
  private candlestickSeries!: ISeriesApi<'Candlestick'>;
  private destroy$ = new Subject<void>();

  // ✅ NUEVO: Control de estado para evitar scroll automático no deseado
  private previousCandlesLength = 0;
  public isUserInteracting = false;
  private lastVisibleRange: { from: number; to: number } | null = null;

  // ✅ NUEVO: Map para guardar las referencias a las líneas de TP/SL
  // La clave es el ID de la orden, el valor es un objeto con las líneas de TP y SL.
  private tpSlLines: Map<string, { tpLine: IPriceLine, slLine: IPriceLine }> = new Map();

  constructor() {
    // ✅ EFECTO que reacciona a cambios en el input
    this.reactiveInputCandlesChart();
    this.reactiveTpSlLines();
    effect(() => {
      const currentCandles = this.candles();
      console.log('📊 Candles recibidas:', currentCandles?.length, currentCandles);
    });
  }

  ngAfterViewInit(): void {
    if (this.chartContainer?.nativeElement) {
      this.initializeChart();
      console.log('📊 Gráfico inicializado');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // ✅ AÑADE: Limpiar las líneas del gráfico antes de removerlo
    this.tpSlLines.forEach(({ tpLine, slLine }) => {
      this.candlestickSeries.removePriceLine(tpLine);
      this.candlestickSeries.removePriceLine(slLine);
    });

    if (this.chart) {
      this.chart.remove();
    }
  }

  /**
     * ✅ MÉTODO ESPECÍFICO PARA BACKTESTING
     * Actualiza el gráfico con UNA nueva vela en modo backtesting
     */
  public addBacktestingCandle(candle: Candlestick): void {
    if (!this.candlestickSeries) {
      console.warn('📊 Gráfico no inicializado');
      return;
    }

    const chartCandle = {
      time: (candle.timestamp / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    };

    // Estrategia 1: Agregar vela a vela (para ver crecimiento progresivo)
    this.candlestickSeries.update(chartCandle);

    // Estrategia 2: Auto-scroll para seguir la vela actual
    this.chart.timeScale().scrollToPosition(-1, false);
  }

  /**
   * ✅ MÉTODO PARA REINICIAR BACKTESTING
   */
  public resetBacktesting(): void {
    if (this.candlestickSeries) {
      this.candlestickSeries.setData([]);
    }
    this.previousCandlesLength = 0;
    this.lastVisibleRange = null;
  }

  /**
   * ✅ NUEVO: Actualiza las líneas de TP/SL en el gráfico.
   * Primero elimina todas las líneas existentes y luego dibuja las nuevas.
   * @param orders La lista actual de órdenes abiertas.
   */
  private updateTpSlLines(orders: TradingOrder[]): void {
    // 1. Eliminar todas las líneas anteriores para evitar acumulación
    this.tpSlLines.forEach(({ tpLine, slLine }) => {
      this.candlestickSeries.removePriceLine(tpLine);
      this.candlestickSeries.removePriceLine(slLine);
    });
    this.tpSlLines.clear();

    // 2. Dibujar las nuevas líneas para cada orden abierta
    orders.forEach(order => {
      // Solo dibujar si la orden tiene TP y SL definidos
      if (order.tp && order.sl) {
        const tpLine = this.candlestickSeries.createPriceLine({
          price: order.tp,
          color: '#26a69a', // Verde para Take Profit
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: `TP ${order.id.slice(-6)}`, // Muestra el ID de la orden
        });

        const slLine = this.candlestickSeries.createPriceLine({
          price: order.sl,
          color: '#ef5350', // Rojo para Stop Loss
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: `SL ${order.id.slice(-6)}`, // Muestra el ID de la orden
        });

        // 3. Guardar las referencias de las líneas en el Map
        this.tpSlLines.set(order.id, { tpLine, slLine });
      }
    });
  }

  /**
   * ✅ NUEVO: Efecto que reacciona a los cambios en las órdenes abiertas
   * para dibujar o eliminar las líneas de TP y SL en el gráfico.
   */
  private reactiveTpSlLines(): void {
    effect(() => {
      const openOrders = this.orderManager.openOrders();
      if (!this.candlestickSeries) {
        return;
      }

      // Llama al método que actualiza las líneas
      this.updateTpSlLines(openOrders);
    });
  }

  private reactiveInputCandlesChart(): void {
    effect(() => {
      const currentCandles = this.candles();
      if (!currentCandles || currentCandles.length === 0 || !this.candlestickSeries) {
        return;
      }

      // ✅ DETECTAR TIPO DE ACTUALIZACIÓN
      const currentLength = currentCandles.length;
      const lastCandle = currentCandles[currentLength - 1];

      if (currentLength !== this.previousCandlesLength) {
        // ✅ NUEVAS VELAS - usar setData
        this.updateChartWithSetData(currentCandles);
      } else {
        // ✅ ACTUALIZACIÓN TIEMPO REAL - usar update (OPTIMIZADO)
        this.updateLastCandle(lastCandle);
      }

      this.previousCandlesLength = currentLength;
    });
  }

  private initializeChart(): void {
    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: this.chartContainer.nativeElement.clientHeight || 500,
      layout: {
        background: { color: '#0B0B1B' },
        textColor: '#D9D9D9',
      },
      grid: {
        horzLines: { color: '#2B2B43', visible: true },
        vertLines: { color: '#2B2B43', visible: true }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2B2B43',
        barSpacing: 8,
        minBarSpacing: 2,
        fixLeftEdge: false, // ✅ CAMBIADO: Permite desplazamiento libre
        fixRightEdge: false, // ✅ CAMBIADO: Permite desplazamiento libre
        shiftVisibleRangeOnNewBar: false, // ✅ MANTENIDO: Control manual
        rightBarStaysOnScroll: true, // ✅ NUEVO: Mejor comportamiento al desplazar
        borderVisible: true
      },
      crosshair: {
        mode: 1,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    });

    // ✅ SERIE DE VELAS CON MEJORES COLORES
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      priceScaleId: 'right',
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001
      }
    });

    // ✅ CONFIGURACIÓN MEJORADA DE ESCALA DE PRECIOS
    this.chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.08,   // ✅ REDUCIDO: Menos espacio arriba
        bottom: 0.05, // ✅ REDUCIDO: Menos espacio abajo
      },
      borderColor: '#2B2B43',
      autoScale: true, // ✅ NUEVO: Escala automática inteligente
    });

    // ✅ SUSCRIBIRSE A EVENTOS DE INTERACCIÓN DEL USUARIO
    this.chart.timeScale().subscribeVisibleTimeRangeChange((newRange) => {
      if (newRange) {
        this.lastVisibleRange = {
          from: newRange.from as number,
          to: newRange.to as number
        };

        // ✅ DETECTAR SI EL USUARIO ESTÁ INTERACTUANDO
        const currentTime = Date.now() / 1000;
        const isAtEnd = Math.abs(currentTime - (newRange.to as number)) < 300; // 5 minutos del final
        this.isUserInteracting = !isAtEnd;

      }
    });

    console.log('📊 Gráfico y series inicializados');

    // ✅ ACTUALIZAR INMEDIATAMENTE SI HAY VELAS
    const currentCandles = this.candles();
    if (currentCandles && currentCandles.length > 0) {
      this.updateChartWithSetData(currentCandles);
    }
  }

  private updateChartWithSetData(candles: Candlestick[]): void {
    try {
      const chartData = candles.map(c => ({
        time: (c.timestamp / 1000) as Time, // UNIX seconds
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

      this.candlestickSeries.setData(chartData);

      if (chartData.length > 0 && !this.lastVisibleRange) {
        const startIndex = Math.max(0, chartData.length - 100);
        this.chart.timeScale().setVisibleRange({
          from: chartData[startIndex].time as Time,
          to: chartData[chartData.length - 1].time as Time
        });
      }
    } catch (error) {
      console.error('❌ Error en setData:', error);
    }
  }

  private updateLastCandle(lastCandle: Candlestick): void {
    try {
      this.candlestickSeries.update({
        time: (lastCandle.timestamp / 1000) as Time, // UNIX seconds
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close
      });
    } catch (error) {
      console.error('❌ Error en update:', error);
    }
  }


  // ✅ NUEVO: Método para resetear el zoom y seguir el precio actual
  public resetZoomAndFollow(): void {
    const currentCandles = this.candles();
    if (currentCandles && currentCandles.length > 0 && this.chart) {
      const chartData = currentCandles.map(c => ({
        time: (c.timestamp / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

      // Mostrar las últimas 100 velas
      const startIndex = Math.max(0, chartData.length - 100);
      this.chart.timeScale().setVisibleRange({
        from: chartData[startIndex].time as Time,
        to: chartData[chartData.length - 1].time as Time
      });

      this.isUserInteracting = false;
    }
  }

  // ✅ NUEVO: Método para manejar redimensionamiento
  public onResize(): void {
    if (this.chart && this.chartContainer) {
      this.chart.applyOptions({
        width: this.chartContainer.nativeElement.clientWidth,
        height: this.chartContainer.nativeElement.clientHeight || 500
      });
    }
  }

  public startAnalysis(/* market: TypeMarket */): void {
    this.tradingLogic.startAnalysis(/* market */);
  }

  public stopAnalysis(): void {
    this.tradingLogic.stopAnalysis();
  }

}