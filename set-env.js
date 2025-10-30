const fs = require('fs');
const path = require('path');

// Leer variables de entorno de Vercel
const envContent = `export const environment = {
    production: true,
    coinex: {
        apiKey: '${process.env.CONEX_API_KEY || ''}',
        apiSecret: '${process.env.CONEX_API_SECRET || ''}',
        baseUrl: 'https://api.coinex.com/v1',
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
        apiKey: '${process.env.GLM_API_KEY || ''}',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    }
};`;

// Escribir el archivo environment.prod.ts
fs.writeFileSync(
    path.join(__dirname, 'src/environments/environment.prod.ts'),
    envContent
);

console.log('✅ Environment variables injected for production');