import { Component, input, effect, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
export class TradingChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  public candles = input<Candlestick[]>([]);

  private chart: IChartApi | undefined;
  private candlestickSeries: ISeriesApi<'Candlestick'> | undefined;

  constructor() {
    effect(() => {
      const candleData = this.candles();
      if (candleData && candleData.length > 0 && this.candlestickSeries) {
        const formattedData: CandlestickData[] = candleData.map(c => ({
          time: (c.timestamp / 1000) as Time, // Lightweight charts espera segundos
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
        }));
        this.candlestickSeries.setData(formattedData);
      }
    });
  }

  ngOnInit(): void {
    if (this.chartContainer) {
      this.chart = createChart(this.chartContainer.nativeElement, {
        width: this.chartContainer.nativeElement.clientWidth,
        height: this.chartContainer.nativeElement.clientHeight,
        layout: {
          background: { color: '#1e1e1e' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#2a2e39' },
          horzLines: { color: '#2a2e39' },
        },
      });
      this.candlestickSeries = this.chart.addSeries(CandlestickSeries,{
        upColor: '#4caf50',
        downColor: '#f44336',
        borderDownColor: '#f44336',
        borderUpColor: '#4caf50',
        wickDownColor: '#f44336',
        wickUpColor: '#4caf50',
      });
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }
}