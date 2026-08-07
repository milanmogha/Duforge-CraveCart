import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

const TABS = [
  ['categories', 'Categories'], ['products', 'Products'], ['taxes', 'Taxes'],
  ['attributes', 'Attributes'], ['tags', 'Tags'], ['media', 'Media'],
];

export default function Catalog() {
  const [tab, setTab] = useState('categories');
  return (
    <>
      <div className="topbar"><h1>Catalog</h1></div>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'categories' && <Categories />}
      {tab === 'products' && <Products />}
      {tab === 'taxes' && <Taxes />}
      {tab === 'attributes' && <Attributes />}
      {tab === 'tags' && <Tags />}
      {tab === 'media' && <MediaLibrary />}
    </>
  );
}

/* Global taxes — partners see these read-only in their console. */
function Taxes() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ title: '', percentage: '', active: true });

  const load = () => api('/admin/taxes').then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const body = { ...form, percentage: Number(form.percentage) };
    if (edit) await api(`/admin/taxes/${edit._id}`, { method: 'PUT', body });
    else await api('/admin/taxes', { method: 'POST', body });
    setModal(false); load();
  };
  const del = async (id) => { if (confirm('Delete tax?')) { await api(`/admin/taxes/${id}`, { method: 'DELETE' }); load(); } };

  if (!items) return <Spinner />;
  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => { setEdit(null); setForm({ title: '', percentage: '', active: true }); setModal(true); }}>+ New tax</button>
      {items.length === 0 ? <Empty text="No taxes yet." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Title</th><th>Rate</th><th>Owner</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td><strong>{t.title}</strong></td>
                  <td>{t.percentage}%</td>
                  <td>{t.partner ? 'Partner' : 'Global'}</td>
                  <td><Chip s={t.active ? 'active' : 'suspended'} /></td>
                  <td>
                    <div className="row">
                      <button className="btn gray sm" onClick={() => { setEdit(t); setForm({ title: t.title, percentage: t.percentage, active: t.active }); setModal(true); }}>Edit</button>
                      <button className="btn danger sm" onClick={() => del(t._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={edit ? 'Edit tax' : 'New tax'} onClose={() => setModal(false)}>
          <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. GST 5%" /></div>
          <div className="form-row">
            <div className="field"><label>Percentage</label><input type="number" min="0" step="0.01" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} /></div>
            <div className="field"><label>Status</label>
              <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                <option value="1">Active</option><option value="0">Disabled</option>
              </select>
            </div>
          </div>
          <button className="btn block" onClick={save} disabled={!form.title || form.percentage === ''}>Save</button>
        </Modal>
      )}
    </>
  );
}

function Attributes() {
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', values: '', active: true });

  const load = () => api('/admin/attributes').then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const body = { name: form.name, active: form.active, values: form.values.split(',').map((v) => v.trim()).filter(Boolean) };
    if (edit) await api(`/admin/attributes/${edit._id}`, { method: 'PUT', body });
    else await api('/admin/attributes', { method: 'POST', body });
    setModal(false); load();
  };
  const del = async (id) => { if (confirm('Delete attribute?')) { await api(`/admin/attributes/${id}`, { method: 'DELETE' }); load(); } };

  if (!items) return <Spinner />;
  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => { setEdit(null); setForm({ name: '', values: '', active: true }); setModal(true); }}>+ New attribute</button>
      {items.length === 0 ? <Empty text="No attributes yet." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Name</th><th>Values</th><th>Owner</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a._id}>
                  <td><strong>{a.name}</strong></td>
                  <td>{(a.values || []).join(' · ')}</td>
                  <td>{a.partner ? 'Partner' : 'Global'}</td>
                  <td><Chip s={a.active ? 'active' : 'suspended'} /></td>
                  <td>
                    <div className="row">
                      <button className="btn gray sm" onClick={() => { setEdit(a); setForm({ name: a.name, values: (a.values || []).join(', '), active: a.active }); setModal(true); }}>Edit</button>
                      <button className="btn danger sm" onClick={() => del(a._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={edit ? 'Edit attribute' : 'New attribute'} onClose={() => setModal(false)}>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Size" /></div>
          <div className="field"><label>Values (comma-separated)</label><input value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} placeholder="Small, Medium, Large" /></div>
          <div className="field"><label>Status</label>
            <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
              <option value="1">Active</option><option value="0">Disabled</option>
            </select>
          </div>
          <button className="btn block" onClick={save} disabled={!form.name}>Save</button>
        </Modal>
      )}
    </>
  );
}

