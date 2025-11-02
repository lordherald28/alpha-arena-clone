export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit'
}

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
}

export interface TypeMarket {
    market: string;
    interval: string;
    limit: number;
}

export interface Balance {
    currency: string;
    available: number;
    frozen: number;
    USDT: number;
    BTC: number;
    totalUSDT: number;
}

export interface TradingOrder {
    id: string;
    market: string;
    side: 'BUY' | 'SELL' | 'HOLD';
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

export interface PaperTradingConfig {
    initialBalance: number;
    fee: number; // Comisión (ej: 0.001 para 0.1%)
    defaultRiskPercent: number; // % de riesgo por operación
}