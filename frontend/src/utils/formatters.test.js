import {
  formatCurrency,
  formatNumber,
  formatLargeNumber,
  formatPercent,
  formatDate,
  getChangeColor,
} from './formatters';

describe('formatCurrency', () => {
  it('formats a positive value with USD symbol', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero as $0.00', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats null as $0.00', () => {
    expect(formatCurrency(null)).toBe('$0.00');
  });

  it('formats undefined as $0.00', () => {
    expect(formatCurrency(undefined)).toBe('$0.00');
  });

  it('formats large values with comma separators', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('respects custom decimal places', () => {
    expect(formatCurrency(1.23456, 'USD', 4)).toBe('$1.2346');
  });
});

describe('formatNumber', () => {
  it('formats a number with 2 decimal places', () => {
    expect(formatNumber(1234.5678)).toBe('1,234.57');
  });

  it('formats null as 0', () => {
    expect(formatNumber(null)).toBe('0');
  });

  it('formats undefined as 0', () => {
    expect(formatNumber(undefined)).toBe('0');
  });

  it('respects custom decimal places', () => {
    expect(formatNumber(3.14159, 4)).toBe('3.1416');
  });
});

describe('formatLargeNumber', () => {
  it('formats trillions', () => {
    expect(formatLargeNumber(1.5e12)).toBe('$1.50T');
  });

  it('formats billions', () => {
    expect(formatLargeNumber(2.75e9)).toBe('$2.75B');
  });

  it('formats millions', () => {
    expect(formatLargeNumber(500e6)).toBe('$500.00M');
  });

  it('formats thousands', () => {
    expect(formatLargeNumber(12500)).toBe('$12.50K');
  });

  it('formats small values as plain dollars', () => {
    expect(formatLargeNumber(99.5)).toBe('$99.50');
  });

  it('formats null as $0.00', () => {
    expect(formatLargeNumber(null)).toBe('$0.00');
  });

  it('formats undefined as $0.00', () => {
    expect(formatLargeNumber(undefined)).toBe('$0.00');
  });
});

describe('formatPercent', () => {
  it('formats a positive percent with + sign', () => {
    expect(formatPercent(5.25)).toBe('+5.25%');
  });

  it('formats zero as 0.00%', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('formats a negative percent without + sign', () => {
    expect(formatPercent(-3.5)).toBe('-3.50%');
  });

  it('formats null as 0.00%', () => {
    expect(formatPercent(null)).toBe('0.00%');
  });

  it('formats undefined as 0.00%', () => {
    expect(formatPercent(undefined)).toBe('0.00%');
  });
});

describe('formatDate', () => {
  it('returns a formatted date string', () => {
    const result = formatDate('2024-01-15T14:30:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getChangeColor', () => {
  it('returns green for positive values', () => {
    expect(getChangeColor(5)).toBe('text-emerald-700');
  });

  it('returns red for negative values', () => {
    expect(getChangeColor(-3)).toBe('text-red-700');
  });

  it('returns gray for zero', () => {
    expect(getChangeColor(0)).toBe('text-zinc-500');
  });
});
