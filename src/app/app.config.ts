import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { PaperTradingService } from './core/services/paper/paper-trading.service';
import { GlmAiService } from './core/services/ai-analysis/glm-ai.service';
import { GlmAiGeneralService } from './core/services/ai-analysis/gml-ai-general.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: 'ITradingService', useClass: PaperTradingService },
    { provide: 'IAService', useClass: GlmAiGeneralService },
  ]
};
