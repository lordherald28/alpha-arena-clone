import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, ViewChild } from '@angular/core';


import { StoreAppService } from '../../../core/store/store-app.service';
import { BackTestingService } from '../../../core/services/back-testing/back-testing.service';
import { Candlestick } from '../../../core/models';
import { ChartBacktestingComponent } from '../charts/chart-backtesting/chart-backtesting.component';



@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, ChartBacktestingComponent],
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.scss']
})
export class TestComponent implements OnInit {
  // INJECT
  private readonly backtesting = inject(BackTestingService);
  private readonly storeAppService = inject(StoreAppService);

  // ✅ VIEW CHILD para acceder a los métodos del componente de gráfico
  @ViewChild(ChartBacktestingComponent) chartComponent!: ChartBacktestingComponent;

  // SIGNAL (simplificada - ya no necesitas la signal candles)
  public currentIndex = computed(() => this.backtesting.currentIndex() + 1);
  public totalCandles = computed(() => this.backtesting.allCandles().length);
  public hasNext = this.backtesting.hasNext;

  // COMPUTED
  private readonly marketInfo = computed(() => this.storeAppService.marketDataConfig())
  public readonly balance = computed(() => this.storeAppService.paperBalance());

  constructor() {
    // ✅ EFECTO SIMPLIFICADO: Solo pasa la vela al componente de gráfico
    effect(() => {
      const candle = this.backtesting.currentCandle();
      if (candle && this.chartComponent) {
        this.chartComponent.addBacktestingCandle(candle);
      }
    });
  }

  ngOnInit() {
    // Tu lógica de inicialización...
  }

  nextCandle(): void {
    this.backtesting.next();
    // El effect se encargará de actualizar el gráfico automáticamente
  }

  loadData(): void {
    this.backtesting.getHistoricalData(this.marketInfo().market).subscribe(() => {
      // ✅ OPCIONAL: Resetear el gráfico cuando cargas nuevos datos
      this.chartComponent?.resetBacktesting();
    });
  }

}
