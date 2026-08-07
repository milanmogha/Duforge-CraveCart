import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

export default function Marketing() {
  const [tab, setTab] = useState('promos');
  return (
    <>
      <div className="topbar"><h1>Marketing</h1></div>
      <div className="tabs">
        {[['promos', 'Promo codes'], ['sliders', 'Sliders'], ['offers', 'Offers'], ['sections', 'Featured sections'], ['cities', 'Cities'], ['broadcast', 'Broadcast']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'promos' && <Promos />}
      {tab === 'sliders' && <Banners kind="sliders" />}
      {tab === 'offers' && <Banners kind="offers" />}
      {tab === 'sections' && <Sections />}
      {tab === 'cities' && <Cities />}
      {tab === 'broadcast' && <Broadcast />}
    </>
  );
}

function Promos() {
  const [promos, setPromos] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: '', usageLimit: 0, perUserLimit: 1 });
  const [err, setErr] = useState('');

  const load = () => api('/admin/promos').then((d) => setPromos(d.promos));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr('');
    try {
      await api('/admin/promos', { method: 'POST', body: { ...form, maxDiscount: form.maxDiscount || undefined } });
      setModal(false); load();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (p) => { await api(`/admin/promos/${p._id}`, { method: 'PUT', body: { active: !p.active } }); load(); };
  const del = async (id) => { await api(`/admin/promos/${id}`, { method: 'DELETE' }); load(); };

  if (!promos) return <Spinner />;
  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => setModal(true)}>+ New promo</button>
      <div className="card">
        <table className="table">
          <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Scope</th><th>Used</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p._id}>
                <td><strong>{p.code}</strong><div className="muted">{p.description}</div></td>
                <td>{p.type === 'percent' ? `${p.value}%` : money(p.value)}{p.maxDiscount ? ` (max ${money(p.maxDiscount)})` : ''}</td>
                <td className="muted">min {money(p.minOrder)} · {p.perUserLimit}/user</td>
                <td>{p.partner ? p.partner.partnerProfile?.storeName || 'Partner' : 'Platform'}</td>
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
          <div className="form-row">
            <div className="field"><label>Total usage limit (0 = ∞)</label><input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} /></div>
            <div className="field"><label>Per-user limit</label><input type="number" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} /></div>
          </div>
          {err && <div className="error-text">{err}</div>}
          <button className="btn block" onClick={save} disabled={!form.code || !form.value}>Create promo</button>
        </Modal>
      )}
    </>
  );
}

