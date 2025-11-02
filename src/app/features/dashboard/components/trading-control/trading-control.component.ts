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


}