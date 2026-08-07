import { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './ctx.jsx';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Deliveries from './pages/Deliveries.jsx';
import Wallet from './pages/Wallet.jsx';
import Profile from './pages/Profile.jsx';

const NAV = [
  ['/', '📊', 'Dashboard'],
  ['/deliveries', '🛵', 'Deliveries'],
  ['/wallet', '💰', 'Earnings'],
  ['/profile', '👤', 'Profile'],
];

function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', vehicleType: 'bike', vehicleNumber: '', city: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register({ ...form, role: 'rider' });
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="card auth-box">
      <h1>DAPIGO <em style={{ color: 'var(--brand)', fontStyle: 'normal' }}>Rider</em></h1>
      <p className="muted">{mode === 'login' ? 'Deliver orders, earn per delivery + tips.' : 'Join the fleet — start after KYC approval.'}</p>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <>
            <div className="field"><label>Full name</label><input required value={form.name} onChange={set('name')} /></div>
            <div className="form-row">
              <div className="field"><label>Vehicle</label>
                <select value={form.vehicleType} onChange={set('vehicleType')}>
                  <option value="bike">Bike</option><option value="scooter">Scooter</option>
                  <option value="bicycle">Bicycle</option><option value="car">Car</option>
                </select>
              </div>
              <div className="field"><label>Vehicle number</label><input value={form.vehicleNumber} onChange={set('vehicleNumber')} /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
              <div className="field"><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
            </div>
          </>
        )}
        <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label>Password</label><input type="password" required minLength={6} value={form.password} onChange={set('password')} /></div>
        {err && <div className="error-text">{err}</div>}
        <button className="btn block">{mode === 'login' ? 'Login' : 'Register as rider'}</button>
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 14 }}>
        {mode === 'login' ? 'New rider? ' : 'Have an account? '}
        <a style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Register' : 'Login'}
        </a>
      </p>
      {mode === 'login' && <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Demo: rider@dapigo.com / rider123</p>}
    </div>
  );
}

function OnlineToggle() {
  const { user, setUser } = useAuth();
  const isOnline = user.riderProfile?.isOnline;
  const toggle = async () => {
    const d = await api('/rider/status', { method: 'PUT', body: { isOnline: !isOnline } });
    setUser({ ...user, riderProfile: { ...user.riderProfile, isOnline: d.isOnline } });
  };
  return (
    <button className={`btn block ${isOnline ? 'green' : 'gray'}`} style={{ margin: '0 0 10px' }} onClick={toggle}>
      {isOnline ? '🟢 Online — receiving orders' : '⚪ Offline — tap to go online'}
    </button>
  );
}

function Shell() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  const kyc = user.riderProfile?.kycStatus;
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/logo.png" alt="DapiGO" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <span>Dapi<em>GO</em> Rider</span>
        </div>
        <div style={{ padding: '0 14px' }}><OnlineToggle /></div>
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
        {kyc !== 'approved' && (
          <div className="card pad" style={{ marginBottom: 18, borderLeft: '4px solid #d97706', background: '#fffbeb' }}>
            {kyc === 'rejected'
              ? `❌ Your KYC was rejected${user.riderProfile?.kycRejectReason ? ': ' + user.riderProfile.kycRejectReason : ''}.`
              : '⏳ Your rider account is pending admin approval. Deliveries unlock after approval.'}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
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
