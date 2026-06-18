import React from 'react';

export default function Alert({ type = 'info', message, onClose }) {
  const styles = {
    info: 'bg-sky-50/95 border-sky-300 text-sky-900',
    success: 'bg-emerald-50/95 border-emerald-300 text-emerald-900',
    error: 'bg-red-50/95 border-red-300 text-red-900',
    warning: 'bg-amber-50/95 border-amber-300 text-amber-900',
  };
  const icons = {
    info: 'i',
    success: 'OK',
    error: '!',
    warning: '!',
  };
  return (
    <div className={`flex items-center justify-between gap-4 rounded-[22px] border px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur ${styles[type]}`}>
      <span className="flex items-center gap-3 text-sm font-medium">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-current/30 bg-white/60 text-[11px] font-bold">{icons[type]}</span>
        {message}
      </span>
      {onClose && (
        <button onClick={onClose} className="text-zinc-500 transition hover:text-zinc-900">✕</button>
      )}
    </div>
  );
}
