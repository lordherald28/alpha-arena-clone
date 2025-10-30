const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { market, type, limit } = req.query;

  try {
    const response = await fetch(
      `https://api.coinex.com/v1/market/kline?market=${market}&type=${type}&limit=${limit || 100}`,
      {
        headers: {
          'X-COINEX-ACCESS-KEY': process.env.CONEX_API_KEY || ''
        }
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};