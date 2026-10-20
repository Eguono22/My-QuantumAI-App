import React, { useEffect, useRef, useState } from 'react';
import { okxFundingService as service } from '../services/okxFundingService';

const fieldClass = 'market-input mt-1 w-full rounded-xl px-3 py-2';
const buttonClass = 'rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-50';
const detail = error => error?.response?.data?.detail || 'The request could not be confirmed. Refresh status before trying again.';

function Field({ label, ...props }) {
  return <label className="block text-sm text-zinc-700">{label}<input className={fieldClass} {...props} /></label>;
}

function History({ history }) {
  if (!history) return null;
  return <div className="space-y-3">{Object.entries(history).map(([action, result]) => (
    <div key={action}>
      <h4 className="font-semibold capitalize text-zinc-900">{action} history</h4>
      {result.error && <p role="status" className="text-sm text-amber-700">{result.error}</p>}
      {!result.error && result.items.length === 0 && <p className="text-sm text-zinc-500">No records returned by OKX.</p>}
      {result.items.map((item, index) => <div key={item.depId || item.wdId || item.ordId || index} className="market-panel-soft mt-2 rounded-xl p-3 text-xs text-zinc-700">
        <p>{item.amt} {item.ccy} · OKX status: {item.state}</p>
        <p className="break-all">ID: {item.depId || item.wdId || item.ordId} {item.chain || item.paymentMethod}</p>
      </div>)}
    </div>
  ))}</div>;
}

