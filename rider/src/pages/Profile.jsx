import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const r = user.riderProfile || {};
  const [form, setForm] = useState({
    vehicleType: r.vehicleType || 'bike', vehicleNumber: r.vehicleNumber || '',
    licenseNumber: r.licenseNumber || '', city: r.city || '',
    bankName: r.bankName || '', bankAccount: r.bankAccount || '', bankIfsc: r.bankIfsc || '',
  });
  const [basic, setBasic] = useState({ name: user.name, phone: user.phone || '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setMsg('');
    try {
      await api('/auth/profile', { method: 'PUT', body: basic });
      const d = await api('/rider/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setMsg('Profile saved ✓');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <div className="topbar"><h1>Profile</h1></div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Personal & vehicle</h3>
          <div className="field"><label>Name</label><input value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={basic.phone} onChange={(e) => setBasic({ ...basic, phone: e.target.value })} /></div>
          <div className="form-row">
            <div className="field"><label>Vehicle type</label>
              <select value={form.vehicleType} onChange={set('vehicleType')}>
                <option value="bike">Bike</option><option value="scooter">Scooter</option>
                <option value="bicycle">Bicycle</option><option value="car">Car</option>
              </select>
            </div>
            <div className="field"><label>Vehicle number</label><input value={form.vehicleNumber} onChange={set('vehicleNumber')} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>License number</label><input value={form.licenseNumber} onChange={set('licenseNumber')} /></div>
            <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
          </div>
        </div>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Bank details (for payouts)</h3>
          <div className="field"><label>Bank name</label><input value={form.bankName} onChange={set('bankName')} /></div>
          <div className="field"><label>Account number</label><input value={form.bankAccount} onChange={set('bankAccount')} /></div>
          <div className="field"><label>IFSC</label><input value={form.bankIfsc} onChange={set('bankIfsc')} /></div>
          {msg && <div className={msg.includes('✓') ? 'success-text' : 'error-text'}>{msg}</div>}
          <button className="btn" onClick={save}>Save profile</button>
        </div>
      </div>
    </>
  );
}