function Tags() {
  const [items, setItems] = useState(null);
  const [name, setName] = useState('');
  const load = () => api('/admin/tags').then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api('/admin/tags', { method: 'POST', body: { name: name.trim() } });
    setName(''); load();
  };
  const del = async (id) => { await api(`/admin/tags/${id}`, { method: 'DELETE' }); load(); };

  if (!items) return <Spinner />;
  return (
    <div className="card pad">
      <form className="filters" style={{ marginBottom: 14 }} onSubmit={add}>
        <input placeholder="New tag…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn sm">Add</button>
      </form>
      {items.length === 0 ? <Empty text="No tags yet." /> : (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {items.map((t) => (
            <span key={t._id} className="chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.name}
              <a style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => del(t._id)}>✕</a>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaLibrary() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const load = () => api(`/admin/media?page=${page}`).then(setData);
  useEffect(load, [page]);

  const del = async (id) => { if (confirm('Delete this file record?')) { await api(`/admin/media/${id}`, { method: 'DELETE' }); load(); } };

  if (!data) return <Spinner />;
  return (
    <>
      {data.items.length === 0 ? <Empty text="No uploads yet." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
          {data.items.map((m) => (
            <div key={m._id} className="card" style={{ overflow: 'hidden' }}>
              <img src={m.url} alt={m.filename} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
              <div style={{ padding: 8, fontSize: 12 }}>
                <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.filename}>{m.filename}</div>
                <div className="muted">{m.uploader?.name || '—'} · {(m.size / 1024).toFixed(0)} KB</div>
                <button className="btn danger sm" style={{ marginTop: 6 }} onClick={() => del(m._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {Array.from({ length: data.pages }, (_, i) => (
            <button key={i} className={`btn sm ${page === i + 1 ? '' : 'gray'}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
        </div>
      )}
    </>
  );
}

function Categories() {
  const [cats, setCats] = useState(null);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', image: '', sortOrder: 0, active: true });
  const [err, setErr] = useState('');

  const load = () => api('/admin/categories').then((d) => setCats(d.categories));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: '', image: '', sortOrder: cats?.length || 0, active: true }); setModal(true); };
  const openEdit = (c) => { setEdit(c); setForm({ name: c.name, image: c.image || '', sortOrder: c.sortOrder, active: c.active }); setModal(true); };

  const save = async () => {
    setErr('');
    try {
      if (edit) await api(`/admin/categories/${edit._id}`, { method: 'PUT', body: form });
      else await api('/admin/categories', { method: 'POST', body: form });
      setModal(false); load();
    } catch (e) { setErr(e.message); }
  };
  const del = async (id) => {
    try { await api(`/admin/categories/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { alert(e.message); }
  };

  if (!cats) return <Spinner />;
  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={openNew}>+ New category</button>
      <div className="card">
        <table className="table">
          <thead><tr><th></th><th>Name</th><th>Order</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c._id}>
                <td>{c.image && <img className="thumb" src={c.image} alt="" />}</td>
                <td><strong>{c.name}</strong><div className="muted">{c.slug}</div></td>
                <td>{c.sortOrder}</td>
                <td><Chip s={c.active ? 'active' : 'suspended'} /></td>
                <td>
                  <div className="row">
                    <button className="btn gray sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn danger sm" onClick={() => del(c._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={edit ? 'Edit category' : 'New category'} onClose={() => setModal(false)}>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Image URL</label><input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" /></div>
          <div className="form-row">
            <div className="field"><label>Sort order</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            <div className="field"><label>Status</label>
              <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                <option value="1">Active</option><option value="0">Disabled</option>
              </select>
            </div>
          </div>
          {err && <div className="error-text">{err}</div>}
          <button className="btn block" onClick={save} disabled={!form.name}>Save</button>
        </Modal>
      )}
    </>
  );
}

function Products() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = () => {
    const q = new URLSearchParams({ page });
    if (search) q.set('search', search);
    api(`/admin/products?${q}`).then(setData);
  };
  useEffect(load, [page]);

  const update = async (id, body) => { await api(`/admin/products/${id}`, { method: 'PUT', body }); load(); };
  const del = async (id) => { if (confirm('Delete this product?')) { await api(`/admin/products/${id}`, { method: 'DELETE' }); load(); } };

  if (!data) return <Spinner />;
  return (
    <>
      <div className="filters" style={{ marginBottom: 14 }}>
        <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn gray sm" onClick={load}>Search</button>
      </div>
      {data.products.length === 0 ? <Empty text="No products." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th></th><th>Product</th><th>Store</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th></th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p._id}>
                  <td><img className="thumb" src={p.images?.[0]} alt="" /></td>
                  <td><strong>{p.title}</strong><div className="muted">{p.category?.name}</div></td>
                  <td>{p.partner?.partnerProfile?.storeName || p.partner?.name}</td>
                  <td>{money(p.salePrice ?? p.price)}</td>
                  <td>{p.stock}</td>
                  <td>
                    <select value={p.status} onChange={(e) => update(p._id, { status: e.target.value })}>
                      <option value="active">active</option><option value="draft">draft</option><option value="out_of_stock">out of stock</option>
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" checked={p.featured} onChange={(e) => update(p._id, { featured: e.target.checked })} />
                  </td>
                  <td><button className="btn danger sm" onClick={() => del(p._id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {Array.from({ length: data.pages }, (_, i) => (
            <button key={i} className={`btn sm ${page === i + 1 ? '' : 'gray'}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
        </div>
      )}
    </>
  );
}
