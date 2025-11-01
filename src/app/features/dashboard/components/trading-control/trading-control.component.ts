// components/trading-control/trading-control.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingLogicService } from '../../../../core/services/trading-logic.service';
import { TradingExecutionService } from '../../../../core/services/trading-execution.service';
import { DESITION } from '../../../../core/utils/const.utils';


@Component({
  selector: 'app-trading-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trading-control.component.html',
  styleUrls: ['./trading-control.scss']
})
export class TradingControlComponent {
  tradingLogic = inject(TradingLogicService);
  tradingExecution = inject(TradingExecutionService);

  startTrading(): void {
    this.tradingLogic.startTrading();
  }

  stopTrading(): void {
    this.tradingLogic.stopTrading();
  }

  refreshBalance(): void {
    this.tradingLogic.refreshBalance();
  }

  buy(): void {
    this.tradingLogic.placeManualOrder(DESITION.BUY, '0.001');
  }

  sell(): void {
    this.tradingLogic.placeManualOrder(DESITION.SELL, '0.001');
  }
}