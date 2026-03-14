import React from 'react';

export default function Alert({ type = 'info', message, onClose }) {
  const styles = {
    info: 'bg-sky-50 border-sky-300 text-sky-800',
    success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
  };
  const icons = {
    info: 'i',
    success: 'OK',
    error: '!',
    warning: '!',
  };
  return (
    <div className={`border rounded-md p-4 flex justify-between items-center ${styles[type]}`}>
      <span className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/40 text-xs font-bold">{icons[type]}</span>
        {message}
      </span>
      {onClose && (
        <button onClick={onClose} className="ml-4 text-zinc-500 hover:text-zinc-900">✕</button>
      )}
    </div>
  );
}
