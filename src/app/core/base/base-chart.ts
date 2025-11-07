// base-chart.component.ts
import { Component, input, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CandlestickSeries, createChart, IChartApi, ISeriesApi, Time, IPriceLine, LineStyle } from 'lightweight-charts';
import { Subject } from 'rxjs';
import { Candlestick, Market, TradingOrder } from '../../core/models';
import { OrderManagerService } from '../../core/services/helpers/trading/order-manager.service';

@Component({
    template: '', // La plantilla se define en los componentes concretos
    styleUrl:'./charts.component.scss'
})
export abstract class BaseChartComponent implements AfterViewInit, OnDestroy {
    // Inject común
    protected readonly orderManager = inject(OrderManagerService);

    // Inputs comunes
    public candles = input<Candlestick[]>([]);
    public symbol = input<Market>();
    public currentPrice = input<number>(0);

    // Elementos del gráfico comunes
    @ViewChild('chartContainer') chartContainer!: ElementRef;
    protected chart!: IChartApi;
    protected candlestickSeries!: ISeriesApi<'Candlestick'>;
    protected destroy$ = new Subject<void>();

    // Estado común
    protected previousCandlesLength = 0;
    public isUserInteracting = false;
    protected lastVisibleRange: { from: number; to: number } | null = null;
    protected tpSlLines: Map<string, { tpLine: IPriceLine, slLine: IPriceLine }> = new Map();

    // Métodos abstractos que deben implementar las subclases
    abstract ngAfterViewInit(): void;
    abstract ngOnDestroy(): void;

    // Métodos comunes que pueden ser usados o sobrescritos
    protected initializeChart(): void {
        // Lógica común de inicialización del gráfico
        this.chart = createChart(this.chartContainer.nativeElement, {
            width: this.chartContainer.nativeElement.clientWidth,
            height: this.chartContainer.nativeElement.clientHeight || 500,
            layout: {
                background: { color: '#0B0B1B' },
                textColor: '#D9D9D9',
            },
            grid: {
                horzLines: { color: '#2B2B43', visible: true },
                vertLines: { color: '#2B2B43', visible: true }
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#2B2B43',
                barSpacing: 8,
                minBarSpacing: 2,
                fixLeftEdge: false, // ✅ CAMBIADO: Permite desplazamiento libre
                fixRightEdge: false, // ✅ CAMBIADO: Permite desplazamiento libre
                shiftVisibleRangeOnNewBar: false, // ✅ MANTENIDO: Control manual
                rightBarStaysOnScroll: true, // ✅ NUEVO: Mejor comportamiento al desplazar
                borderVisible: true
            },
            crosshair: {
                mode: 1,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true
            }
        })

        this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
            // ... configuración común de series
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            priceScaleId: 'right',
            priceFormat: {
                type: 'price',
                precision: 4,
                minMove: 0.0001
            }
        });

        // ✅ CONFIGURACIÓN MEJORADA DE ESCALA DE PRECIOS
        this.chart.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.08,   // ✅ REDUCIDO: Menos espacio arriba
                bottom: 0.05, // ✅ REDUCIDO: Menos espacio abajo
            },
            borderColor: '#2B2B43',
            autoScale: true, // ✅ NUEVO: Escala automática inteligente
        });

        // ✅ SUSCRIBIRSE A EVENTOS DE INTERACCIÓN DEL USUARIO
        this.chart.timeScale().subscribeVisibleTimeRangeChange((newRange) => {
            if (newRange) {
                this.lastVisibleRange = {
                    from: newRange.from as number,
                    to: newRange.to as number
                };

                // ✅ DETECTAR SI EL USUARIO ESTÁ INTERACTUANDO
                const currentTime = Date.now() / 1000;
                const isAtEnd = Math.abs(currentTime - (newRange.to as number)) < 300; // 5 minutos del final
                this.isUserInteracting = !isAtEnd;

            }
        });

        // ... más configuración común
    }

    protected updateTpSlLines(orders: TradingOrder[]): void {
        // Lógica común para actualizar líneas TP/SL
    }

    protected reactiveTpSlLines(): void {
        // Lógica común para TP/SL reactivo
    }

    public onResize(): void {
        // Lógica común de redimensionamiento
    }
}