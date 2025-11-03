import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiResponse } from '../../../../core/models';
import { StoreAppService } from '../../../../core/store/store-app.service';

@Component({
  selector: 'app-ai-response-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-response-panel.component.html',
  styleUrls: ['./ai-response-panel.component.scss']
})
export class AiResponsePanelComponent {
  //inject
  private readonly storeApp = inject(StoreAppService);

  public aiResponse = input<AiResponse | null>(null);

  public aiResponseHist = computed(() => this.storeApp.aiResponseHistory());
  
}