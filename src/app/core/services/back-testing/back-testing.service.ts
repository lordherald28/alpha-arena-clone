import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { Candlestick } from '../../models';
import { StoreAppService } from '../../store/store-app.service';

@Injectable({
  providedIn: 'root'
})
export class BackTestingService {

  private readonly http = inject(HttpClient);
  private readonly storeApp = inject(StoreAppService);

  private basePath = 'assets/historical-data/forex/1m/';
  // AÑADIR: Mapeo de símbolos a nombres de archivo
  private symbolFileMap: { [key: string]: string } = {
    'eur-usd': 'eurusd', // o el nombre exacto de tu archivo sin extensión
    'eurusd': 'eurusd',  // por si usas diferentes formatos
    // añade más pares según necesites
  };

  // Signals esenciales
  public allCandles = signal<Candlestick[]>([]);
  public currentIndex = signal<number>(-1); // -1 = no empezado

  // Solo esta signal pública para el componente
  public currentCandle = computed(() => {
    const index = this.currentIndex();
    const candles = this.allCandles();
    // console.log('index >= 0 && index < candles.length ? candles[index] 🧑‍💻 ', index >= 0 && index < candles.length ? candles[index] : null);
    // this.storeApp.candles.update((candles) =>{
    //   return [candles[index]];
    // })
    return index >= 0 && index < candles.length ? candles[index] : null;
  });

  public hasNext = computed(() => {
    const index = this.currentIndex();
    const candles = this.allCandles();
    return index < candles.length - 1;
  });

  constructor() { }

  // Cargar datos (sin empezar automáticamente)
  public getHistoricalData(
    symbol: string,
    timeframe?: string,
    from?: Date,
    to?: Date
  ): Observable<void> {
    const filename = this.symbolFileMap[symbol.toLowerCase()];

    if (!filename) {
      console.error(`No hay archivo configurado para el símbolo: ${symbol}`);
      return of(void 0);
    }

    const fullPath = `${this.basePath}${filename}.csv`;
    console.log('Cargando datos desde:', fullPath);

    return this.http.get(fullPath, {
      responseType: 'text'
    }).pipe(
      map((csvData: any) => {
        this.allCandles.set(this.parseCsv(csvData, timeframe, from, to));
      }),
      catchError(error => {
        console.error('Error cargando datos históricos:', error);
        console.error('Ruta intentada:', fullPath);
        return of(void 0);
      })
    );
  }

  // Método para avanzar manualmente
  public next(): void {
    const newIndex = this.currentIndex() + 1;
    if (newIndex < this.allCandles().length) {
      this.currentIndex.set(newIndex);
    }
  }

  // Resetear
  public reset(): void {
    this.currentIndex.set(-1);
  }

  private parseCsv(
    csv: string,
    timeframe?: string,
    from?: Date,
    to?: Date
  ): Candlestick[] {
    const lines = csv.split('\n');
    const startIdx = lines[0].startsWith('Gmt time') ? 1 : 0;
    const all1m: Candlestick[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const row = lines[i].trim();
      if (!row) continue;
      const parts = row.split(',');
      if (parts.length !== 6) continue;

      try {
        const [datePart, timePart] = parts[0].split(' ');
        const [d, m, y] = datePart.split('.').map(Number);
        const [h, mi, s] = timePart.split(':').map(Number);
        const ts = Math.floor(Date.UTC(y, m - 1, d, h, mi, s) / 1000);

        all1m.push({
          timestamp: ts,
          open: parseFloat(parts[1]),
          high: parseFloat(parts[2]),
          low: parseFloat(parts[3]),
          close: parseFloat(parts[4]),
          volume: parseFloat(parts[5]),
        });
      } catch (error) {
        console.warn('Error parseando línea:', row, error);
        continue;
      }
    }

    all1m.sort((a, b) => a.timestamp - b.timestamp);
    return all1m;
  }
}