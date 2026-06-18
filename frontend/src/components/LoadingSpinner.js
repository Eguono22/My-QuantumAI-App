import React from 'react';

export default function LoadingSpinner({ size = 'md' }) {
  const sizes = { sm: 'h-5 w-5', md: 'h-10 w-10', lg: 'h-14 w-14' };
  return (
    <div className="flex items-center justify-center p-6">
      <div className="rounded-[24px] border border-white/10 bg-slate-950/70 px-6 py-5 shadow-panel backdrop-blur">
        <div className={`${sizes[size]} animate-spin rounded-full border-[3px] border-slate-700 border-t-cyan-300 border-r-market-yellow`}></div>
      </div>
    </div>
  );
}
