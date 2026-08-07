import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Stat, Spinner, Chip, BarChart } from '../components.jsx';

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/partner/dashboard').then(setD); }, []);
  if (!d) return <Spinner />;

  return (
    <>
      <div className="topbar"><h1>Dashboard</h1></div>
      <div className="grid cols-4">
        <Stat label="Active orders" value={d.activeOrders} sub={`${d.todayOrders} orders today`} />
        <Stat label="Total sales" value={money(d.totalSales)} sub={`${d.totalOrders} orders all-time`} />
        <Stat label="Earnings (after commission)" value={money(d.totalEarning)} sub={`Wallet ${money(d.walletBalance)}`} />
        <Stat label="Rating" value={d.rating.count ? `★ ${d.rating.avg}` : '—'} sub={`${d.rating.count} rating(s) · ${d.productCount} products`} />
      </div>
      <div className="grid cols-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Sales — last 7 days</h3>
          <BarChart data={d.daily} />
        </div>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Recent orders</h3>
          {d.recentOrders.length === 0 && <p className="muted">No orders yet.</p>}
          {d.recentOrders.map((o) => (
            <div key={o._id} className="spread" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong>{o.orderNumber}</strong> <span className="muted">{o.customer?.name}</span>
                <div className="muted">{dt(o.createdAt)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>{money(o.grandTotal)}</strong></div>
                <Chip s={o.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
