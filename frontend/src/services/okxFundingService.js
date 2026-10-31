import api from './api';

const base = '/funding/okx';
export const okxFundingService = {
  status: async () => (await api.get(`${base}/connection`)).data,
  connect: async (payload) => (await api.post(`${base}/connection`, payload)).data,
  disconnect: async (password) => (await api.post(`${base}/disconnect`, { password })).data,
  balances: async () => (await api.get(`${base}/balances`)).data,
  tradingBalances: async () => (await api.get(`${base}/trading-balances`)).data,
  tradingReadiness: async () => (await api.get(`${base}/trading-readiness`)).data,
  spotOrders: async () => (await api.get(`${base}/spot-orders`)).data,
  submitSpotOrder: async payload => (await api.post(`${base}/spot-orders`, payload)).data,
  refreshSpotOrder: async id => (await api.post(`${base}/spot-orders/${id}/refresh`)).data,
  methods: async (kind, currency, action) => (await api.get(`${base}/methods`, { params: { kind, currency, action } })).data,
  deposit: async (kind, currency) => (await api.get(`${base}/deposit`, { params: { kind, currency } })).data,
  history: async (kind, currency) => (await api.get(`${base}/history`, { params: { kind, currency } })).data,
  withdrawals: async () => (await api.get(`${base}/withdrawals`)).data,
  review: async (payload) => (await api.post(`${base}/withdrawals/review`, payload)).data,
  confirm: async (id, password, confirmation) => (await api.post(`${base}/withdrawals/${id}/confirm`, { password, confirmation })).data,
  refresh: async (id) => (await api.post(`${base}/withdrawals/${id}/refresh`)).data,
};
