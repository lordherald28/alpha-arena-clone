export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit'
}

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
}

export interface Order {
    id: string;
    side: OrderSide;
    type: OrderType;
    amount: number;
    price: number; // Para órdenes limit
    status: string; // 'filled', 'partial_filled', 'pending', 'cancelled'
    createdAt: Date;
}