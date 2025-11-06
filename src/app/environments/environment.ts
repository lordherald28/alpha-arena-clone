export const environment = {
    production: false,
    coinex: {
        apiKey: '',
        apiSecret: '',
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
        initialBalance: 100,
        fee: 0.001,
        defaultRisk: 0.03
    },
    glmAi: {
        apiKey: '7b9ad9add7af400e8f600a6e9c240934.S5BbL9Xq7S7vdMHN',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        localUrl:'http://localhost:11434',
    },
    deepseek:{
        apiKey:'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',
        url:'https://api.deepseek.com'
    }
};