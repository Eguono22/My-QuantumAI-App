import React, { useEffect, useRef, useState } from 'react';
import { tradingService } from '../services/tradingService';
import { okxFundingService as okx } from '../services/okxFundingService';
import OKXFundingPanel from './OKXFundingPanel';

const inputClass = 'market-input mt-1 w-full rounded-xl px-3 py-2';
const buttonClass = 'rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50';
const errorText = error => error?.response?.data?.detail || 'Request could not be confirmed. Check the order at your broker before trying again.';

function Ticket({ broker }) {
  const [readiness, setReadiness] = useState(null);
  const [readinessVersion, setReadinessVersion] = useState(0);
  const [form, setForm] = useState({ asset: broker === 'okx' ? 'BTC-USDC' : 'AAPL', side: 'buy', quantity: '', price: '', password: '', confirmation: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [result, setResult] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const active = useRef(true);
  const submitting = useRef(false);
  const clientId = useRef(null);
  useEffect(() => {
    active.current = true;
    const load = async () => {
      try {
        const status = broker === 'okx' ? await okx.tradingReadiness() : await tradingService.getStartupHealth();
        if (active.current) setReadiness(broker === 'okx' ? status : {
          ready: status.trading?.trading_mode === 'live' && status.trading?.broker_provider === 'alpaca' && status.trading?.broker_ready,
          confirmation: status.live_trading?.live_manual_confirmation_text || 'LIVE',
          reason: status.trading?.reason,
        });
        if (broker === 'okx') {
          const recent = await okx.spotOrders();
          if (active.current) setOrders(recent);
        }
      } catch (err) { if (active.current) setError(errorText(err)); }
    };
    load();
    return () => { active.current = false; };
  }, [broker, readinessVersion]);
  const confirmation = readiness?.confirmation || 'LIVE';
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    if (submitting.current || attempted || !readiness?.ready) return;
    submitting.current = true; setBusy(true); setError(''); setAttempted(true);
    try {
      let response;
      if (broker === 'okx') {
        clientId.current = crypto.randomUUID().replaceAll('-', '');
        response = await okx.submitSpotOrder({ client_id: clientId.current, instrument: form.asset, side: form.side, quantity: form.quantity, price: form.price, confirmation: form.confirmation, password: form.password });
      } else {
        response = await tradingService.executeTrade(form.asset, form.side, Number(form.quantity), Number(form.price), {
          expected_mode: 'live', order_type: 'LIMIT', manual_confirmation: true,
          confirmation_text: form.confirmation, operator_note: form.note,
        });
      }
      if (active.current) {
        setResult(response);
        if (broker === 'okx') setOrders(current => [response, ...current.filter(order => order.id !== response.id)]);
      }
    } catch (err) { if (active.current) setError(errorText(err)); }
    finally {
      submitting.current = false;
      if (active.current) { setBusy(false); setForm(current => ({ ...current, password: '', confirmation: '' })); }
    }
  };
  const refresh = async id => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await okx.refreshSpotOrder(id);
      if (active.current) {
        setOrders(current => [response, ...current.filter(order => order.id !== response.id)]);
        if (result?.id === id) setResult(response);
      }
    } catch (err) { if (active.current) setError(errorText(err)); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  };
  const status = result?.status || result?.order?.status;
  return <div className="space-y-5">
    <h2 className="text-xl font-bold text-zinc-900">Real {broker === 'okx' ? 'OKX spot' : 'Alpaca'} trading</h2>
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">These orders use real funds. Switching modes does not place an order. Limit orders may remain open until filled or canceled at your broker.</p>
    {!readiness && !error && <p role="status">Checking live trading readiness…</p>}
    <button type="button" className={buttonClass} disabled={busy} onClick={() => { setReadiness(null); setError(''); setReadinessVersion(current => current + 1); }}>Refresh trading readiness</button>
    {readiness && !readiness.ready && <p role="status" className="text-sm text-amber-800">{broker === 'okx' ? (!readiness.connected ? 'Connect your OKX account below.' : 'The operator must enable live trading before real orders can be submitted.') : readiness.reason || 'Alpaca live execution must be configured and enabled by the operator.'}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={busy || attempted || !readiness?.ready} className="contents">
        <label className="text-sm">{broker === 'okx' ? 'Spot pair (USDC or USDT)' : 'Asset'}<input required className={inputClass} value={form.asset} onChange={e => change('asset', e.target.value.toUpperCase())} pattern={broker === 'okx' ? '[A-Z0-9]{2,12}-(USDC|USDT)' : '[A-Z0-9./-]+'} /></label>
        <label className="text-sm">Side<select className={inputClass} value={form.side} onChange={e => change('side', e.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
        <label className="text-sm">Quantity (base asset)<input required className={inputClass} inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" value={form.quantity} onChange={e => change('quantity', e.target.value)} /></label>
        <label className="text-sm">Limit price ({broker === 'okx' ? form.asset.split('-')[1] || 'quote currency' : 'USD'})<input required className={inputClass} inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" value={form.price} onChange={e => change('price', e.target.value)} /></label>
        {broker === 'okx' ? <label className="text-sm">QuantumAI password<input required type="password" autoComplete="current-password" className={inputClass} value={form.password} onChange={e => change('password', e.target.value)} /></label> : <label className="text-sm">Reason for this live trade<input required className={inputClass} value={form.note} onChange={e => change('note', e.target.value)} /></label>}
        <label className="text-sm">Type {confirmation} to confirm<input required className={inputClass} value={form.confirmation} onChange={e => change('confirmation', e.target.value)} /></label>
        <p className="text-sm sm:col-span-2">Review: {form.side.toUpperCase()} {form.quantity || '—'} {form.asset} at a limit price of {form.price || '—'}. {broker === 'okx' ? `Maximum order value: ${readiness?.max_notional ?? '—'} in quote currency. Trade permission and funds in your OKX trading account are required.` : 'Uses the live Alpaca account configured by your operator and existing live risk limits.'}</p>
        <button type="submit" disabled={form.confirmation !== confirmation} className="rounded-xl bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? 'Submitting…' : `Submit real ${form.side} limit order`}</button>
      </fieldset>
    </form>
    {result && <p role="status" className="text-sm">Broker order status: <strong>{status || 'unknown'}</strong>. {status === 'filled' || status === 'FILLED' ? 'Broker reports a fill.' : 'An accepted request does not confirm a fill.'}</p>}
    {attempted && <div className="space-y-2"><p className="text-sm">Check the order status before starting another order. An uncertain request may already have reached the broker.</p>
      {broker === 'okx' && clientId.current && <button className={buttonClass} disabled={busy} onClick={() => refresh(clientId.current)}>Check submitted order</button>}
      <button className={buttonClass} disabled={busy} onClick={() => { setAttempted(false); setResult(null); clientId.current = null; setForm(current => ({ ...current, quantity: '', price: '', confirmation: '', password: '' })); }}>Start a new order</button>
    </div>}
    {broker === 'okx' && orders.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Recent real OKX orders</h3>{orders.map(order => <div key={order.id} className="rounded-xl border border-zinc-200 p-3 text-sm"><p>{order.side} {order.quantity} {order.instrument} · {order.status}</p><p>Filled quantity: {order.filled_quantity || '—'}</p><p className="break-all">Request: {order.id}</p><button className={buttonClass} disabled={busy} onClick={() => refresh(order.id)}>Refresh order status</button></div>)}</div>}
    <a className="inline-block text-sm font-semibold text-cyan-700 underline" href={broker === 'okx' ? 'https://my.okx.com/trade-spot' : 'https://app.alpaca.markets/'} target="_blank" rel="noopener noreferrer">Manage orders and cancellations on {broker === 'okx' ? 'OKX' : 'Alpaca'} ↗</a>
    {broker === 'okx' && <OKXFundingPanel />}
  </div>;
}

export default function RealTradingPanel() {
  const [broker, setBroker] = useState('okx');
  return <section className="market-panel rounded-[28px] p-6 space-y-5">
    <label className="block text-sm font-semibold">Real trading broker<select className={inputClass} value={broker} onChange={e => setBroker(e.target.value)}><option value="okx">OKX · Connected account</option><option value="alpaca">Alpaca · Operator live account</option></select></label>
    <Ticket key={broker} broker={broker} />
  </section>;
}
