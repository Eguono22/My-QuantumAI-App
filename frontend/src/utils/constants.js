export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

export const SIGNAL_COLORS = {
  BUY: 'text-green-400',
  SELL: 'text-red-400',
  HOLD: 'text-yellow-400',
};

export const SIGNAL_BG_COLORS = {
  BUY: 'bg-green-900 border-green-500',
  SELL: 'bg-red-900 border-red-500',
  HOLD: 'bg-yellow-900 border-yellow-500',
};
