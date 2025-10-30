export const environment = {
    production: false,
    coinex: {
        apiKey: '',
        apiSecret: '',
        baseUrl: 'https://api.coinex.com/v2',
        demoAmount: '0.001'
    },
    trading: {
        pair: 'BTCUSDT',
        interval: '5min',
        candleLimit: 1000,
    },
    paperTrading: {
        enabled: true,
        initialBalance: 10,
        fee: 0.001,
        defaultRisk: 0.02
    },
    glmAi: {
        apiKey: '',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    }
};