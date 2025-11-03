export const validIntervals = [
    '1min', '3min', '5min', '15min', '30min',
    '1hour', '2hour', '4hour', '6hour', '12hour',
    '1day', '3day', '1week', '1month'
];

export const ActionSubsWS = {
    subscribe: 'state.subscribe',
    unsubscribe: 'state.unsubscribe',
} as const;

export type ActionSubsWSType = typeof ActionSubsWS[keyof typeof ActionSubsWS];

export interface SubscriptionMessage {
    method: ActionSubsWSType; // <-- Un solo método, no un array
    params: { market_list: string[] };  // Los parámetros, como la lista de mercados
    id: number;           // Un ID para identificar la respuesta
}