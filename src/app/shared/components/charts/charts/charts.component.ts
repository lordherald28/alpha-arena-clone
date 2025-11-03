import { Component, input, effect, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Candlestick, Market } from '../../../../core/models';
import { CandlestickSeries, createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss']
})
export class ChartsComponent implements AfterViewInit, OnDestroy {

  // ✅ INPUT REACTIVO
  public candles = input<Candlestick[]>([]);
  public symbol = input<Market>();

  // Chart
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  private chart!: IChartApi;
  private candlestickSeries!: ISeriesApi<'Candlestick'>;
  private destroy$ = new Subject<void>();

  // ✅ NUEVO: Control de estado para evitar scroll automático no deseado
  private previousCandlesLength = 0;
  public isUserInteracting = false;
  private lastVisibleRange: { from: number; to: number } | null = null;

  constructor() {
    // ✅ EFECTO que reacciona a cambios en el input
    this.reactiveInputCandlesChart();
  }

  ngAfterViewInit(): void {
    if (this.chartContainer?.nativeElement) {
      this.initializeChart();
      console.log('📊 Gráfico inicializado');
    }
  }

  private reactiveInputCandlesChart(): void {
    effect(() => {
      const currentCandles = this.candles();
      // console.log("📊 Efecto detectó velas:", currentCandles?.length || 0);
      console.log('mercado: ', this.symbol()?.market)
      if (!currentCandles || currentCandles.length === 0 || !this.candlestickSeries) {
        return;
      }

      // ✅ DETECTAR TIPO DE ACTUALIZACIÓN
      const currentLength = currentCandles.length;
      const lastCandle = currentCandles[currentLength - 1];

      if (currentLength !== this.previousCandlesLength) {
        // ✅ NUEVAS VELAS - usar setData
        // console.log('🔄 Número de velas cambió - usando setData');
        this.updateChartWithSetData(currentCandles);
      } else {
        // ✅ ACTUALIZACIÓN TIEMPO REAL - usar update (OPTIMIZADO)
        // console.log('⚡ Actualización tiempo real - usando update');
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

        // console.log('🎯 Usuario interactuando:', !isAtEnd, 'Rango:', newRange);
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
        // this.chart.timeScale().scrollToRealTime(); // seguir el final
      }

      console.log('✅ setData() - Actualizadas', candles.length, 'velas');
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

      // if (!this.isUserInteracting) {
      //   this.chart.timeScale().scrollToRealTime();
      // }

      console.log('⚡ update() - Vela actualizada:', lastCandle.close, 'Usuario interactuando:', this.isUserInteracting);
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.chart) {
      this.chart.remove();
    }
  }
}