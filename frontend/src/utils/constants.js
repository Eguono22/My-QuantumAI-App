const hasWindow = typeof window !== 'undefined';
const hostname = hasWindow ? window.location.hostname : '';
const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
const globalConfig = hasWindow && window.globalConfig ? window.globalConfig : {};

export const API_BASE_URL = process.env.REACT_APP_API_URL || globalConfig.apiBaseUrl || (isLocalDev ? 'http://127.0.0.1:8011' : '/api');
const apiUrl = new URL(API_BASE_URL, hasWindow ? window.location.origin : 'http://localhost');
const defaultWsUrl = `${apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiUrl.host}${apiUrl.pathname.replace(/\/$/, '')}/ws`;
const configuredWsUrl = process.env.REACT_APP_WS_URL || globalConfig.wsBaseUrl || defaultWsUrl;
export const WS_BASE_URL = /\/ws$/.test(configuredWsUrl.replace(/\/$/, ''))
  ? configuredWsUrl.replace(/\/$/, '')
  : `${configuredWsUrl.replace(/\/$/, '')}/ws`;
export const APP_VERSION = globalConfig.appVersion || '1.0.0';
export const APP_ENVIRONMENT = globalConfig.environment || (isLocalDev ? 'development' : 'production');
export const SUPPORTED_LANGUAGES = globalConfig.supportedLanguages || ['en'];

export const SIGNAL_COLORS = {
  BUY: 'text-emerald-700',
  SELL: 'text-red-700',
  HOLD: 'text-amber-700',
};

export const SIGNAL_BG_COLORS = {
  BUY: 'bg-emerald-50 border-emerald-300',
  SELL: 'bg-red-50 border-red-300',
  HOLD: 'bg-amber-50 border-amber-300',
};
