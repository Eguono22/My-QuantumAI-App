import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';

const ALPACA_PORTAL = 'https://app.alpaca.markets/';

export default function FundingPanel({ cashBalance, amount, onAmountChange, onPaperFunding, pending = false }) {
  const [realMoney, setRealMoney] = useState(false);
  const [method, setMethod] = useState('broker');

  const toggleMode = () => {
    onAmountChange('');
    setRealMoney(current => !current);
  };

  return (
    <div className="mt-6 border-t border-zinc-200/80 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-900">{realMoney ? 'Real Money Funding' : 'Paper Funding'}</h3>
          <p className="mt-1 text-sm text-zinc-600">{realMoney ? 'Manage deposits and withdrawals' : `Available paper cash: ${formatCurrency(cashBalance)}`}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Real money funding"
          aria-checked={realMoney}
          disabled={pending}
          onClick={toggleMode}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-50"
        >
          <span aria-hidden="true" className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition-colors ${realMoney ? 'bg-emerald-600' : 'bg-zinc-400'}`}>
            <span className={`h-4 w-4 rounded-full bg-white transition-transform ${realMoney ? 'translate-x-5' : 'translate-x-0'}`} />
          </span>
          {realMoney ? 'Real money' : 'Paper funds'}
        </button>
      </div>

      {realMoney ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm text-zinc-700">
            Funding method
            <select value={method} onChange={event => setMethod(event.target.value)} className="market-select mt-2 w-full rounded-xl px-3 py-3">
              <option value="broker">Broker website · Alpaca</option>
              <option value="bank">Bank transfer inside the app</option>
            </select>
          </label>
          {method === 'broker' ? (
            <>
              <p className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
                Continue to Alpaca to deposit or withdraw real money. Sign in to your own live brokerage account and complete the transfer there.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a href={ALPACA_PORTAL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-600 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700">Add real money ↗</a>
                <a href={ALPACA_PORTAL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-amber-600 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-amber-700">Withdraw money ↗</a>
              </div>
              <p className="text-xs text-zinc-500">Both actions open Alpaca in a new tab. Your broker confirms transfer amounts, availability, fees, and completion.</p>
            </>
          ) : (
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-semibold">Bank transfers are not connected yet</p>
              <p className="mt-2">A funding provider, a verified account for each user, and deposit and payout processing must be connected before this option can accept or withdraw money.</p>
              <button type="button" onClick={() => setMethod('broker')} className="mt-3 font-semibold underline">Use broker funding instead</button>
            </div>
          )}
          <p className="text-xs text-zinc-500">This switch changes funding options only. Paper trading stays in paper mode, and the balance shown in this app remains simulated.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Practice deposits and withdrawals with simulated cash. No bank or brokerage transfer occurs.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-zinc-700">
              Paper funding amount
              <input type="number" step="0.01" min="0.01" value={amount} onChange={event => onAmountChange(event.target.value)} disabled={pending} className="market-input mt-2 w-full rounded-xl px-3 py-3" placeholder="0.00" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => onPaperFunding('deposit')} className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{pending ? 'Processing…' : 'Add paper cash'}</button>
              <button type="button" disabled={pending} onClick={() => onPaperFunding('withdraw')} className="rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{pending ? 'Processing…' : 'Remove paper cash'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
