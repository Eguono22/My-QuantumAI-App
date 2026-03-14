export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

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
