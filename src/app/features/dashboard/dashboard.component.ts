import { Component, inject, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingLogicService } from '../../core/services/trading-logic.service';
import { ControlPanelComponent } from './components/control-panel/control-panel.component';
import { TradingChartComponent } from './components/trading-chart/trading-chart.component';
import { OrdersPanelComponent } from './components/orders-panel/orders-panel.component';
import { AiResponsePanelComponent } from './components/ai-response-panel/ai-response-panel.component';
import { TradingExecutionService } from '../../core/services/trading-execution.service';
import { PaperTradingDashboardComponent } from './components/paper-trading-dashboard/paper-trading-dashboard.component';
import { OrdenListComponent } from "../../shared/components/orden-list/orden-list.component";
import { TypeMarket } from '../../core/models';
import { StoreAppService } from '../../core/store/store-app.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ControlPanelComponent,
    TradingChartComponent,
    AiResponsePanelComponent,
    PaperTradingDashboardComponent,
    OrdenListComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  reciboDelHijo($event: string) {
    console.log('Mensaje recibido del hijo:', $event);
  }
  public candles;
  public aiResponse;
  public isRunning;
  public lastUpdate;
  private readonly storeServiceMarket = inject(StoreAppService);

  constructor(private tradingLogic: TradingLogicService) {
    this.candles = this.tradingLogic.candles;
    this.aiResponse = this.tradingLogic.aiResponse;
    this.isRunning = this.tradingLogic.isRunning;
    this.lastUpdate = this.tradingLogic.lastUpdate;
  }

  eventoHijo = output<number>();

  ngOnInit(): void {
    // actualizar el evento que viene del hijo
    this.eventoHijo.subscribe(console.log)
    // Opcional: cargar datos iniciales al arrancar
  }

  public startAnalysis(/* market: TypeMarket */): void {
    console.log('configuracion: ', this.storeServiceMarket.getDataMarket())
    this.tradingLogic.startAnalysis(/* market */);
  }

  public stopAnalysis(): void {
    this.tradingLogic.stopAnalysis();
  }
}