function Banners({ kind }) {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', image: '', description: '', sortOrder: 0, active: true });

  const load = () => api(`/admin/${kind}`).then((d) => setItems(d.items));
  useEffect(() => { setItems(null); load(); }, [kind]);

  const save = async () => { await api(`/admin/${kind}`, { method: 'POST', body: form }); setModal(false); load(); };
  const toggle = async (it) => { await api(`/admin/${kind}/${it._id}`, { method: 'PUT', body: { active: !it.active } }); load(); };
  const del = async (id) => { await api(`/admin/${kind}/${id}`, { method: 'DELETE' }); load(); };

  if (!items) return <Spinner />;
  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => { setForm({ title: '', image: '', description: '', sortOrder: items.length, active: true }); setModal(true); }}>
        + New {kind.slice(0, -1)}
      </button>
      {items.length === 0 ? <Empty text={`No ${kind} yet.`} /> : (
        <div className="grid cols-3">
          {items.map((it) => (
            <div key={it._id} className="card" style={{ overflow: 'hidden' }}>
              {it.image && <img src={it.image} style={{ width: '100%', height: 120, objectFit: 'cover' }} alt="" />}
              <div className="pad">
                <div className="spread">
                  <strong>{it.title}</strong>
                  <Chip s={it.active ? 'active' : 'suspended'} />
                </div>
                {it.description && <div className="muted">{it.description}</div>}
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn gray sm" onClick={() => toggle(it)}>{it.active ? 'Disable' : 'Enable'}</button>
                  <button className="btn danger sm" onClick={() => del(it._id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title={`New ${kind.slice(0, -1)}`} onClose={() => setModal(false)}>
          <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>Image URL</label><input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" /></div>
          {kind === 'offers' && (
            <div className="field"><label>Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          )}
          <button className="btn block" onClick={save} disabled={!form.image && kind === 'sliders'}>Save</button>
        </Modal>
      )}
    </>
  );
}

function Cities() {
  const [cities, setCities] = useState(null);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [err, setErr] = useState('');

  const load = () => api('/admin/cities').then((d) => setCities(d.items));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr('');
    try {
      await api('/admin/cities', { method: 'POST', body: { name, state } });
      setName(''); setState(''); load();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (c) => { await api(`/admin/cities/${c._id}`, { method: 'PUT', body: { active: !c.active } }); load(); };
  const del = async (id) => { await api(`/admin/cities/${id}`, { method: 'DELETE' }); load(); };

  if (!cities) return <Spinner />;
  return (
    <>
      <p className="muted">Serviceable cities — customers see "not deliverable" for cities outside this list. Empty list = deliver everywhere.</p>
      <div className="filters" style={{ marginBottom: 14 }}>
        <input placeholder="City name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
        <button className="btn" onClick={add} disabled={!name}>+ Add city</button>
      </div>
      {err && <div className="error-text">{err}</div>}
      {cities.length === 0 ? <Empty text="No cities — the whole map is serviceable." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>City</th><th>State</th><th>Areas</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c._id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.state}</td>
                  <td style={{ maxWidth: 320 }}>
                    <AreasEditor city={c} onSaved={load} />
                  </td>
                  <td><Chip s={c.active ? 'active' : 'suspended'} /></td>
                  <td>
                    <div className="row">
                      <button className="btn gray sm" onClick={() => toggle(c)}>{c.active ? 'Disable' : 'Enable'}</button>
                      <button className="btn danger sm" onClick={() => del(c._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* Inline serviceable-areas editor per city (v1 admin Area.php). Empty = whole
   city serviceable. */
function AreasEditor({ city, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((city.areas || []).join(', '));
  const save = async () => {
    await api(`/admin/cities/${city._id}`, {
      method: 'PUT',
      body: { areas: value.split(',').map((a) => a.trim()).filter(Boolean) },
    });
    setEditing(false); onSaved();
  };
  if (!editing) {
    return (
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="muted">{city.areas?.length ? city.areas.join(' · ') : 'All areas'}</span>
        <button className="btn gray sm" onClick={() => { setValue((city.areas || []).join(', ')); setEditing(true); }}>Edit</button>
      </div>
    );
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Area 1, Area 2…" style={{ flex: 1 }} />
      <button className="btn sm" onClick={save}>Save</button>
      <button className="btn gray sm" onClick={() => setEditing(false)}>✕</button>
    </div>
  );
}

function Sections() {
  const [items, setItems] = useState(null);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ title: '', subtitle: '', products: [] });

  const load = () => api('/admin/sections').then((d) => setItems(d.items));
  useEffect(() => {
    load();
    api('/admin/products?limit=100').then((d) => setProducts(d.products));
  }, []);

  const openNew = () => { setEdit(null); setForm({ title: '', subtitle: '', products: [] }); setModal(true); };
  const openEdit = (s) => { setEdit(s); setForm({ title: s.title, subtitle: s.subtitle || '', products: s.products.map((p) => p._id) }); setModal(true); };

  const save = async () => {
    if (edit) await api(`/admin/sections/${edit._id}`, { method: 'PUT', body: form });
    else await api('/admin/sections', { method: 'POST', body: form });
    setModal(false); load();
  };
  const toggle = async (s) => { await api(`/admin/sections/${s._id}`, { method: 'PUT', body: { active: !s.active } }); load(); };
  const del = async (id) => { await api(`/admin/sections/${id}`, { method: 'DELETE' }); load(); };
  const toggleProduct = (id) =>
    setForm((f) => ({ ...f, products: f.products.includes(id) ? f.products.filter((x) => x !== id) : [...f.products, id] }));

  if (!items) return <Spinner />;
  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={openNew}>+ New section</button>
      {items.length === 0 ? <Empty text="No featured sections." /> : (
        <div className="grid cols-2">
          {items.map((s) => (
            <div key={s._id} className="card pad">
              <div className="spread">
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted">{s.subtitle}</div>
                </div>
                <Chip s={s.active ? 'active' : 'suspended'} />
              </div>
              <div className="muted" style={{ margin: '8px 0' }}>{s.products.length} product(s): {s.products.slice(0, 4).map((p) => p.title).join(', ')}{s.products.length > 4 ? '…' : ''}</div>
              <div className="row">
                <button className="btn gray sm" onClick={() => openEdit(s)}>Edit</button>
                <button className="btn gray sm" onClick={() => toggle(s)}>{s.active ? 'Disable' : 'Enable'}</button>
                <button className="btn danger sm" onClick={() => del(s._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal wide title={edit ? 'Edit section' : 'New featured section'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label>Subtitle</label><input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
          </div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Products ({form.products.length} selected)</label>
          <div style={{ maxHeight: 300, overflow: 'auto', border: '1.5px solid var(--line)', borderRadius: 9, padding: 10, marginTop: 6 }}>
            {products.map((p) => (
              <label key={p._id} className="row" style={{ padding: '4px 0', fontSize: 14 }}>
                <input type="checkbox" checked={form.products.includes(p._id)} onChange={() => toggleProduct(p._id)} />
                {p.title} <span className="muted">({p.partner?.partnerProfile?.storeName})</span>
              </label>
            ))}
          </div>
          <button className="btn block" style={{ marginTop: 14 }} onClick={save} disabled={!form.title}>Save section</button>
        </Modal>
      )}
    </>
  );
}

function Broadcast() {
  const [form, setForm] = useState({ title: '', body: '', role: 'all' });
  const [msg, setMsg] = useState('');
  const send = async () => {
    setMsg('');
    try {
      const d = await api('/admin/broadcast', { method: 'POST', body: form });
      setMsg(d.message); setForm({ title: '', body: '', role: 'all' });
    } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="card pad" style={{ maxWidth: 560 }}>
      <h3 style={{ marginTop: 0 }}>Send in-app notification</h3>
      <div className="field"><label>Audience</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="all">All users</option><option value="customer">Customers</option>
          <option value="partner">Partners</option><option value="rider">Riders</option>
        </select>
      </div>
      <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="field"><label>Message</label><textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
      {msg && <div className="success-text">{msg}</div>}
      <button className="btn" onClick={send} disabled={!form.title}>Send broadcast</button>
    </div>
  );
}
