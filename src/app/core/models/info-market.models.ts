export interface ResponseMarketInformation {
    code: number
    data: Market[]
    message: string
}

export interface Market {
    market: string
    last: string
    open: string
    close: string
    high: string
    low: string
    volume: string
    volume_sell: string
    volume_buy: string
    value: string
    index_price: string
    mark_price: string
    open_interest_volume: string
    period: number
}
