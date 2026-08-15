import { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './ctx.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Products from './pages/Products.jsx';
import Catalog from './pages/Catalog.jsx';
import DineIn from './pages/DineIn.jsx';
import Promos from './pages/Promos.jsx';
import Wallet from './pages/Wallet.jsx';
import Store from './pages/Store.jsx';

const NAV = [
  ['/', '📊', 'Dashboard'],
  ['/orders', '📦', 'Orders'],
  ['/products', '🍽️', 'Products'],
  ['/catalog', '🧾', 'Catalog setup'],
  ['/dinein', '🍽️', 'Dine-in & POS'],
  ['/promos', '🎟️', 'Promo codes'],
  ['/wallet', '💰', 'Wallet'],
  ['/store', '🏪', 'Store settings'],
];

function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', storeName: '', city: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register({ ...form, role: 'partner' });
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="card auth-box">
      <h1>CRAVECART <em style={{ color: 'var(--brand)', fontStyle: 'normal' }}>Partner</em></h1>
      <p className="muted">{mode === 'login' ? 'Manage your store, orders and earnings.' : 'Register your store — go live after KYC approval.'}</p>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <>
            <div className="field"><label>Owner name</label><input required value={form.name} onChange={set('name')} /></div>
            <div className="field"><label>Store name</label><input required value={form.storeName} onChange={set('storeName')} /></div>
            <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
          </>
        )}
        <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label>Password</label><input type="password" required minLength={6} value={form.password} onChange={set('password')} /></div>
        {err && <div className="error-text">{err}</div>}
        <button className="btn block">{mode === 'login' ? 'Login' : 'Register store'}</button>
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 14 }}>
        {mode === 'login' ? 'New here? ' : 'Have an account? '}
        <a style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Register your store' : 'Login'}
        </a>
      </p>
      {mode === 'login' && <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Demo: partner@cravecart.com / partner123</p>}
    </div>
  );
}

function Shell() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  const kyc = user.partnerProfile?.kycStatus;
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/logo.png" alt="CraveCart" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <span>Crave<em>Cart</em> Partner</span>
        </div>
        <nav>
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div className="foot">
          <div>{user.partnerProfile?.storeName}</div>
          <a style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={logout}>Logout</a>
        </div>
      </aside>
      <main className="main">
        {kyc !== 'approved' && (
          <div className="card pad" style={{ marginBottom: 18, borderLeft: '4px solid #d97706', background: '#fffbeb' }}>
            {kyc === 'rejected'
              ? `❌ Your KYC was rejected${user.partnerProfile?.kycRejectReason ? ': ' + user.partnerProfile.kycRejectReason : ''}. Update your store details and contact support.`
              : '⏳ Your store is pending admin approval. You can set up your profile, but products and orders unlock after approval.'}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/products" element={<Products />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/dinein" element={<DineIn />} />
          <Route path="/promos" element={<Promos />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/store" element={<Store />} />
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
