import api from './api';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username: username.trim(), password });
    return response.data;
  },
  register: async (username, email, password) => {
    const response = await api.post('/auth/register', { username: username.trim(), email: email.trim(), password });
    return response.data;
  },
  forgotPassword: async (identifier) => {
    const response = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
    return response.data;
  },
  resetPassword: async (token, password) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  },
};
