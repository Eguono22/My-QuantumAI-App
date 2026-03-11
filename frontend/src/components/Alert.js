import React from 'react';

export default function Alert({ type = 'info', message, onClose }) {
  const styles = {
    info: 'bg-blue-900 border-blue-500 text-blue-200',
    success: 'bg-green-900 border-green-500 text-green-200',
    error: 'bg-red-900 border-red-500 text-red-200',
    warning: 'bg-yellow-900 border-yellow-500 text-yellow-200',
  };
  return (
    <div className={`border rounded-lg p-4 flex justify-between items-center ${styles[type]}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white">✕</button>
      )}
    </div>
  );
}
