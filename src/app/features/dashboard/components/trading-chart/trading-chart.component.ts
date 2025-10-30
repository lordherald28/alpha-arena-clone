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
  private ema660Series: ISeriesApi<'Line'> | undefined; // ✅ Nueva serie para EMA660

  constructor() {

    // Llama este método en tu efecto temporalmente:
    effect(() => {
      const candleData = this.candles();
      // this.debugData(); // ← Agrega esta línea temporalmente

      // console.log('🕯️ Datos recibidos en componente:', candleData);

      if (candleData && candleData.length > 0 && this.candlestickSeries) {
        this.updateChartWithIndicators(candleData);

        // const formattedData: CandlestickData[] = candleData.map(c => {
        //   // ✅ Lightweight Charts espera timestamp en SEGUNDOS, no milisegundos
        //   const candle = {
        //     time: (c.timestamp / 1000) as Time, // Convertir milisegundos a segundos
        //     open: c.open,
        //     high: c.high,
        //     low: c.low,
        //     close: c.close
        //   };
        //   // console.log('📈 Vela formateada para chart:', candle);
        //   return candle;
        // });

        // console.log('🎯 Total de velas a mostrar:', formattedData.length);
        // this.candlestickSeries.setData(formattedData);

        // ✅ Ajustar el zoom para mostrar todos los datos
        this.chart?.timeScale().fitContent();
      }
    });
  }

  ngAfterViewInit(): void {
    //     background: { color: '#1e1e1e' },
    // textColor: '#d1d4dc',

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
          // ✅ AGREGAR ESTAS OPCIONES:
          rightOffset: 12, // Espacio a la derecha
          barSpacing: 0.5, // Espaciado entre velas
          minBarSpacing: 0.1, // Espaciado mínimo
          fixLeftEdge: true,
          fixRightEdge: false,
          shiftVisibleRangeOnNewBar: true
        }
      });

      // ✅ FORMA CORRECTA de agregar la serie (versiones actuales)
      this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: '#f8f8f8ff',
        downColor: '#414141ff',
        borderDownColor: '#414141ff',
        borderUpColor: '#414141ff',
        wickDownColor: '#414141ff',
        wickUpColor: '#414141ff',
      });

      // ✅ Serie para EMA660
      this.ema660Series = this.chart.addSeries(LineSeries, {
        color: '#FF6B00', // Color naranja para EMA660
        lineWidth: 2,
        title: 'EMA 660',
      });
      // this.ema660Series = this.chart.addLineSeries({ lineWidth: 1 })
      console.log('📊 Gráfico inicializado con series de EMA660');
      console.log('📊 Gráfico inicializado correctamente');
    }
  }
  // En tu componente, agrega este método para verificar los datos
  debugData(): void {
    const currentCandles = this.candles();
    // console.log('🐛 DEBUG - Velas actuales:', currentCandles);

    if (currentCandles && currentCandles.length > 0) {
      console.log('🐛 DEBUG - Primera vela:', currentCandles[0]);
      console.log('🐛 DEBUG - Tipos de datos:', {
        timestamp: typeof currentCandles[0].timestamp,
        open: typeof currentCandles[0].open,
        high: typeof currentCandles[0].high,
        low: typeof currentCandles[0].low,
        close: typeof currentCandles[0].close
      });
    }
  }

  /**
 * Actualizar gráfico con velas e indicadores
 */
  private updateChartWithIndicators(candles: Candlestick[]): void {
    // Preparar datos de velas
    const candleData: CandlestickData[] = candles.map(c => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }
    
  ));

    // Calcular EMA660
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

    // ✅ CORREGIDO: Usar setVisibleRange en lugar de fitContent
    setTimeout(() => {
      if (candleData.length > 0) {
        // Ajustar el rango visible manualmente
        this.chart?.timeScale().setVisibleRange({
          from: candleData[0].time as Time,
          to: candleData[candleData.length - 1].time as Time
        });

        // O también puedes probar con:
        // this.chart?.timeScale().fitContent();
      }
    }, 100);

    console.log('📈 Datos para gráfico:', {
      velas: candleData.length,
      ema660: ema660Data.length,
      rango: {
        desde: new Date((candleData[0].time as number) * 1000),
        hasta: new Date((candleData[candleData.length - 1].time as number) * 1000)
      }
    });
  }

  /**
   * Calcular EMA660 para el gráfico
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
      // El índice de la vela correspondiente es i + 660 - 1
      const candleIndex = i + 660 - 1;
      if (candleIndex < candles.length) {
        ema660Data.push({
          time: (candles[candleIndex].timestamp / 1000) as Time,
          value: ema660Values[i]
        });
      }
    }

    // console.log('📊 EMA660 calculada:', {
    //   totalPuntos: ema660Data.length,
    //   primerPunto: ema660Data[0] ? {
    //     time: new Date(ema660Data[0].time * 1000),
    //     value: ema660Data[0].value
    //   } : 'N/A',
    //   ultimoPunto: ema660Data[ema660Data.length - 1] ? {
    //     time: new Date(ema660Data[ema660Data.length - 1].time * 1000),
    //     value: ema660Data[ema660Data.length - 1].value
    //   } : 'N/A'
    // });

    return ema660Data;
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }
}