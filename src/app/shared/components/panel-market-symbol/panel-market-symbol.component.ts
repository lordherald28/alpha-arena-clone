import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit, Signal, signal, output, inject } from '@angular/core';
import { TypeMarket } from '../../../core/models';
import { PaperTradingService } from '../../../core/services/paper/paper-trading.service';
import { CoinexService } from '../../../core/services/coinex/coinex.service';
import { StoreAppService } from '../../../core/store/store-app.service';

type TimeFrame = { label: string, value: string };

@Component({
  selector: 'app-panel-market-symbol',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './panel-market-symbol.component.html',
  styleUrls: ['./panel-market-symbol.component.scss']
})
export class PanelMarketSymbolComponent implements OnInit {

  cryptoPairs = signal<string[]>(['']);
  timeframes = signal<TimeFrame[]>([{ label: '', value: '' }]);
  candleLimits = signal<number[]>([]);

  // output emitir eventos
  pairChange = output<string>();
  timeframeChange = output<string>();
  limitChange = output<number>();

  private configDataMarket!: TypeMarket;

  // ✅  Inicializar FormControls
  pairControl = new FormControl('');
  timeframeControl = new FormControl('');
  limitControl = new FormControl(0);

  constructor(
    private readonly storeAppService: StoreAppService

  ) {
    this.configDataMarket = this.storeAppService.getDataMarket();
  }

  ngOnInit() {
    this.cryptoPairs.set([
      'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'LTCUSDT', 'BCHUSDT',
      'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'XLMUSDT', 'DOGEUSDT'
    ]);

    this.timeframes.set([
      { label: '1 Minuto', value: '1min' },
      { label: '5 Minutos', value: '5min' },
      { label: '3 Minutos', value: '3min' },
      { label: '15 Minutos', value: '15min' },
      { label: '30 Minutos', value: '30min' },
      { label: '1 Hora', value: '1hour' },
      { label: '4 Horas', value: '4hour' },
      { label: '1 Día', value: '1day' },
      { label: '1 Semana', value: '1week' }
    ]);

    this.candleLimits.set([50, 100, 200, 500, 1000]);
    // set information to form controls
    this.pairControl.setValue(this.configDataMarket.market, { onlySelf: true });
    this.timeframeControl.setValue(this.configDataMarket.interval, { onlySelf: true });
    this.limitControl.setValue(this.configDataMarket.limit, { onlySelf: true });
  }

  oncAcceptConfMarket(): void {
    if (this.pairControl.value) {
      this.pairChange.emit(this.pairControl.value);
    }
    if (this.timeframeControl.value) {
      this.timeframeChange.emit(this.timeframeControl.value);
    }
    if (this.limitControl.value) {
      this.limitChange.emit(this.limitControl.value)
    }

    const marketData: TypeMarket = {
      interval: this.timeframeControl.value ? this.timeframeControl.value : '5min',
      limit: this.limitControl.value ? this.limitControl.value : 1000,
      market: this.pairControl.value ? this.pairControl.value : 'BTCUSDT'
    }

    this.storeAppService.setDataMarket(marketData);
  }

}
