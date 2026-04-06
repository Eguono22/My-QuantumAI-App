import { API_BASE_URL } from '../utils/constants';

const report = async (payload) => {
  try {
    await fetch(`${API_BASE_URL}/monitoring/frontend-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (_) {
    // Silent by design: monitoring must not break user flows.
  }
};

export const initGlobalErrorMonitoring = () => {
  window.addEventListener('error', (event) => {
    report({
      message: event.message || 'Unhandled error',
      source: event.filename,
      stack: event.error?.stack,
      url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    report({
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      source: 'unhandledrejection',
      stack: reason?.stack,
      url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  });
};
