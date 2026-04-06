import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    const isAuthFailure =
      status === 401 ||
      (status === 403 && (detail === 'Not authenticated' || detail === 'Could not validate credentials'));

    if (isAuthFailure) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      const currentPath = window.location.pathname;
      const isAlreadyOnAuthPage = currentPath === '/login' || currentPath === '/register';
      if (!isAuthEndpoint && !isAlreadyOnAuthPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