function TransferWorkspace({ kind, currency, action, withdrawalsEnabled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [history, setHistory] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [balance, setBalance] = useState(null);
  const [form, setForm] = useState({ amount: '', chain: '', address: '', tag: '', payment_method: '', payment_account_id: '' });
  const [recipient, setRecipient] = useState({ walletType: 'private' });
  const [review, setReview] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [attempted, setAttempted] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const run = async task => {
    if (busy) return;
    setBusy(true); setError('');
    try { await task(); } catch (err) { if (active.current) setError(detail(err)); }
    finally { if (active.current) setBusy(false); }
  };
  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setReview(null); setAttempted(false); };
  const load = () => run(async () => {
    const [methods, deposits, balances, pending] = await Promise.all([
      service.methods(kind, currency, action), action === 'deposit' ? service.deposit(kind, currency) : Promise.resolve(null),
      service.balances(), service.withdrawals(),
    ]);
    if (!active.current) return;
    setOptions(methods); setInstructions(deposits?.instructions || null); setReviews(pending);
    setBalance(balances.find(item => item.ccy === currency)?.availBal || '0');
    setReview(null); setAttempted(false);
  });
  const selectedMethod = options?.find(item => item.paymentMethod === form.payment_method);
  const selectedNetwork = options?.find(item => item.chain === form.chain);
  const reviewWithdrawal = event => {
    event.preventDefault();
    run(async () => {
      const payload = kind === 'crypto'
        ? { kind, currency, amount: form.amount, chain: form.chain, address: form.address.trim(), ...(form.tag ? { tag: form.tag.trim() } : {}), recipient }
        : { kind, currency, amount: form.amount, payment_method: form.payment_method, payment_account_id: form.payment_account_id };
      const result = await service.review(payload);
      if (active.current) { setReview(result); setAttempted(false); setPassword(''); setConfirmation(''); }
    });
  };
  const submit = event => {
    event.preventDefault();
    if (!review || attempted) return;
    run(async () => {
      setAttempted(true);
      try {
        const result = await service.confirm(review.id, password, confirmation);
        if (active.current) { setReview(result); setReviews(await service.withdrawals()); }
      } finally { if (active.current) setPassword(''); }
    });
  };
  const refreshReview = id => run(async () => {
    const updated = await service.refresh(id);
    if (!active.current) return;
    if (review?.id === id) {
      setReview(current => ({ ...current, ...updated }));
      if (updated.status === 'review') setAttempted(false);
    }
    setReviews(await service.withdrawals());
  });

  return <div className="space-y-4">
    <button type="button" className={buttonClass} disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Load OKX funding details'}</button>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {balance !== null && <p className="text-sm text-zinc-700">OKX available funding balance: {balance} {currency}</p>}
    {options?.length === 0 && <p role="status" className="text-sm text-amber-800">OKX returned no {kind === 'cash' ? 'bank payment methods' : 'networks'} for this currency. Availability depends on your account and region.</p>}
    {action === 'deposit' && instructions && <div className="space-y-3">
      <p className="text-sm text-zinc-700">{kind === 'crypto' ? 'Send from your wallet or exchange using the exact network and any required tag/memo below.' : 'OKX returns deposit methods and registered bank accounts below. Confirm the final beneficiary details and any payment reference on OKX before sending from your bank. Loading these details does not debit your bank.'}</p>
      {instructions.length === 0 && <p role="status" className="text-sm text-amber-800">No deposit instructions are available. Check your OKX verification and currency support.</p>}
      {kind === 'crypto' ? instructions.map((item, index) => <div key={`${item.chain}-${index}`} className="market-panel-soft space-y-2 rounded-xl p-3 text-sm text-zinc-900">
        <p className="font-semibold">{item.ccy} · {item.chain}</p>
        <p className="break-all">Address: {item.addr}</p>
        {['tag', 'memo', 'pmtId'].map(key => item[key] ? <p key={key} className="break-all font-semibold">Required {key}: {item[key]}</p> : null)}
        {item.addrEx && Object.entries(item.addrEx).map(([key, value]) => <p key={key} className="break-all font-semibold">Required {key}: {String(value)}</p>)}
        <p>Minimum deposit: {item.minDep || 'Check OKX'} {currency}</p>
        {item.ctAddr && <p>Token contract suffix: {item.ctAddr}</p>}
      </div>) : instructions.map((method, index) => <div key={`${method.paymentMethod}-${index}`} className="market-panel-soft rounded-xl p-3 text-sm text-zinc-900">
        <p className="font-semibold">{method.paymentMethod} · {method.ccy}</p>
        <p>Fee rate: {(Number(method.feeRate || 0) * 100).toFixed(2)}% · Minimum fee: {method.minFee || '0'} {currency}</p>
        <p>Deposit limits: {method.limits?.minAmt || 'Check OKX'}–{method.limits?.maxAmt || 'Check OKX'} {currency}</p>
        {(method.accounts || []).filter(bank => bank.state === 'active').map(bank => <div key={bank.paymentAcctId} className="mt-3 space-y-1 break-all">
          <p>Registered bank: {bank.bankName}</p><p>Recipient: {bank.recipientName}</p><p>Account / IBAN: {bank.acctNum}</p><p>Bank code: {bank.bankCode || 'Not supplied'}</p>
          {bank.reference && <p>Payment reference: {bank.reference}</p>}
        </div>)}
        <p className="mt-2">Confirm the final beneficiary account and payment reference on OKX before sending a bank deposit.</p>
      </div>)}
      {kind === 'cash' && <a href="https://www.okx.com/balance/recharge" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-cyan-700 underline">Confirm bank deposit instructions on OKX ↗</a>}
    </div>}
    {action === 'withdrawal' && !withdrawalsEnabled && <p role="status" className="text-sm text-amber-800">In-app withdrawals are currently disabled by the operator. You can still use the OKX website.</p>}
    {action === 'withdrawal' && withdrawalsEnabled && options?.length > 0 && !review && <form onSubmit={reviewWithdrawal} className="space-y-3">
      <Field label={`Withdrawal amount (${currency})`} value={form.amount} onChange={event => update('amount', event.target.value)} inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" required disabled={busy} />
      {kind === 'crypto' ? <>
        <label className="block text-sm text-zinc-700">Network<select value={form.chain} onChange={event => update('chain', event.target.value)} className={fieldClass} required disabled={busy}>
          <option value="">Select a network</option>{options.filter(item => item.canWd === true).map(item => <option key={item.chain} value={item.chain}>{item.chain} · Fee {item.fee} {currency}</option>)}
        </select></label>
        <Field label="Trusted destination address" value={form.address} onChange={event => update('address', event.target.value)} required disabled={busy} />
        <Field label={selectedNetwork?.needTag ? 'Required tag / memo' : 'Tag / memo (if required)'} value={form.tag} onChange={event => update('tag', event.target.value)} required={selectedNetwork?.needTag === true} disabled={busy} />
        <label className="block text-sm text-zinc-700">Recipient wallet type<select className={fieldClass} value={recipient.walletType} onChange={event => setRecipient({ walletType: event.target.value })} disabled={busy}>
          <option value="private">Private wallet</option><option value="exchange">Exchange wallet</option>
        </select></label>
        <details><summary className="cursor-pointer text-sm text-zinc-700">Recipient details required by your OKX region</summary><div className="mt-2 space-y-2">
          {Object.entries({ exchId: 'Exchange ID (0 if unlisted)', rcvrFirstName: 'Recipient first name', rcvrLastName: 'Recipient last name', rcvrCountry: 'Country code', rcvrCountrySubDivision: 'State / province', rcvrTownName: 'City', rcvrStreetName: 'Street address' }).map(([key, label]) => <Field key={key} label={label} value={recipient[key] || ''} onChange={event => setRecipient(current => ({ ...current, [key]: event.target.value }))} disabled={busy} />)}
        </div></details>
      </> : <>
        <label className="block text-sm text-zinc-700">Bank payment method<select className={fieldClass} value={form.payment_method} onChange={event => setForm(current => ({ ...current, payment_method: event.target.value, payment_account_id: '' }))} required disabled={busy}>
          <option value="">Select payment method</option>{options.map(item => <option key={item.paymentMethod} value={item.paymentMethod}>{item.paymentMethod} · Fee {(Number(item.feeRate || 0) * 100).toFixed(2)}%</option>)}
        </select></label>
        <label className="block text-sm text-zinc-700">Verified destination bank<select className={fieldClass} value={form.payment_account_id} onChange={event => update('payment_account_id', event.target.value)} required disabled={busy}>
          <option value="">Select verified bank</option>{(selectedMethod?.accounts || []).filter(bank => bank.state === 'active').map(bank => <option key={bank.paymentAcctId} value={bank.paymentAcctId}>{bank.bankName} · Ending {bank.acctNum?.slice(-4)}</option>)}
        </select></label>
        <p className="text-xs text-zinc-500">Only active bank accounts already verified with OKX are available. Add or verify banks on OKX first.</p>
      </>}
      <button type="submit" className={buttonClass} disabled={busy}>Review real withdrawal</button>
    </form>}
    {review && <div className="space-y-3 rounded-2xl border border-amber-300 p-4">
      <h4 className="font-semibold text-zinc-900">Withdrawal review · {review.status}</h4>
      <p className="break-all text-xs text-zinc-500">Request: {review.id}</p>
      {review.summary && <dl className="space-y-2 text-sm text-zinc-900">{Object.entries(review.summary).map(([key, value]) => <div key={key}><dt className="capitalize text-zinc-500">{key.replaceAll('_', ' ')}</dt><dd className="break-all font-semibold">{String(value)}</dd></div>)}</dl>}
      {review.status === 'review' && !attempted && <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-amber-900">This requests a real withdrawal from your OKX funding account. Review expires in five minutes. Fees shown are estimates; OKX applies the final fee.</p>
        <Field label="QuantumAI password to confirm withdrawal" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
        <Field label="Type WITHDRAW to confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} pattern="WITHDRAW" required disabled={busy} />
        <button type="submit" className="rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || confirmation !== 'WITHDRAW'}>Confirm real withdrawal</button>
        <button type="button" className={buttonClass} disabled={busy} onClick={() => { setReview(null); setPassword(''); setConfirmation(''); }}>Cancel review</button>
      </form>}
      {attempted && <p className="text-sm text-zinc-700">Refresh this request to confirm its outcome before taking another action.</p>}
      <button type="button" className={buttonClass} disabled={busy} onClick={() => refreshReview(review.id)}>Refresh withdrawal status</button>
    </div>}
    {reviews.length > 0 && <div className="space-y-2"><h4 className="font-semibold text-zinc-900">Recent in-app requests</h4>{reviews.map(item => <div key={item.id} className="market-panel-soft rounded-xl p-3 text-sm text-zinc-700">
      <p>{item.kind} · {item.currency} · {item.status}</p><p className="break-all text-xs">{item.provider_id || item.id}</p>
      <button type="button" disabled={busy} className="mt-2 underline" onClick={() => refreshReview(item.id)}>Refresh status</button>
    </div>)}</div>}
    <button type="button" className={buttonClass} disabled={busy} onClick={() => run(async () => { const result = await service.history(kind, currency); if (active.current) setHistory(result); })}>Load deposit & withdrawal history</button>
    <History history={history} />
  </div>;
}

export default function OKXFundingPanel() {
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState({ api_key: '', secret: '', passphrase: '', password: '', region: 'global' });
  const [kind, setKind] = useState('crypto');
  const [currency, setCurrency] = useState('USDT');
  const [action, setAction] = useState('deposit');
  const [disconnectPassword, setDisconnectPassword] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    service.status().then(result => { if (active.current) setConnection(result); }).catch(err => { if (active.current) setError(detail(err)); });
    return () => { active.current = false; };
  }, []);
  const connect = async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await service.connect(credentials);
      if (active.current) setConnection(result);
    } catch (err) { if (active.current) setError(detail(err)); }
    finally {
      if (active.current) { setBusy(false); setCredentials(current => ({ ...current, api_key: '', secret: '', passphrase: '', password: '' })); }
    }
  };
  return <div className="space-y-4">
    <h3 className="font-semibold text-zinc-900">OKX · In-app funding</h3>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!connection && !error && <p role="status" className="text-sm text-zinc-500">Checking secure OKX connection…</p>}
    {connection && !connection.configured && <p role="status" className="text-sm text-amber-800">Secure OKX account connections need to be enabled by the operator. Use the OKX website until setup is complete.</p>}
    {connection?.configured && !connection.connected && <form onSubmit={connect} className="space-y-3">
      <p className="text-sm text-zinc-700">Connect your own OKX API key. Credentials are encrypted on the server and never saved in browser storage. Read access supports deposit instructions and history; Withdraw permission is required to submit withdrawals.</p>
      <label className="block text-sm text-zinc-700">OKX account region<select className={fieldClass} value={credentials.region} onChange={event => setCredentials(current => ({ ...current, region: event.target.value }))} disabled={busy}>
        <option value="global">Global (okx.com)</option><option value="us">United States / Australia (app.okx.com)</option><option value="eea">European Economic Area (my.okx.com)</option>
      </select></label>
      {Object.entries({ api_key: 'OKX API key', secret: 'OKX API secret', passphrase: 'OKX API passphrase', password: 'QuantumAI password' }).map(([key, label]) => <Field key={key} label={label} type="password" autoComplete={key === 'password' ? 'current-password' : 'off'} value={credentials[key]} onChange={event => setCredentials(current => ({ ...current, [key]: event.target.value }))} required disabled={busy} />)}
      <button type="submit" disabled={busy} className={buttonClass}>{busy ? 'Connecting…' : 'Connect my OKX account'}</button>
    </form>}
    {connection?.connected && <>
      <p className="text-sm text-emerald-700">Your OKX account is connected · {connection.region}</p>
      <label className="block text-sm text-zinc-700">Transfer type<select className={fieldClass} value={kind} onChange={event => { setKind(event.target.value); setCurrency(event.target.value === 'crypto' ? 'USDT' : 'EUR'); }}>
        <option value="crypto">Cryptocurrency</option><option value="cash">Bank / Cash</option>
      </select></label>
      <Field label={kind === 'crypto' ? 'Cryptocurrency code' : 'Cash currency code'} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))} placeholder={kind === 'crypto' ? 'USDT, BTC, ETH' : 'EUR, USD, TRY'} />
      <label className="block text-sm text-zinc-700">Action<select className={fieldClass} value={action} onChange={event => setAction(event.target.value)}>
        <option value="deposit">Deposit</option><option value="withdrawal">Withdraw</option>
      </select></label>
      {/^[A-Z0-9]{2,12}$/.test(currency) && <TransferWorkspace key={`${kind}:${currency}:${action}`} kind={kind} currency={currency} action={action} withdrawalsEnabled={connection.withdrawals_enabled} />}
      <details><summary className="cursor-pointer text-sm text-zinc-500">Disconnect OKX</summary><div className="mt-2 space-y-2">
        <Field label="QuantumAI password to disconnect" type="password" value={disconnectPassword} onChange={event => setDisconnectPassword(event.target.value)} autoComplete="current-password" />
        <button type="button" disabled={busy || !disconnectPassword} className={buttonClass} onClick={async () => {
          setBusy(true); setError('');
          try { await service.disconnect(disconnectPassword); if (active.current) setConnection(await service.status()); }
          catch (err) { if (active.current) setError(detail(err)); }
          finally { if (active.current) { setBusy(false); setDisconnectPassword(''); } }
        }}>Disconnect account</button>
      </div></details>
    </>}
  </div>;
}
