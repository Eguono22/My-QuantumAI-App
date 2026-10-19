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
  it('uses the configured API base URL', () => {
    expect(API_BASE_URL).toBe('http://127.0.0.1:8011');
  });
});

describe('WS_BASE_URL', () => {
  it('uses the configured websocket base URL', () => {
    expect(WS_BASE_URL).toBe('ws://127.0.0.1:8011/ws');
  });
});

describe('deployment endpoints', () => {
  const originalApi = process.env.REACT_APP_API_URL;
  const originalWs = process.env.REACT_APP_WS_URL;

  afterEach(() => {
    if (originalApi === undefined) delete process.env.REACT_APP_API_URL;
    else process.env.REACT_APP_API_URL = originalApi;
    if (originalWs === undefined) delete process.env.REACT_APP_WS_URL;
    else process.env.REACT_APP_WS_URL = originalWs;
  });

  const loadEndpoints = () => {
    let endpoints;
    jest.isolateModules(() => { endpoints = require('./constants'); });
    return endpoints;
  };

  it('derives the secure websocket endpoint from a hosted API', () => {
    process.env.REACT_APP_API_URL = 'https://example.com/api/';
    delete process.env.REACT_APP_WS_URL;
    expect(loadEndpoints().WS_BASE_URL).toBe('wss://example.com/api/ws');
  });

  it('uses the same origin for the Docker API proxy', () => {
    process.env.REACT_APP_API_URL = '/api';
    delete process.env.REACT_APP_WS_URL;
    expect(loadEndpoints().WS_BASE_URL).toBe(`ws://${window.location.host}/api/ws`);
  });

  it('accepts explicit websocket origins and complete endpoints', () => {
    process.env.REACT_APP_WS_URL = 'wss://stream.example.com';
    expect(loadEndpoints().WS_BASE_URL).toBe('wss://stream.example.com/ws');
    process.env.REACT_APP_WS_URL = 'wss://stream.example.com/api/ws/';
    expect(loadEndpoints().WS_BASE_URL).toBe('wss://stream.example.com/api/ws');
  });
});
