import api from './api';

export const tradingService = {
  getStartupHealth: async () => {
    const response = await api.get('/health/startup');
    return response.data;
  },
  getSignals: async () => {
    const response = await api.get('/trading/signals');
    return response.data;
  },
  generateSignals: async () => {
    const response = await api.post('/trading/signals/generate');
    return response.data;
  },
  executeHFT: async (asset, cycles, quantity, spread_bps) => {
    const response = await api.post('/trading/hft/execute', { asset, cycles, quantity, spread_bps });
    return response.data;
  },
  getPortfolio: async () => {
    const response = await api.get('/portfolio');
    return response.data;
  },
  executeTrade: async (asset, action, quantity, price, options = {}) => {
    const payload = { asset, action, quantity, price, ...options };
    const response = await api.post('/portfolio/trade', payload);
    return response.data;
  },
  getPerformance: async () => {
    const response = await api.get('/portfolio/performance');
    return response.data;
  },
  getWatchlist: async () => {
    const response = await api.get('/trading/watchlist');
    return response.data;
  },
  addWatchlistItem: async (symbol) => {
    const response = await api.post('/trading/watchlist', { symbol });
    return response.data;
  },
  removeWatchlistItem: async (itemId) => {
    const response = await api.delete(`/trading/watchlist/${itemId}`);
    return response.data;
  },
  getPriceAlerts: async (includeTriggered = true) => {
    const response = await api.get(`/trading/alerts?include_triggered=${includeTriggered}`);
    return response.data;
  },
  createPriceAlert: async (symbol, condition, targetPrice) => {
    const response = await api.post('/trading/alerts', { symbol, condition, target_price: targetPrice });
    return response.data;
  },
  removePriceAlert: async (alertId) => {
    const response = await api.delete(`/trading/alerts/${alertId}`);
    return response.data;
  },
  runSignalBacktest: async (asset, days, startingCapital, riskPerTradePct) => {
    const response = await api.post('/trading/backtest', {
      asset,
      days,
      starting_capital: startingCapital,
      risk_per_trade_pct: riskPerTradePct,
    });
    return response.data;
  },
  getOrders: async () => {
    const response = await api.get('/trading/orders');
    return response.data;
  },
  pollOrders: async () => {
    const response = await api.post('/trading/orders/poll', {});
    return response.data;
  },
  cancelOrder: async (orderId) => {
    const response = await api.delete(`/trading/orders/${orderId}`);
    return response.data;
  },
  getMql5Status: async () => {
    const response = await api.get('/trading/mql5/status');
    return response.data;
  },
  analyzeMql5Automation: async (payload) => {
    const response = await api.post('/trading/mql5/automation/analyze', payload);
    return response.data;
  },
  executeMql5Automation: async (payload) => {
    const response = await api.post('/trading/mql5/automation/execute', payload);
    return response.data;
  },
};
