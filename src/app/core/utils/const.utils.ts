export const MINCONFIDENCE: number = 0.65;
export const MAX_ORDEN_OPEN: number = 3;
export enum DESITION {
    BUY = 'BUY',
    SELL = 'SELL',
    HOLD = 'HOLD'
}
export enum eSTATUS {
    OPEN = 'open',
    FILLED = 'filled',
    CANCELED = 'canceled',
    CLOSED = 'closed'
}

export const ATR_MULTIPLIER_SL = 0.03;
export const ATR_MULTIPLIER_TP = 0.06;

export enum eRiskRewards {
    TP = 'tp',
    SL = 'sl'
}

export type typeRiskRewards = 'tp' | 'sl' | null;

export const KEY_MARKET_CONFIG_DATA = 'config-data-market';

export const LIMI_OPEN_ORDERS = 3;

export const TICKS = 703;