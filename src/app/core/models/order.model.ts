export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit'
}

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
}

// export interface Order {
//     id: string;
//     side: OrderSide;
//     type: OrderType;
//     amount: number;
//     price: number; // Para órdenes limit
//     status: string; // 'filled', 'partial_filled', 'pending', 'cancelled'
//     createdAt: Date;
// }

export interface Balance {
    currency: string;
    available: string;
    frozen: string;
}

export interface Order {
    order_id: string;
    market: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    amount: string;
    price: string;
    status: 'pending' | 'filled' | 'canceled' | 'partial_filled';
    created_at: number;
}

// models/trading.model.ts
export interface TradingOrder {
    id: string;
    market: string;
    side: 'BUY' | 'SELL';
    type: 'market' | 'limit';
    amount: number;
    price: number; // Precio de ejecución
    timestamp: number;
    status: 'open' | 'filled' | 'canceled' | 'closed';
    tp?: number;   // Take Profit
    sl?: number;   // Stop Loss
    closePrice?: number;
    pnl?: number;  // Profit/Loss
    closeReason?: 'tp' | 'sl' | 'manual';
}

export interface PaperBalance {
    USDT: number;
    BTC: number;
    totalUSDT: number; // Valor total en USDT
}

export interface PaperTradingConfig {
    initialBalance: number;
    fee: number; // Comisión (ej: 0.001 para 0.1%)
    defaultRiskPercent: number; // % de riesgo por operación
}