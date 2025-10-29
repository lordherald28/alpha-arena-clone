import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingLogicService } from '../../core/services/trading-logic.service';
import { ControlPanelComponent } from './components/control-panel/control-panel.component';
import { TradingChartComponent } from './components/trading-chart/trading-chart.component';
import { OrdersPanelComponent } from './components/orders-panel/orders-panel.component';
import { AiResponsePanelComponent } from './components/ai-response-panel/ai-response-panel.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ControlPanelComponent,
    TradingChartComponent,
    OrdersPanelComponent,
    AiResponsePanelComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  public candles;
  public aiResponse;
  public isRunning;
  public lastUpdate;

  constructor(private tradingLogic: TradingLogicService) {
    this.candles = this.tradingLogic.candles;
    this.aiResponse = this.tradingLogic.aiResponse;
    this.isRunning = this.tradingLogic.isRunning;
    this.lastUpdate = this.tradingLogic.lastUpdate;
  }

  ngOnInit(): void {
    // Opcional: cargar datos iniciales al arrancar
  }

  public startAnalysis(): void {
    this.tradingLogic.startAnalysis();
  }

  public stopAnalysis(): void {
    this.tradingLogic.stopAnalysis();
  }
}