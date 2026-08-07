import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Stat, Spinner, Chip, BarChart } from '../components.jsx';

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/admin/dashboard').then(setD); }, []);
  if (!d) return <Spinner />;

  return (
    <>
      <div className="topbar"><h1>Dashboard</h1></div>
      <div className="grid cols-4">
        <Stat label="Total sales" value={money(d.totalSales)} sub={`Commission earned ${money(d.totalCommission)}`} />
        <Stat label="Orders" value={d.counts.totalOrders} sub={`${d.counts.todayOrders} today`} />
        <Stat label="Customers" value={d.counts.customers} />
        <Stat label="Products" value={d.counts.products} />
      </div>
      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <Stat label="Partners" value={d.counts.partners} />
        <Stat label="Riders" value={d.counts.riders} />
        <Stat label="Pending KYC" value={d.counts.pendingKyc} sub="Users & KYC page" />
        <Stat label="Pending withdrawals" value={d.counts.pendingWithdrawals} sub="Finance page" />
      </div>

      <div className="grid cols-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Sales — last 14 days</h3>
          <BarChart data={d.daily} />
        </div>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Order status breakdown</h3>
          {Object.entries(d.statusBreakdown).map(([s, c]) => (
            <div key={s} className="spread" style={{ padding: '6px 0' }}>
              <Chip s={s} /><strong>{c}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card pad" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Recent orders</h3>
        <table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Store</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
          <tbody>
            {d.recentOrders.map((o) => (
              <tr key={o._id}>
                <td><strong>{o.orderNumber}</strong></td>
                <td>{o.customer?.name}</td>
                <td>{o.partner?.partnerProfile?.storeName || o.partner?.name}</td>
                <td>{money(o.grandTotal)}</td>
                <td><Chip s={o.status} /></td>
                <td className="muted">{dt(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
