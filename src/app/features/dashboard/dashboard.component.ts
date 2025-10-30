import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingLogicService } from '../../core/services/trading-logic.service';
import { ControlPanelComponent } from './components/control-panel/control-panel.component';
import { TradingChartComponent } from './components/trading-chart/trading-chart.component';
import { OrdersPanelComponent } from './components/orders-panel/orders-panel.component';
import { AiResponsePanelComponent } from './components/ai-response-panel/ai-response-panel.component';
import { TradingExecutionService } from '../../core/services/trading-execution.service';

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
  private tradingExecution = inject(TradingExecutionService)
  constructor(private tradingLogic: TradingLogicService) {
    this.candles = this.tradingLogic.candles;
    this.aiResponse = this.tradingLogic.aiResponse;
    this.isRunning = this.tradingLogic.isRunning;
    this.lastUpdate = this.tradingLogic.lastUpdate;
  }

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
    // Opcional: cargar datos iniciales al arrancar
  }

  public startAnalysis(): void {
    this.tradingLogic.startAnalysis();
  }

  public stopAnalysis(): void {
    this.tradingLogic.stopAnalysis();
  }
}