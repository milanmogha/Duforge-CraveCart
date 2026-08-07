import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

export default function Promos() {
  const [promos, setPromos] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: '', perUserLimit: 1, usageLimit: 0 });
  const [err, setErr] = useState('');

  const load = () => api('/partner/promos').then((d) => setPromos(d.promos));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr('');
    try {
      await api('/partner/promos', { method: 'POST', body: { ...form, maxDiscount: form.maxDiscount || undefined } });
      setModal(false); load();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (p) => { await api(`/partner/promos/${p._id}`, { method: 'PUT', body: { active: !p.active } }); load(); };
  const del = async (id) => { await api(`/partner/promos/${id}`, { method: 'DELETE' }); load(); };

  if (!promos) return <Spinner />;
  return (
    <>
      <div className="topbar">
        <h1>Promo codes</h1>
        <button className="btn" onClick={() => setModal(true)}>+ New promo</button>
      </div>
      <p className="muted">Codes here apply only to orders from your store.</p>
      {promos.length === 0 ? <Empty icon="🎟️" text="No promos yet." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.code}</strong><div className="muted">{p.description}</div></td>
                  <td>{p.type === 'percent' ? `${p.value}%` : money(p.value)}{p.maxDiscount ? ` (max ${money(p.maxDiscount)})` : ''}</td>
                  <td>{money(p.minOrder)}</td>
                  <td>{p.usedCount}{p.usageLimit ? `/${p.usageLimit}` : ''}</td>
                  <td><Chip s={p.active ? 'active' : 'suspended'} /></td>
                  <td>
                    <div className="row">
                      <button className="btn gray sm" onClick={() => toggle(p)}>{p.active ? 'Disable' : 'Enable'}</button>
                      <button className="btn danger sm" onClick={() => del(p._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title="New promo code" onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="field"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div className="field"><label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="percent">Percent off</option><option value="flat">Flat off</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="form-row">
            <div className="field"><label>Value</label><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
            <div className="field"><label>Min order</label><input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} /></div>
            <div className="field"><label>Max discount</label><input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value ? Number(e.target.value) : '' })} /></div>
          </div>
          {err && <div className="error-text">{err}</div>}
          <button className="btn block" onClick={save} disabled={!form.code || !form.value}>Create promo</button>
        </Modal>
      )}
    </>
  );
}
