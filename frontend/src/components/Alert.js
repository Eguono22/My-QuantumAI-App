import React from 'react';

export default function Alert({ type = 'info', message, onClose }) {
  const styles = {
    info: 'bg-blue-900 border-blue-500 text-blue-100',
    success: 'bg-green-900 border-green-500 text-green-100',
    error: 'bg-red-900 border-red-500 text-red-100',
    warning: 'bg-yellow-900 border-yellow-500 text-yellow-100',
  };
  const icons = {
    info: 'i',
    success: 'OK',
    error: '!',
    warning: '!',
  };
  return (
    <div className={`border rounded-xl p-4 flex justify-between items-center ${styles[type]} shadow-lg shadow-black/25`}>
      <span className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/40 text-xs font-bold">{icons[type]}</span>
        {message}
      </span>
      {onClose && (
        <button onClick={onClose} className="ml-4 text-slate-300 hover:text-white">✕</button>
      )}
    </div>
  );
}
