export const environment = {
    production: false,
    // --- CONFIGURA TUS CLaves AQUÍ ---
    coinex: {
        apiKey: '67B9588D3B744755A1FD7BCA62FE3A41', // Usa una clave de la cuenta DEMO
        apiSecret: '4E63C3DAD4494B8AD52FC391F83F74EA2D6597FAE6CDAE58',
        baseUrl: 'https://api.coinex.com/v2' // O la URL de demo si es diferente
    },
    glmAi: {
        apiKey: 'TU_API_KEY_DE_GLM-4',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    },
    trading: {
        pair: 'BTCUSDT', // Par de trading por defecto
        interval: '1h',   // Intervalo de velas (1h, 4h, 1d)
        candleLimit: 100  // Cantidad de velas para el análisis
    }
};