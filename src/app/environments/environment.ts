export const environment = {
    production: false,
    // --- CONFIGURA TUS CLaves AQUÍ ---
    coinex: {
        apiKey: 'TU_API_KEY_DE_COINEX_DEMO', // Usa una clave de la cuenta DEMO
        apiSecret: 'TU_API_SECRET_DE_COINEX_DEMO',
        baseUrl: 'https://api.coinex.com/v1' // O la URL de demo si es diferente
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