import api from './api';

export const marketService = {
  getOverview: async () => {
    const response = await api.get('/market/overview');
    return response.data;
  },
  getAsset: async (symbol) => {
    const response = await api.get(`/market/${symbol}`);
    return response.data;
  },
  getHistory: async (symbol, days = 30) => {
    const response = await api.get(`/market/${symbol}/history?days=${days}`);
    return response.data;
  },
};
