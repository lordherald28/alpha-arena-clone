export const environment = {
    production: false,
    coinex: {
        apiKey: '',
        apiSecret: '',
        baseUrl: 'https://api.coinex.com/v2',
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
        initialBalance: 10,
        fee: 0.001,
        defaultRisk: 0.02
    },
    glmAi: {
        apiKey: '60e5e8e0f4b34c64b23b59f1e646ed26.IPUU0FrsM6HJTXQF',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    }
};