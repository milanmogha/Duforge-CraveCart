import { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './ctx.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Users from './pages/Users.jsx';
import Catalog from './pages/Catalog.jsx';
import Marketing from './pages/Marketing.jsx';
import Finance from './pages/Finance.jsx';
import Reports from './pages/Reports.jsx';
import Support from './pages/Support.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  ['/', '📊', 'Dashboard'],
  ['/orders', '📦', 'Orders'],
  ['/users', '👥', 'Users & KYC'],
  ['/catalog', '🗂️', 'Catalog'],
  ['/marketing', '📣', 'Marketing'],
  ['/finance', '💰', 'Finance'],
  ['/reports', '📈', 'Reports'],
  ['/support', '🎫', 'Support'],
  ['/settings', '⚙️', 'Settings'],
];

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await login(email, password); } catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="card auth-box">
      <h1>CRAVECART <em style={{ color: 'var(--brand)', fontStyle: 'normal' }}>Admin</em></h1>
      <p className="muted">Platform operator console</p>
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <div className="error-text">{err}</div>}
        <button className="btn block">Login</button>
      </form>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Demo: admin@cravecart.com / admin123</p>
    </div>
  );
}

function Shell() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  if (user.role !== 'admin') return <Navigate to="/" />;
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/logo.png" alt="CraveCart" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <span>Dapi<em>GO</em> Admin</span>
        </div>
        <nav>
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div className="foot">
          <div>{user.name}</div>
          <a style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={logout}>Logout</a>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/users" element={<Users />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/support" element={<Support />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
