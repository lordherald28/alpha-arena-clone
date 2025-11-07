import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit, Signal, signal, output, inject, input, computed, effect, afterNextRender } from '@angular/core';
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

  // input
  isSelectDisabled = input<boolean>(true);

  // output emitir eventos
  pairChange = output<string>();
  timeframeChange = output<string>();
  limitChange = output<number>();

  private configDataMarket = computed(() => this.storeAppService.getDataMarket());

  // ✅  Inicializar FormControls
  pairControl = new FormControl({ value: '', disabled: this.isSelectDisabled() });
  timeframeControl = new FormControl({ value: '', disabled: this.isSelectDisabled() });
  limitControl = new FormControl({ value: 0, disabled: this.isSelectDisabled() });

  constructor(
    private readonly storeAppService: StoreAppService

  ) {
    this.setupInputReactivity();
  }

  private setupInputReactivity(): void {
    // ✅ EFECTO para isSelectDisabled
    effect(() => {
      const isDisabled = this.isSelectDisabled();
      console.log('🔄 isSelectDisabled cambió:', isDisabled);

      this.updateSelectState(isDisabled);
    });

  }

  private updateSelectState(isDisabled: boolean): void {
    if (isDisabled) {
      this.pairControl.disable();
      this.timeframeControl.disable();
      this.limitControl.disable();
      console.log('🔒 Select deshabilitado');
    } else {
      this.pairControl.enable();
      this.timeframeControl.enable();
      this.limitControl.enable();
      console.log('🔓 Select habilitado');
    }
  }

  ngOnInit() {
    this.cryptoPairs.set([
      'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'LTCUSDT', 'BCHUSDT','BNBUSDT','SUIUSDT',
      'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'XLMUSDT', 'DOGEUSDT', 'SOLUSDT', 'EURUSD'
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
    this.pairControl.setValue(this.configDataMarket().market, { onlySelf: true });
    this.timeframeControl.setValue(this.configDataMarket().interval, { onlySelf: true });
    this.limitControl.setValue(this.configDataMarket().limit, { onlySelf: true });

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
