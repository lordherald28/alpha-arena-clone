import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { CoinexService } from './core/services/coinex/coinex.service';
import { PaperTradingService } from './core/services/paper/paper-trading.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: 'ITradingService', useClass: PaperTradingService }
  ]
};
