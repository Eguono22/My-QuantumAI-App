import api from './api';

export const tradingService = {
  getSignals: async () => {
    const response = await api.get('/trading/signals');
    return response.data;
  },
  generateSignals: async () => {
    const response = await api.post('/trading/signals/generate');
    return response.data;
  },
  getPortfolio: async () => {
    const response = await api.get('/portfolio');
    return response.data;
  },
  executeTrade: async (asset, action, quantity, price) => {
    const response = await api.post('/portfolio/trade', { asset, action, quantity, price });
    return response.data;
  },
  getPerformance: async () => {
    const response = await api.get('/portfolio/performance');
    return response.data;
  },
};
