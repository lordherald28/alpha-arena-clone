import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiResponse } from '../../../../core/models';

@Component({
  selector: 'app-ai-response-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-response-panel.component.html',
  styleUrls: ['./ai-response-panel.component.scss']
})
export class AiResponsePanelComponent {
  public aiResponse = input<AiResponse | null>(null);
}