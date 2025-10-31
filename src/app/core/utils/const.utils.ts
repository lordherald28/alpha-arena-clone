export const MINCONFIDENCE: number = 0.7;
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

export const ATR_MULTIPLIER_SL = 1.5;
export const ATR_MULTIPLIER_TP = 2.5;

export enum eRiskRewards {
    TP = 'tp',
    SL = 'sl'
}

export type typeRiskRewards = 'tp' | 'sl' | null;
