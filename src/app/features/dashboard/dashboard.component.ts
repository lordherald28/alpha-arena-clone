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
  private tradingExecution = inject(TradingExecutionService)
  constructor(private tradingLogic: TradingLogicService) {
    this.candles = this.tradingLogic.candles;
    this.aiResponse = this.tradingLogic.aiResponse;
    this.isRunning = this.tradingLogic.isRunning;
    this.lastUpdate = this.tradingLogic.lastUpdate;
  }

  eventoHijo = output<number>();
  // En tu componente
  testCoinExAuth() {
    console.log('🧪 Probando autenticación con CoinEx...');

    this.tradingExecution.testAuth().subscribe({
      next: (balance) => {
        console.log('🎉 ¡Autenticación exitosa! Balance:', balance);
      },
      error: (error) => {
        console.error('💥 Error de autenticación:', error);

        // Posibles soluciones según el error
        if (error.error?.code === 25) {
          console.log('🔧 Posibles soluciones:');
          console.log('1. Verifica que las API Keys sean correctas');
          console.log('2. Las keys pueden estar bloqueadas - crea nuevas');
          console.log('3. Revisa el formato del timestamp');
          console.log('4. CoinEx puede tener delays al activar nuevas keys');
        }
      }
    });
  }

  ngOnInit(): void {
    // actualizar el evento que viene del hijo
    this.eventoHijo.subscribe(console.log)
    // Opcional: cargar datos iniciales al arrancar
  }

  public startAnalysis(/* market: TypeMarket */): void {
    this.tradingLogic.startAnalysis(/* market */);
  }

  public stopAnalysis(): void {
    this.tradingLogic.stopAnalysis();
  }
}