import { WS_BASE_URL } from '../utils/constants';

export class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.shouldReconnect = false;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(this.reconnectTimer);
    try {
      const socket = new WebSocket(WS_BASE_URL);
      this.ws = socket;
      socket.onopen = () => {
        this.reconnectAttempts = 0;
      };
      socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (_error) {
          return;
        }
        if (data && this.listeners[data.type]) {
          this.listeners[data.type].forEach(cb => cb(data.data));
        }
      };
      socket.onerror = (error) => console.error('WebSocket error:', error);
      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    const socket = this.ws;
    this.ws = null;
    if (socket) socket.close();
  }
}

export const wsService = new WebSocketService();
