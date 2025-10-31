import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit, Signal, signal, output } from '@angular/core';

type TimeFrame = { label: string, value: string };

@Component({
  selector: 'app-panel-market-symbol',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './panel-market-symbol.component.html',
  styleUrls: ['./panel-market-symbol.component.scss']
})
export class PanelMarketSymbolComponent implements OnInit {

  // ✅  Inicializar FormControls
  pairControl = new FormControl('BTCUSDT');
  timeframeControl = new FormControl('5min');
  limitControl = new FormControl(1000);

  cryptoPairs = signal<string[]>(['']);
  timeframes = signal<TimeFrame[]>([{ label: '', value: '' }]);
  candleLimits = signal<number[]>([]);

  // output emitir eventos
  pairChange = output<string>();
  timeframeChange = output<string>();
  limitChange = output<number>();

  constructor() { }

  ngOnInit() {
    this.cryptoPairs.set([
      'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'LTCUSDT', 'BCHUSDT',
      'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'XLMUSDT', 'DOGEUSDT'
    ]);

    this.timeframes.set([
      { label: '1 Minuto', value: '1min' },
      { label: '5 Minutos', value: '5min' },
      { label: '15 Minutos', value: '15min' },
      { label: '30 Minutos', value: '30min' },
      { label: '1 Hora', value: '1h' },
      { label: '4 Horas', value: '4h' },
      { label: '1 Día', value: '1day' },
      { label: '1 Semana', value: '1week' }
    ]);

    this.candleLimits.set([50, 100, 200, 500, 1000]);
  }

  oncAcceptConfMarket(): void {

    this.pairChange.emit(this.pairControl.value ? this.pairControl.value : 'BTCUSDT');
    if (this.timeframeControl.value) {
      this.timeframeChange.emit(this.timeframeControl.value);
    }
    if (this.limitControl.value) {
      this.limitChange.emit(this.limitControl.value)
    }
  }

}
