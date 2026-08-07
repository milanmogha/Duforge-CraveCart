import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import { Stat, Spinner } from '../components.jsx';

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/rider/dashboard').then(setD); }, []);
  if (!d) return <Spinner />;

  return (
    <>
      <div className="topbar"><h1>Dashboard</h1></div>
      <div className="grid cols-4">
        <Stat label="Today's earnings" value={money(d.today.earning)} sub={`${d.today.deliveries} deliveries today`} />
        <Stat label="This week" value={money(d.week.earning)} sub={`${d.week.deliveries} deliveries`} />
        <Stat label="Wallet balance" value={money(d.walletBalance)} sub={`COD held ${money(d.codHeld)}`} />
        <Stat label="Rating" value={d.rating.count ? `★ ${d.rating.avg}` : '—'} sub={`${d.totalDeliveries} deliveries all-time`} />
      </div>
      <div className="card pad" style={{ marginTop: 18 }}>
        {d.activeCount > 0 ? (
          <>
            <h3 style={{ marginTop: 0 }}>🛵 You have {d.activeCount} active deliver{d.activeCount > 1 ? 'ies' : 'y'}</h3>
            <Link to="/deliveries" className="btn">Go to deliveries →</Link>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>No active deliveries</h3>
            <p className="muted">Check available orders and accept your next delivery.</p>
            <Link to="/deliveries" className="btn">Find orders →</Link>
          </>
        )}
      </div>
    </>
  );
}
