const hasWindow = typeof window !== 'undefined';
const hostname = hasWindow ? window.location.hostname : '';
const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
const wsProtocol = hasWindow && window.location.protocol === 'https:' ? 'wss' : 'ws';

export const API_BASE_URL = process.env.REACT_APP_API_URL || (isLocalDev ? 'http://localhost:8000' : '/api');
export const WS_BASE_URL = process.env.REACT_APP_WS_URL || (hasWindow ? (isLocalDev ? 'ws://localhost:8000' : `${wsProtocol}://${window.location.host}/ws`) : 'ws://localhost:8000');

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
