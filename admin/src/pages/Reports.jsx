import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { Spinner, Chip, Empty } from '../components.jsx';

export default function Reports() {
  const [tab, setTab] = useState('sales');
  return (
    <>
      <div className="topbar"><h1>Reports</h1></div>
      <div className="tabs">
        <button className={tab === 'sales' ? 'on' : ''} onClick={() => setTab('sales')}>Sales & inventory</button>
        <button className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>Payment statistics</button>
      </div>
      {tab === 'sales' ? <SalesInventory /> : <PaymentStats />}
    </>
  );
}

function DateFilters({ from, to, setFrom, setTo, onApply }) {
  return (
    <div className="filters" style={{ marginBottom: 14 }}>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <button className="btn gray sm" onClick={onApply}>Apply</button>
    </div>
  );
}

function SalesInventory() {
  const [rows, setRows] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api(`/admin/reports/sales-inventory?${q}`).then((d) => setRows(d.rows));
  };
  useEffect(() => { load(); }, []);

  if (!rows) return <Spinner />;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  return (
    <>
      <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
      <p className="muted">{rows.length} products · total item revenue {money(totalRevenue)}</p>
      {rows.length === 0 ? <Empty text="No sales in this period." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Product</th><th>Units sold</th><th>Orders</th><th>Revenue</th><th>Stock left</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id || r.title}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.unitsSold}</td>
                  <td>{r.orders}</td>
                  <td>{money(r.revenue)}</td>
                  <td style={{ color: r.product && r.product.stock <= (r.product.lowStockAlert ?? 5) ? 'var(--red)' : undefined }}>
                    {r.product ? r.product.stock : '—'}
                  </td>
                  <td>{r.product ? <Chip s={r.product.status} /> : <span className="muted">deleted</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PaymentStats() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api(`/admin/reports/payment-stats?${q}`).then(setData);
  };
  useEffect(() => { load(); }, []);

  if (!data) return <Spinner />;
  return (
    <>
      <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} onApply={load} />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <table className="table">
            <thead><tr><th colSpan={3}>By payment method (live orders)</th></tr></thead>
            <tbody>
              {data.byMethod.map((m) => (
                <tr key={m._id}>
                  <td style={{ textTransform: 'capitalize' }}><strong>{m._id}</strong></td>
                  <td>{m.orders} orders</td>
                  <td>{money(m.total)}</td>
                </tr>
              ))}
              {data.byMethod.length === 0 && <tr><td className="muted">No orders in this period.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <table className="table">
            <thead><tr><th colSpan={3}>By order status</th></tr></thead>
            <tbody>
              {data.byStatus.map((s) => (
                <tr key={s._id}>
                  <td><Chip s={s._id} /></td>
                  <td>{s.orders} orders</td>
                  <td>{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
