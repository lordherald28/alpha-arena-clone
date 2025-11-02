export const environment = {
    production: true,
    coinex: {
        apiKey: '67B9588D3B744755A1FD7BCA62FE3A41',
        apiSecret: '4E63C3DAD4494B8AD52FC391F83F74EA2D6597FAE6CDAE58',
        baseUrl: 'https://api.coinex.com/v2',
        wsUrl:'wss://socket.coinex.com/v2/futures',
        demoAmount: '0.001'
    },
    coinw: {
        apiKey: 'e7d37c9a-ebb5-4265-bedf-bf6f0344c113',
        apiSecret: 'FPOHQEM3GHVWKTNR2TBSZ7SOGLYWQ17VW2SW',
        baseUrl: 'https://api.coinw.com/v1/perpumPublic/klines',
        granularity: 5,
        kline_type: 0
    },
    trading: {
        pair: 'BTCUSDT',
        interval: '5min',
        candleLimit: 1000,
    },
    paperTrading: {
        enabled: true,
        initialBalance: 5000,
        fee: 0.001,
        defaultRisk: 0.05
    },
    glmAi: {
        apiKey: '60e5e8e0f4b34c64b23b59f1e646ed26.IPUU0FrsM6HJTXQF',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    }
};