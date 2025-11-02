// src/app/services/core/balance.service.ts

import { Injectable, signal } from '@angular/core';
import { Balance } from '../models';
import { environment } from '../../environments/environment';


/**
 * @description Servicio especializado en gestionar el balance de la cuenta de paper trading.
 * Es el único lugar donde la lógica del balance debe ser modificada.
 */
@Injectable({ providedIn: 'root' })
export class BalanceService {

    /**
     * Signal que contiene el estado completo del balance.
     * Es la única fuente de verdad para el balance dentro del sistema de paper trading.
     */
    public balance = signal<Balance>({
        USDT: environment.paperTrading.initialBalance,
        BTC: 0,
        totalUSDT: environment.paperTrading.initialBalance,
        currency: '',
        available: environment.paperTrading.initialBalance,
        frozen: 0
    });

    constructor() { }

    /**
     * @description Reserva una cantidad de fondos del balance disponible.
     * Se usa cuando se abre una nueva orden.
     * @param amount Cantidad de fondos a reservar.
     */
    public reserveFunds(amount: number): void {
        this.balance.update(b => ({
            ...b,
            available: b.available - amount,
            // totalUSDT no cambia aquí, solo se reserva el margen para la posición.
        }));
    }

    /**
     * @description Libera los fondos de una orden cerrada y aplica el P&L resultante.
     * @param orderAmount Cantidad de fondos que estaban reservados por la orden.
     * @param finalPNL Beneficio o pérdida final de la orden cerrada.
     */
    public closeOrderFunds(orderAmount: number, finalPNL: number): void {
        this.balance.update(b => ({
            ...b,
            available: b.available + orderAmount, // Liberar el margen reservado
            USDT: b.USDT + finalPNL,           // Aplicar el P&L al balance real de USDT
            totalUSDT: b.USDT + finalPNL        // Actualizar el balance total
        }));
    }

    /**
     * @description Actualiza el balance total con el P&L flotante de las órdenes abiertas.
     * Es llamado por un efecto para mostrar el P&L en tiempo real.
     * @param totalPNL El P&L total acumulado de todas las órdenes abiertas.
     */
    public updateRealTimePnL(totalPNL: number): void {
        this.balance.update(b => ({
            ...b,
            totalUSDT: b.USDT + totalPNL
        }));
    }

    /**
     * @description Reinicia el balance a su estado inicial.
     * @param initialBalance El balance inicial a establecer. Por defecto, usa el del environment.
     */
    public reset(initialBalance: number = environment.paperTrading.initialBalance): void {
        this.balance.set({
            USDT: initialBalance,
            BTC: 0,
            totalUSDT: initialBalance,
            currency: '',
            available: initialBalance, // El balance disponible debe ser el inicial al resetear.
            frozen: 0
        });
    }

    /**
     * @description Devuelve el valor actual del signal del balance.
     * @returns El objeto Balance actual.
     */
    public getBalance(): Balance {
        return this.balance();
    }
}