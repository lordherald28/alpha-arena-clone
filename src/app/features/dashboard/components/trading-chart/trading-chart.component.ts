import { Component, input, effect, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Candlestick } from '../../../../core/models';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries, LineData, LineSeries } from 'lightweight-charts';

import { EMA } from 'technicalindicators';

@Component({
  selector: 'app-trading-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trading-chart.component.html',
  styleUrls: ['./trading-chart.component.scss']
})
export class TradingChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  public candles = input<Candlestick[]>([]);

  private chart: IChartApi | any;
  private candlestickSeries: ISeriesApi<'Candlestick'> | undefined;
  private ema660Series: ISeriesApi<'Line'> | undefined;

  constructor() {
    effect(() => {
      const candleData = this.candles();
      if (candleData && candleData.length > 0 && this.candlestickSeries) {
        this.updateChartWithIndicators(candleData);
        this.chart?.timeScale().fitContent();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.chartContainer?.nativeElement) {
      this.chart = createChart(this.chartContainer.nativeElement, {
        width: this.chartContainer.nativeElement.clientWidth,
        height: this.chartContainer.nativeElement.clientHeight || 400,
        layout: {
          background: { color: '#fff' },
          textColor: '#2e2e2eff',
        },
        grid: {
          horzLines: { visible: false },
          vertLines: { visible: false }
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#2B2B43',
          rightOffset: 12,
          barSpacing: 0.5,
          minBarSpacing: 0.1,
          fixLeftEdge: true,
          fixRightEdge: false,
          shiftVisibleRangeOnNewBar: true
        }
      });

      // ✅ CONFIGURACIÓN CON 6 DECIMALES para velas
      this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: '#f8f8f8ff',
        downColor: '#414141ff',
        borderDownColor: '#414141ff',
        borderUpColor: '#414141ff',
        wickDownColor: '#414141ff',
        wickUpColor: '#414141ff',
        // ✅ NUEVO: Configurar escala de precios con 6 decimales
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001
        }
      });

      // ✅ CONFIGURACIÓN CON 6 DECIMALES para EMA660
      this.ema660Series = this.chart.addSeries(LineSeries, {
        color: '#FF6B00',
        lineWidth: 2,
        title: 'EMA 660',
        // ✅ NUEVO: Configurar escala de precios con 6 decimales
        priceScaleId: 'right',
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001
        }
      });

      // ✅ OPCIONAL: Configurar la escala de precios principal
      this.chart.priceScale('right').applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        // ✅ NUEVO: Formato de la escala con 6 decimales
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001
        }
      });

      console.log('📊 Gráfico inicializado con series de EMA660 y 6 decimales');
    }
  }

  /**
   * Actualizar gráfico con velas e indicadores
   */
  private updateChartWithIndicators(candles: Candlestick[]): void {
    // Preparar datos de velas - ✅ ASEGURAR 6 DECIMALES
    const candleData: CandlestickData[] = candles.map(c => ({ // Aqui se puede usar el patron adapter (Clean Arq.)
      time: (c.timestamp / 1000) as Time,
      open: this.roundToSixDecimals(c.open),
      high: this.roundToSixDecimals(c.high),
      low: this.roundToSixDecimals(c.low),
      close: this.roundToSixDecimals(c.close)
    }));

    // Calcular EMA660 - ✅ ASEGURAR 6 DECIMALES
    const ema660Data = this.calculateEMA660(candles);

    // ✅ Actualizar las velas
    if (this.candlestickSeries) {
      this.candlestickSeries.setData(candleData);
    }

    // ✅ Actualizar EMA660
    if (this.ema660Series && ema660Data.length > 0) {
      this.ema660Series.setData(ema660Data);
      console.log('📈 EMA660 agregada al gráfico:', ema660Data.length + ' puntos');
    }

    // Ajustar el rango visible
    setTimeout(() => {
      if (candleData.length > 0) {
        this.chart?.timeScale().setVisibleRange({
          from: candleData[0].time as Time,
          to: candleData[candleData.length - 1].time as Time
        });
      }
    }, 100);

    console.log('📈 Datos para gráfico:', {
      velas: candleData.length,
      ema660: ema660Data.length,
      ejemploPrecio: candleData[0] ? {
        open: candleData[0].open,
        close: candleData[0].close
      } : 'N/A'
    });
  }

  /**
   * ✅ NUEVO: Redondear a 6 decimales
   */
  private roundToSixDecimals(value: number): number {
    return Math.round(value * 1000000) / 1000000;
  }

  /**
   * Calcular EMA660 para el gráfico - ✅ ASEGURAR 6 DECIMALES
   */
  private calculateEMA660(candles: Candlestick[]): LineData[] {
    const closes = candles.map(c => c.close);

    // Calcular EMA660 usando technicalindicators
    const ema660Values = EMA.calculate({
      period: 660,
      values: closes
    });

    // Combinar con timestamps (la EMA660 empieza después del período 660)
    const ema660Data: LineData[] = [];

    for (let i = 0; i < ema660Values.length; i++) {
      const candleIndex = i + 660 - 1;
      if (candleIndex < candles.length) {
        ema660Data.push({
          time: (candles[candleIndex].timestamp / 1000) as Time,
          value: this.roundToSixDecimals(ema660Values[i])
        });
      }
    }

    console.log('📊 EMA660 calculada con 6 decimales:', {
      totalPuntos: ema660Data.length,
      ejemploValor: ema660Data[0] ? ema660Data[0].value : 'N/A'
    });

    return ema660Data;
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }
}