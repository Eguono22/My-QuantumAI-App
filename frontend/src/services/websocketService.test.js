import { WebSocketService } from './websocketService';
import { WS_BASE_URL } from '../utils/constants';

describe('WebSocket lifecycle', () => {
  let service;
  let sockets;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    sockets = [];
    global.WebSocket = class {
      static OPEN = 1;
      static CONNECTING = 0;
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.close = jest.fn(() => this.onclose?.());
        sockets.push(this);
      }
    };
    service = new WebSocketService();
  });

  afterEach(() => {
    service.disconnect();
    jest.useRealTimers();
    global.WebSocket = originalWebSocket;
  });

  it('connects once to the complete endpoint', () => {
    service.connect();
    service.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe(WS_BASE_URL);
    expect(sockets[0].url).not.toContain('/ws/ws');
  });

  it('reconnects after an unexpected close', () => {
    service.connect();
    sockets[0].onclose();
    jest.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(2);
  });

  it('cancels scheduled retries when disconnected', () => {
    service.connect();
    sockets[0].onclose();
    service.disconnect();
    jest.runAllTimers();
    expect(sockets).toHaveLength(1);
  });

  it('does not reconnect after an intentional disconnect', () => {
    service.connect();
    service.disconnect();
    jest.runAllTimers();
    expect(sockets).toHaveLength(1);
  });

  it('ignores malformed messages and delivers valid updates', () => {
    const listener = jest.fn();
    service.on('market_update', listener);
    service.connect();
    sockets[0].onmessage({ data: 'invalid' });
    sockets[0].onmessage({ data: 'null' });
    sockets[0].onmessage({ data: JSON.stringify({ type: 'market_update', data: { price: 42 } }) });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ price: 42 });
  });
});
