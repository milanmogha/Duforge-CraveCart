import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';

export default function Store() {
  const { user, setUser } = useAuth();
  const p = user.partnerProfile || {};
  const [form, setForm] = useState({
    storeName: p.storeName || '', description: p.description || '', logo: p.logo || '',
    banner: p.banner || '', address: p.address || '', city: p.city || '',
    cuisineTags: (p.cuisineTags || []).join(', '), openTime: p.openTime || '09:00',
    closeTime: p.closeTime || '22:00', isOpen: p.isOpen ?? true,
    deliveryCharge: p.deliveryCharge ?? 30, freeDeliveryAbove: p.freeDeliveryAbove ?? 500,
    minOrder: p.minOrder ?? 0, bankName: p.bankName || '', bankAccount: p.bankAccount || '', bankIfsc: p.bankIfsc || '',
  });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async () => {
    setMsg('');
    try {
      const d = await api('/partner/store', {
        method: 'PUT',
        body: {
          ...form,
          cuisineTags: form.cuisineTags.split(',').map((t) => t.trim()).filter(Boolean),
          deliveryCharge: Number(form.deliveryCharge),
          freeDeliveryAbove: Number(form.freeDeliveryAbove),
          minOrder: Number(form.minOrder),
        },
      });
      setUser(d.user);
      setMsg('Store settings saved ✓');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <div className="topbar">
        <h1>Store settings</h1>
        <label className="row" style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={form.isOpen} onChange={set('isOpen')} />
          Store is {form.isOpen ? 'OPEN' : 'CLOSED'}
        </label>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Store profile</h3>
          <div className="field"><label>Store name</label><input value={form.storeName} onChange={set('storeName')} /></div>
          <div className="field"><label>Description</label><textarea rows={2} value={form.description} onChange={set('description')} /></div>
          <div className="field"><label>Logo URL</label><input value={form.logo} onChange={set('logo')} /></div>
          <div className="field"><label>Banner URL</label><input value={form.banner} onChange={set('banner')} /></div>
          <div className="form-row">
            <div className="field"><label>Address</label><input value={form.address} onChange={set('address')} /></div>
            <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
          </div>
          <div className="field"><label>Tags (comma separated)</label><input value={form.cuisineTags} onChange={set('cuisineTags')} placeholder="Indian, Biryani…" /></div>
          <div className="form-row">
            <div className="field"><label>Opens at</label><input type="time" value={form.openTime} onChange={set('openTime')} /></div>
            <div className="field"><label>Closes at</label><input type="time" value={form.closeTime} onChange={set('closeTime')} /></div>
          </div>
        </div>
        <div>
          <div className="card pad" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Delivery & pricing</h3>
            <div className="form-row">
              <div className="field"><label>Delivery charge</label><input type="number" value={form.deliveryCharge} onChange={set('deliveryCharge')} /></div>
              <div className="field"><label>Free delivery above</label><input type="number" value={form.freeDeliveryAbove} onChange={set('freeDeliveryAbove')} /></div>
              <div className="field"><label>Min order</label><input type="number" value={form.minOrder} onChange={set('minOrder')} /></div>
            </div>
            <p className="muted">Platform commission: {p.commissionPercent ?? 10}% (set by admin)</p>
          </div>
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Bank details (for payouts)</h3>
            <div className="field"><label>Bank name</label><input value={form.bankName} onChange={set('bankName')} /></div>
            <div className="form-row">
              <div className="field"><label>Account number</label><input value={form.bankAccount} onChange={set('bankAccount')} /></div>
              <div className="field"><label>IFSC</label><input value={form.bankIfsc} onChange={set('bankIfsc')} /></div>
            </div>
          </div>
          {msg && <div className={msg.includes('✓') ? 'success-text' : 'error-text'}>{msg}</div>}
          <button className="btn" style={{ marginTop: 12 }} onClick={save}>Save all settings</button>
        </div>
      </div>
    </>
  );
}
