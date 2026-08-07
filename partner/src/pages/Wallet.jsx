import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { Spinner, Chip, Empty } from '../components.jsx';

export default function Wallet() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [withdrawals, setWithdrawals] = useState(null);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => Promise.all([
    api('/wallet').then(setData),
    api('/wallet/withdrawals').then((d) => setWithdrawals(d.withdrawals)),
  ]);
  useEffect(() => { load(); }, []);
  if (!data || !withdrawals) return <Spinner />;

  const requestWithdrawal = async () => {
    setMsg('');
    try {
      await api('/wallet/withdrawals', { method: 'POST', body: { amount: Number(amount) } });
      setAmount('');
      await load(); await refresh();
      setMsg('Withdrawal requested ✓ — pending admin review');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <div className="topbar"><h1>Wallet & payouts</h1></div>
      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start' }}>
        <div>
          <div className="card pad" style={{ textAlign: 'center', marginBottom: 16 }}>
            <div className="muted">Available balance</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--brand)' }}>{money(data.balance)}</div>
            <hr className="divider" />
            <div className="row">
              <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
              <button className="btn sm" onClick={requestWithdrawal} disabled={!amount}>Withdraw</button>
            </div>
            {msg && <div className={msg.includes('✓') ? 'success-text' : 'error-text'}>{msg}</div>}
          </div>
          <div className="card pad">
            <h4 style={{ marginTop: 0 }}>Withdrawal requests</h4>
            {withdrawals.length === 0 && <p className="muted">None yet.</p>}
            {withdrawals.map((w) => (
              <div key={w._id} className="spread" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{money(w.amount)}</strong>
                  <div className="muted">{dt(w.createdAt)}</div>
                </div>
                <Chip s={w.status} />
              </div>
            ))}
          </div>
        </div>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Transactions</h3>
          {data.transactions.length === 0 ? <Empty text="No transactions yet." /> : data.transactions.map((t) => (
            <div key={t._id} className="spread" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong style={{ textTransform: 'capitalize' }}>{t.source.replaceAll('_', ' ')}</strong>
                <div className="muted">{dt(t.createdAt)}{t.note ? ` · ${t.note}` : ''}</div>
              </div>
              <strong style={{ color: t.type === 'credit' ? 'var(--green)' : 'var(--red)' }}>
                {t.type === 'credit' ? '+' : '−'}{money(t.amount)}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
