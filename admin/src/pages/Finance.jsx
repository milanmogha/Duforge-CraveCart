import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Empty } from '../components.jsx';

export default function Finance() {
  const [tab, setTab] = useState('withdrawals');
  return (
    <>
      <div className="topbar"><h1>Finance</h1></div>
      <div className="tabs">
        <button className={tab === 'withdrawals' ? 'on' : ''} onClick={() => setTab('withdrawals')}>Withdrawal requests</button>
        <button className={tab === 'transactions' ? 'on' : ''} onClick={() => setTab('transactions')}>Transactions</button>
        <button className={tab === 'returns' ? 'on' : ''} onClick={() => setTab('returns')}>Returns</button>
        <button className={tab === 'transfers' ? 'on' : ''} onClick={() => setTab('transfers')}>Fund transfers</button>
      </div>
      {tab === 'withdrawals' && <Withdrawals />}
      {tab === 'transactions' && <Transactions />}
      {tab === 'returns' && <Returns />}
      {tab === 'transfers' && <FundTransfers />}
    </>
  );
}

function Returns() {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState('pending');

  const load = () => api(`/admin/returns${status ? `?status=${status}` : ''}`).then((d) => setItems(d.items));
  useEffect(() => { setItems(null); load(); }, [status]);

  const act = async (id, action) => {
    const note = action === 'reject' ? prompt('Reason for declining?') || '' : '';
    if (action === 'approve' && !confirm('Approve return? The full order amount is refunded to the customer wallet and earnings are reversed.')) return;
    try {
      await api(`/admin/returns/${id}`, { method: 'PUT', body: { action, adminNote: note } });
      load();
    } catch (e) { alert(e.message); }
  };

  if (!items) return <Spinner />;
  return (
    <>
      <div className="filters" style={{ marginBottom: 14 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option><option value="approved">Approved</option>
          <option value="rejected">Rejected</option><option value="">All</option>
        </select>
      </div>
      {items.length === 0 ? <Empty text="No return requests." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Requested</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id}>
                  <td><strong>{r.order?.orderNumber}</strong><div className="muted">{r.order?.paymentMethod}</div></td>
                  <td>{r.customer?.name}<div className="muted">{r.customer?.email}</div></td>
                  <td>{money(r.order?.grandTotal)}</td>
                  <td style={{ maxWidth: 260 }}>{r.reason}</td>
                  <td className="muted">{dt(r.createdAt)}</td>
                  <td><Chip s={r.status} /></td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="row">
                        <button className="btn sm" onClick={() => act(r._id, 'approve')}>Approve</button>
                        <button className="btn danger sm" onClick={() => act(r._id, 'reject')}>Decline</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FundTransfers() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ email: '', amount: '', note: '' });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/admin/fund-transfers').then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);

  const send = async () => {
    setErr(''); setMsg('');
    try {
      // look the user up by email so admins don't need raw ids
      const found = await api(`/admin/users?search=${encodeURIComponent(form.email)}&limit=1`);
      const user = (found.users || []).find((u) => u.email === form.email);
      if (!user) throw new Error('No user with that exact email');
      await api('/admin/fund-transfers', { method: 'POST', body: { userId: user._id, amount: Number(form.amount), note: form.note } });
      setMsg(`Transferred ₹${Math.abs(Number(form.amount))} ${Number(form.amount) > 0 ? 'to' : 'from'} ${user.name} ✓`);
      setForm({ email: '', amount: '', note: '' });
      load();
    } catch (e) { setErr(e.message); }
  };

  if (!items) return <Spinner />;
  return (
    <>
      <div className="card pad" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginTop: 0 }}>New fund transfer</h3>
        <p className="muted">Credit (positive) or debit (negative) any user's wallet — partner payout corrections, penalties, goodwill credits.</p>
        <div className="form-row">
          <div className="field"><label>User email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" /></div>
          <div className="field"><label>Amount (₹, negative = debit)</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="field"><label>Note</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Why?" /></div>
        {err && <div className="error-text">{err}</div>}
        {msg && <div className="success-text">{msg}</div>}
        <button className="btn" onClick={send} disabled={!form.email || !form.amount}>Transfer</button>
      </div>
      {items.length === 0 ? <Empty text="No fund transfers yet." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Note</th><th>When</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td><strong>{t.user?.name}</strong><div className="muted">{t.user?.email} · {t.user?.role}</div></td>
                  <td><Chip s={t.type === 'credit' ? 'active' : 'suspended'} /></td>
                  <td>{money(t.amount)}</td>
                  <td className="muted">{t.note}</td>
                  <td className="muted">{dt(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Withdrawals() {
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState('pending');

  const load = () => api(`/admin/withdrawals${status ? `?status=${status}` : ''}`).then((d) => setItems(d.withdrawals));
  useEffect(() => { setItems(null); load(); }, [status]);

  const act = async (id, action) => {
    const note = action === 'reject' ? prompt('Reason for rejection?') || '' : '';
    try {
      await api(`/admin/withdrawals/${id}`, { method: 'PUT', body: { action, adminNote: note } });
      load();
    } catch (e) { alert(e.message); }
  };

  if (!items) return <Spinner />;
  return (
    <>
      <div className="filters" style={{ marginBottom: 14 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option><option value="approved">Approved</option>
          <option value="rejected">Rejected</option><option value="">All</option>
        </select>
      </div>
      {items.length === 0 ? <Empty text="No withdrawal requests." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Amount</th><th>Wallet</th><th>Requested</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w._id}>
                  <td><strong>{w.user?.name}</strong><div className="muted">{w.user?.email}</div></td>
                  <td>{w.user?.role}</td>
                  <td><strong>{money(w.amount)}</strong></td>
                  <td>{money(w.user?.walletBalance)}</td>
                  <td className="muted">{dt(w.createdAt)}</td>
                  <td><Chip s={w.status} />{w.adminNote && <div className="muted">{w.adminNote}</div>}</td>
                  <td>
                    {w.status === 'pending' && (
                      <div className="row">
                        <button className="btn green sm" onClick={() => act(w._id, 'approve')}>Approve</button>
                        <button className="btn danger sm" onClick={() => act(w._id, 'reject')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Transactions() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => { api(`/admin/transactions?page=${page}`).then(setData); }, [page]);
  if (!data) return <Spinner />;
  return (
    <>
      <div className="card">
        <table className="table">
          <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Source</th><th>Balance after</th><th>When</th></tr></thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t._id}>
                <td><strong>{t.user?.name}</strong><div className="muted">{t.user?.role}</div></td>
                <td><Chip s={t.type} /></td>
                <td style={{ color: t.type === 'credit' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {t.type === 'credit' ? '+' : '−'}{money(t.amount)}
                </td>
                <td>{t.source.replaceAll('_', ' ')}<div className="muted">{t.note}</div></td>
                <td>{money(t.balanceAfter)}</td>
                <td className="muted">{dt(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {Array.from({ length: Math.min(data.pages, 15) }, (_, i) => (
            <button key={i} className={`btn sm ${page === i + 1 ? '' : 'gray'}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
        </div>
      )}
    </>
  );
}
