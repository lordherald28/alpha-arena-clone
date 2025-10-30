import { Component, input, effect, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Candlestick } from '../../../../core/models';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';

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

  private chart: IChartApi | undefined;
  private candlestickSeries: ISeriesApi<'Candlestick'> | undefined;

  constructor() {

    // Llama este método en tu efecto temporalmente:
    effect(() => {
      const candleData = this.candles();
      // this.debugData(); // ← Agrega esta línea temporalmente

      // console.log('🕯️ Datos recibidos en componente:', candleData);

      if (candleData && candleData.length > 0 && this.candlestickSeries) {
        const formattedData: CandlestickData[] = candleData.map(c => {
          // ✅ Lightweight Charts espera timestamp en SEGUNDOS, no milisegundos
          const candle = {
            time: (c.timestamp / 1000) as Time, // Convertir milisegundos a segundos
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          };
          // console.log('📈 Vela formateada para chart:', candle);
          return candle;
        });

        // console.log('🎯 Total de velas a mostrar:', formattedData.length);
        this.candlestickSeries.setData(formattedData);

        // ✅ Ajustar el zoom para mostrar todos los datos
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
          background: { color: '#1e1e1e' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#2a2e39' },
          horzLines: { color: '#2a2e39' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        }
      });

      // ✅ FORMA CORRECTA de agregar la serie (versiones actuales)
      this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: '#4caf50',
        downColor: '#f44336',
        borderDownColor: '#f44336',
        borderUpColor: '#4caf50',
        wickDownColor: '#f44336',
        wickUpColor: '#4caf50',
      });

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


  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }
}