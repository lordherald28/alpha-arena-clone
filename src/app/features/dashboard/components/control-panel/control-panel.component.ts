import { Component, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent {

  // 1. AÑADE ESTA LÍNEA
  // Creamos una propiedad de entrada para recibir el estado desde el padre.
  // Por defecto, será 'false'.
  public isRunning = input<boolean>(false);
  public start = output<void>();
  public stop = output<void>();
}