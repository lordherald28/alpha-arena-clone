// src/app/services/core/order-manager.service.ts

import { Injectable, signal } from '@angular/core';
import { TradingOrder } from '../models';


/**
 * @description Servicio especializado en gestionar las listas de órdenes.
 * Es el único lugar donde la lógica de las órdenes debe ser modificada.
 */
@Injectable({ providedIn: 'root' })
export class OrderManagerService {

    /**
     * Signal que contiene la lista de órdenes abiertas.
     */
    public openOrders = signal<TradingOrder[]>([]);

    /**
     * Signal que contiene la lista de órdenes cerradas.
     */
    public closedOrders = signal<TradingOrder[]>([]);

    /**
     * Signal que contiene el historial completo de todas las órdenes.
     */
    public orderHistory = signal<TradingOrder[]>([]);

    constructor() { }

    /**
     * @description Añade una nueva orden a la lista de órdenes abiertas.
     * @param order La orden a añadir.
     */
    public addOrder(order: TradingOrder): void {
        this.openOrders.update(orders => [...orders, order]);
    }

    /**
     * @description Cierra una lista de órdenes, moviéndolas de abiertas a cerradas/historial.
     * @param ordersToClose La lista de órdenes que deben ser cerradas.
     */
    public closeOrders(ordersToClose: TradingOrder[]): void {
        if (ordersToClose.length === 0) return;

        // 1. Mover las órdenes de abiertas a cerradas/historial
        this.closedOrders.update(closed => [...closed, ...ordersToClose]);
        this.orderHistory.update(history => [...history, ...ordersToClose]);

        // 2. Remover las órdenes cerradas de la lista de abiertas
        this.openOrders.update(openOrders =>
            openOrders.filter(order => !ordersToClose.find(o => o.id === order.id))
        );
    }

    /**
     * @description Reinicia todas las listas de órdenes.
     */
    public reset(): void {
        this.openOrders.set([]);
        this.closedOrders.set([]);
        this.orderHistory.set([]);
    }
}