import { Component, computed, effect, inject, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingLogicService } from '../../core/services/trading-logic.service';
import { ControlPanelComponent } from './components/control-panel/control-panel.component';
import { TradingChartComponent } from './components/trading-chart/trading-chart.component';
import { AiResponsePanelComponent } from './components/ai-response-panel/ai-response-panel.component';
import { PaperTradingDashboardComponent } from './components/paper-trading-dashboard/paper-trading-dashboard.component';
import { StoreAppService } from '../../core/store/store-app.service';
import { PaperTradingService } from '../../core/services/paper/paper-trading.service';
import { TestComponent } from "../../shared/components/test/test.component";
import { ChartsComponent } from "../../shared/components/charts/charts/charts.component";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ControlPanelComponent,
    // TradingChartComponent, // TODO: Ver que hacer, eliminar
    // AiResponsePanelComponent, // TODO: Ver que hacer, componente list ai response panel
    PaperTradingDashboardComponent,
    // TestComponent,
    ChartsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  // inject
  private readonly storeServiceMarket = inject(StoreAppService);

  // singal
  public readonly candles = computed(() => this.storeServiceMarket.candles());
  public readonly marketInfo = computed(() => this.storeServiceMarket.MarkInfo());
  // reciboDelHijo($event: string) {
  //   console.log('Mensaje recibido del hijo:', $event);
  // }
  // public candles;
  // public aiResponse;
  public isRunning;
  // public lastUpdate;

  // public readonly currentPriceSymbol = inject(PaperTradingService).currentPriceMarketSymbol();

  constructor(private tradingLogic: TradingLogicService) {
    // this.candles = this.tradingLogic.candles;
    // this.aiResponse = this.tradingLogic.aiResponse;
    this.isRunning = this.tradingLogic.isRunning;
    // ✅ EFECTO para debuggear en Dashboard
    effect(() => {
      const currentCandles = this.candles();
      console.log('📊 Dashboard - Velas en computed:', currentCandles?.length || 0, 'velas');
    });
  }


  // eventoHijo = output<number>();

  ngOnInit(): void {

    // Conectar al mercado deseado


  }

  public startAnalysis(/* market: TypeMarket */): void {
    // console.log('configuracion: ', this.storeServiceMarket.getDataMarket())
    this.tradingLogic.startAnalysis(/* market */);
  }

  public stopAnalysis(): void {
    this.tradingLogic.stopAnalysis();
  }
}