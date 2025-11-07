import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { BaseChartComponent } from '../../../../core/base/base-chart';
import { Candlestick } from '../../../../core/models';
import { Time } from 'lightweight-charts';
import { ControlPanelComponent } from "../../../../features/dashboard/components/control-panel/control-panel.component";

@Component({
  selector: 'app-chart-backtesting',
  standalone: true,
  imports: [CommonModule, ControlPanelComponent],
  templateUrl: './chart-backtesting.component.html',
  styleUrls: ['./chart-backtesting.component.scss']
})
export class ChartBacktestingComponent extends BaseChartComponent {

  ngOnInit(): void {

  }

  ngAfterViewInit(): void {
    this.initializeChart();
    this.reactiveTpSlLines();
    // NO necesitamos reactiveInputCandlesChart para backtesting
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Limpieza específica de backtesting
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

    // Agregar vela a vela (para ver crecimiento progresivo)
    this.candlestickSeries.update(chartCandle);

    // Auto-scroll para seguir la vela actual
    // this.chart.timeScale().scrollToPosition(-1, false);
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

}
