import { SIGNAL_COLORS, SIGNAL_BG_COLORS, API_BASE_URL, WS_BASE_URL } from './constants';

describe('SIGNAL_COLORS', () => {
  it('defines BUY color', () => {
    expect(SIGNAL_COLORS.BUY).toBe('text-emerald-700');
  });

  it('defines SELL color', () => {
    expect(SIGNAL_COLORS.SELL).toBe('text-red-700');
  });

  it('defines HOLD color', () => {
    expect(SIGNAL_COLORS.HOLD).toBe('text-amber-700');
  });
});

describe('SIGNAL_BG_COLORS', () => {
  it('defines BUY background', () => {
    expect(SIGNAL_BG_COLORS.BUY).toBe('bg-emerald-50 border-emerald-300');
  });

  it('defines SELL background', () => {
    expect(SIGNAL_BG_COLORS.SELL).toBe('bg-red-50 border-red-300');
  });

  it('defines HOLD background', () => {
    expect(SIGNAL_BG_COLORS.HOLD).toBe('bg-amber-50 border-amber-300');
  });
});

describe('API_BASE_URL', () => {
  it('falls back to localhost:8000', () => {
    expect(API_BASE_URL).toBe('http://localhost:8000');
  });
});

describe('WS_BASE_URL', () => {
  it('falls back to ws://localhost:8000', () => {
    expect(WS_BASE_URL).toBe('ws://localhost:8000');
  });
});
