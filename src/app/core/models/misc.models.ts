import { Market } from "./info-market.models";

export const validIntervals = [
    '1min', '3min', '5min', '15min', '30min',
    '1hour', '2hour', '4hour', '6hour', '12hour',
    '1day', '3day', '1week', '1month'
];

// export const ActionSubsWS = {
//     subscribe: 'state.subscribe',
//     unsubscribe: 'state.unsubscribe',
//     dealsubscribe: 'deals.subscribe'
// } as const;

// export type ActionSubsWSType = typeof ActionSubsWS[keyof typeof ActionSubsWS];

// export interface SubscriptionMessage {
//     method: ActionSubsWSType; // <-- Un solo método, no un array
//     params: { market_list: string[] };  // Los parámetros, como la lista de mercados
//     id: number;           // Un ID para identificar la respuesta
// }

export interface CoinexStateMsg {
    method: 'state.update';
    data: { market: string; state_list: Array<Market /* { market: string; last: string; mark_price: string; high: string; low: string; } */> };
    id: number | null;
}
export interface CoinexDealsMsg {
    method: 'deals.update';
    data: { market: string; deal_list: Array<{ deal_id: number; created_at: number; side: 'buy' | 'sell'; price: string; amount: string; }> };
    id: number | null;
}