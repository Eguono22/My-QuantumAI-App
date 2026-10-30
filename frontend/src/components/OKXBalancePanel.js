import React, { useEffect, useRef, useState } from 'react';
import { okxFundingService as service } from '../services/okxFundingService';

// Preserve OKX's decimal strings, including small crypto balances.
const amount = value => value === '' || value === null || value === undefined ? '—' : value;

export default function OKXBalancePanel() {
  const [accounts, setAccounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const loading = useRef(false);
  const refresh = async () => {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    const results = await Promise.allSettled([
      service.balances(), service.tradingBalances(),
    ]);
    if (active.current) {
      setAccounts(results.map(result => result.status === 'fulfilled'
        ? { data: result.value, updated: new Date().toLocaleTimeString() }
        : { error: result.reason?.response?.data?.detail || 'Could not load balance. Check your OKX connection and Read permission, then refresh.' }));
      setBusy(false);
    }
    loading.current = false;
  };
  useEffect(() => {
    active.current = true;
    refresh();
    return () => { active.current = false; };
    // Load once when a connected account mounts; subsequent loads are explicit.
  }, []);

  return <section aria-label="Real OKX balances" className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="font-semibold text-zinc-900">Real OKX balances</h4>
        <p className="text-xs text-zinc-600">Balances from your connected OKX account, separate from the paper-trading portfolio.</p></div>
      <button type="button" disabled={busy} onClick={refresh} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-50">{busy ? 'Refreshing balances…' : 'Refresh balances'}</button>
    </div>
    {busy && <p role="status" className="text-sm text-zinc-600">Loading current balances from OKX…</p>}
    {accounts?.map((account, index) => {
      const trading = index === 1;
      const rows = trading ? account.data?.[0]?.details || [] : account.data || [];
      return <div key={index} className="space-y-2">
        <h5 className="font-semibold text-zinc-900">{trading ? 'Trading account' : 'Funding account'}</h5>
        {account.error ? <p role="alert" className="text-sm text-red-700">{account.error}</p> : <>
          {trading && <p className="text-sm text-zinc-700">Trading equity (USD estimate): <strong>{amount(account.data?.[0]?.totalEq)}</strong></p>}
          {rows.length === 0 ? <p className="text-sm text-zinc-600">OKX returned no balances for this account.</p> : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-800">
              <caption className="sr-only">{trading ? 'Trading' : 'Funding'} balances by currency</caption>
              <thead><tr><th scope="col" className="py-2 pr-4">Currency</th><th scope="col" className="py-2 pr-4">{trading ? 'Equity' : 'Balance'}</th><th scope="col" className="py-2 pr-4">Available</th><th scope="col" className="py-2">Frozen</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.ccy} className="border-t border-emerald-100"><th scope="row" className="py-2 pr-4">{row.ccy}</th><td className="py-2 pr-4">{amount(trading ? row.eq : row.bal)}</td><td className="py-2 pr-4">{amount(row.availBal)}</td><td className="py-2">{amount(row.frozenBal)}</td></tr>)}</tbody>
            </table>
          </div>}
          <p className="text-xs text-zinc-500">Last refreshed: {account.updated}{busy ? ' · Updating…' : ''}</p>
        </>}
      </div>;
    })}
    <p className="text-xs text-zinc-600">Funding and trading are shown separately. Earn products and other subaccounts are not included. Trading equity includes positions and is not a withdrawable cash balance.</p>
  </section>;
}
