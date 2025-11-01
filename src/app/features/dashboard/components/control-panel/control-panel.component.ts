import { Component, output, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelMarketSymbolComponent } from "../../../../shared/components/panel-market-symbol/panel-market-symbol.component";
import { TypeMarket } from '../../../../core/models';


@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, PanelMarketSymbolComponent],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent {


  private market = signal<TypeMarket>({
    market: '',
    interval: '',
    limit: 0
  });

  // 1. AÑADE ESTA LÍNEA
  // Creamos una propiedad de entrada para recibir el estado desde el padre.
  // Por defecto, será 'false'.
  public isRunning = input<boolean>(false);
  public start = output<void>();
  public stop = output<void>();

  onPairChange($event: any) {
    this.market.update(m => {
      return { ...m, market: $event }
    });
  }

  onTimeframeChange($event: any) {
    console.log('evento: ', $event);
    this.market.update(m => {
      return { ...m, interval: $event }
    });

  }

  onLimitChange($event: any) {
    this.market.update(m => {
      return { ...m, limit: $event as number }
    });

  }

  onStart(): void {
    this.start.emit(/* this.market() */);
  }

}