export interface ResponseMarketInformation {
    code: number;
    data: /* state_list |  */deal_list;
    message: string;
}

export interface Market {
    market: string;
    last: string;
    open: string;
    close: string;
    high: string;
    low: string;
    volume: string;
    volume_sell: string;
    volume_buy: string;
    value: string;
    index_price: string;
    mark_price: string;
    open_interest_volume: string;
    period: number;
}

export interface state_list {
    state_list: Market[];
}
export interface deal_list {
    deal_list: {
        amount: string;
        created_at: number;
        deal_id: number;
        price: string
        side: string
    };
}