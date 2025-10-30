export const environment = {
    production: false,
    // --- CONFIGURA TUS CLaves AQUÍ ---
    coinex: {
        // Para MODO DEMO - usa cantidades MUY pequeñas
        apiKey: '67B9588D3B744755A1FD7BCA62FE3A41',
        apiSecret: '4E63C3DAD4494B8AD52FC391F83F74EA2D6597FAE6CDAE58',
        baseUrl: 'https://api.coinex.com',
        demoAmount: '0.001' // Cantidad para testing
    },
    trading: {
        pair: 'BTCUSDT',
        interval: '5min',
        candleLimit: 700,
    },
    paperTrading: {
        enabled: true, // Cambiar a false para trading real
        initialBalance: 10,
        fee: 0.001, // 0.1%
        defaultRisk: 0.02 // 2%
    },
    glmAi: {
        apiKey: '60e5e8e0f4b34c64b23b59f1e646ed26.IPUU0FrsM6HJTXQF',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    }
};