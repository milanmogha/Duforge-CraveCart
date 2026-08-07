import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';
import { MediaPicker } from './Catalog.jsx';

const EMPTY = {
  title: '', description: '', category: '', price: '', salePrice: '', taxPercent: 5,
  tax: '', isPriceInclusiveTax: false,
  stock: 100, isVeg: false, status: 'active', images: [''], variants: [], addons: [], tags: [],
  attributes: [],
};

export default function Products() {
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  const [taxes, setTaxes] = useState([]);
  const [attrDefs, setAttrDefs] = useState([]);
  const [tagList, setTagList] = useState([]);
  const [picker, setPicker] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ mode: 'percent', value: '', category: '' });
  const [bulkMsg, setBulkMsg] = useState('');

  const load = () => api(`/partner/products${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api('/partner/categories').then((d) => setCats(d.categories));
    api('/partner/taxes').then((d) => setTaxes(d.items.filter((t) => t.active)));
    api('/partner/attributes').then((d) => setAttrDefs(d.items.filter((a) => a.active)));
    api('/partner/tags').then((d) => setTagList(d.items));
  }, []);

  const openNew = () => { setEdit(null); setForm(EMPTY); setErr(''); setModal(true); };
  const openEdit = (p) => {
    setEdit(p);
    setForm({
      title: p.title, description: p.description || '', category: p.category?._id || p.category,
      price: p.price, salePrice: p.salePrice ?? '', taxPercent: p.taxPercent, stock: p.stock,
      tax: p.tax || '', isPriceInclusiveTax: !!p.isPriceInclusiveTax,
      isVeg: p.isVeg, status: p.status, images: p.images.length ? p.images : [''],
      variants: p.variants.map((v) => ({ name: v.name, price: v.price })),
      addons: p.addons.map((a) => ({ name: a.name, price: a.price })),
      tags: p.tags || [],
      attributes: (p.attributes || []).map((a) => ({ key: a.key, value: a.value })),
    });
    setErr(''); setModal(true);
  };

  const save = async () => {
    setErr('');
    const body = {
      ...form,
      price: Number(form.price),
      salePrice: form.salePrice === '' ? null : Number(form.salePrice),
      taxPercent: Number(form.taxPercent),
      tax: form.tax || null,
      stock: Number(form.stock),
      images: form.images.filter(Boolean),
      variants: form.variants.filter((v) => v.name && v.price !== '').map((v) => ({ ...v, price: Number(v.price) })),
      addons: form.addons.filter((a) => a.name && a.price !== '').map((a) => ({ ...a, price: Number(a.price) })),
      attributes: form.attributes.filter((a) => a.key && a.value),
    };
    try {
      if (edit) await api(`/partner/products/${edit._id}`, { method: 'PUT', body });
      else await api('/partner/products', { method: 'POST', body });
      setModal(false); load();
    } catch (e) { setErr(e.message); }
  };

  const del = async (id) => {
    if (confirm('Delete this product?')) { await api(`/partner/products/${id}`, { method: 'DELETE' }); load(); }
  };

  const setList = (key, i, field, value) => {
    const list = [...form[key]];
    list[i] = { ...list[i], [field]: value };
    setForm({ ...form, [key]: list });
  };

  if (!data) return <Spinner />;
  return (
    <>
      <div className="topbar">
        <h1>Products</h1>
        <div className="filters">
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <button className="btn gray" onClick={() => setBulk(true)}>Bulk price</button>
          <button className="btn" onClick={openNew}>+ New product</button>
        </div>
      </div>
      {data.products.length === 0 ? <Empty icon="🍽️" text="No products yet — add your first one." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Sold</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p._id}>
                  <td><img className="thumb" src={p.images?.[0]} alt="" /></td>
                  <td>
                    <strong>{p.title}</strong>
                    <div className="muted">
                      {p.isVeg ? '🟢' : '🔴'} {p.variants.length > 0 && `${p.variants.length} variants`} {p.addons.length > 0 && `· ${p.addons.length} add-ons`}
                    </div>
                  </td>
                  <td>{p.category?.name}</td>
                  <td>{money(p.salePrice ?? p.price)}{p.salePrice != null && <div className="muted" style={{ textDecoration: 'line-through' }}>{money(p.price)}</div>}</td>
                  <td style={{ color: p.stock <= p.lowStockAlert ? 'var(--red)' : undefined }}>{p.stock}</td>
                  <td>{p.soldCount}</td>
                  <td><Chip s={p.status} /></td>
                  <td>
                    <div className="row">
                      <button className="btn gray sm" onClick={() => openEdit(p)}>Edit</button>
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
        <Modal wide title={edit ? `Edit: ${edit.title}` : 'New product'} onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="field" style={{ flex: 2 }}><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select…</option>
                {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>Image URL</label>
            <div className="row">
              <input style={{ flex: 1 }} value={form.images[0] || ''} onChange={(e) => setForm({ ...form, images: [e.target.value] })} placeholder="https://…" />
              <button type="button" className="btn gray sm" onClick={() => setPicker(true)}>Browse…</button>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>Price</label><input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="field"><label>Sale price (optional)</label><input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} /></div>
            <div className="field"><label>Stock</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Tax</label>
              <select value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })}>
                <option value="">Custom rate ↓</option>
                {taxes.map((t) => <option key={t._id} value={t._id}>{t.title} ({t.percentage}%){t.partner == null ? ' — global' : ''}</option>)}
              </select>
            </div>
            <div className="field"><label>Custom tax %</label>
              <input type="number" value={form.taxPercent} disabled={!!form.tax} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} />
            </div>
            <div className="field"><label>Price includes tax</label>
              <select value={form.isPriceInclusiveTax ? '1' : '0'} onChange={(e) => setForm({ ...form, isPriceInclusiveTax: e.target.value === '1' })}>
                <option value="0">No — add on top</option><option value="1">Yes — inclusive</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>Type</label>
              <select value={form.isVeg ? '1' : '0'} onChange={(e) => setForm({ ...form, isVeg: e.target.value === '1' })}>
                <option value="0">Non-veg</option><option value="1">Veg</option>
              </select>
            </div>
            <div className="field"><label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="draft">Draft</option><option value="out_of_stock">Out of stock</option>
              </select>
            </div>
          </div>

          <div className="spread"><h4 style={{ margin: '8px 0' }}>Variants</h4>
            <button className="btn gray sm" onClick={() => setForm({ ...form, variants: [...form.variants, { name: '', price: '' }] })}>+ Add variant</button>
          </div>
          {form.variants.map((v, i) => (
            <div key={i} className="form-row" style={{ marginBottom: 8 }}>
              <input placeholder="Name (e.g. Half)" value={v.name} onChange={(e) => setList('variants', i, 'name', e.target.value)} style={{ flex: 2, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
              <input placeholder="Price" type="number" value={v.price} onChange={(e) => setList('variants', i, 'price', e.target.value)} style={{ border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
              <button className="btn danger sm" onClick={() => setForm({ ...form, variants: form.variants.filter((_, x) => x !== i) })}>✕</button>
            </div>
          ))}

          <div className="spread"><h4 style={{ margin: '8px 0' }}>Add-ons</h4>
            <button className="btn gray sm" onClick={() => setForm({ ...form, addons: [...form.addons, { name: '', price: '' }] })}>+ Add add-on</button>
          </div>
          {form.addons.map((a, i) => (
            <div key={i} className="form-row" style={{ marginBottom: 8 }}>
              <input placeholder="Name (e.g. Extra cheese)" value={a.name} onChange={(e) => setList('addons', i, 'name', e.target.value)} style={{ flex: 2, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
              <input placeholder="Price" type="number" value={a.price} onChange={(e) => setList('addons', i, 'price', e.target.value)} style={{ border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
              <button className="btn danger sm" onClick={() => setForm({ ...form, addons: form.addons.filter((_, x) => x !== i) })}>✕</button>
            </div>
          ))}

          <div className="spread"><h4 style={{ margin: '8px 0' }}>Attributes</h4>
            <button className="btn gray sm" onClick={() => setForm({ ...form, attributes: [...form.attributes, { key: '', value: '' }] })}>+ Add attribute</button>
          </div>
          {form.attributes.map((a, i) => {
            const def = attrDefs.find((d) => d.name === a.key);
            return (
              <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                <select value={a.key} onChange={(e) => setList('attributes', i, 'key', e.target.value)} style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }}>
                  <option value="">Attribute…</option>
                  {attrDefs.map((d) => <option key={d._id} value={d.name}>{d.name}</option>)}
                </select>
                {def?.values?.length ? (
                  <select value={a.value} onChange={(e) => setList('attributes', i, 'value', e.target.value)} style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }}>
                    <option value="">Value…</option>
                    {def.values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input placeholder="Value" value={a.value} onChange={(e) => setList('attributes', i, 'value', e.target.value)} style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
                )}
                <button className="btn danger sm" onClick={() => setForm({ ...form, attributes: form.attributes.filter((_, x) => x !== i) })}>✕</button>
              </div>
            );
          })}

          <div className="field" style={{ marginTop: 8 }}><label>Tags (comma-separated)</label>
            <input
              list="tag-suggestions"
              value={form.tags.join(', ')}
              onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="spicy, bestseller"
            />
            <datalist id="tag-suggestions">
              {tagList.map((t) => <option key={t._id} value={t.name} />)}
            </datalist>
          </div>

          {err && <div className="error-text">{err}</div>}
          <button className="btn block" style={{ marginTop: 10 }} onClick={save} disabled={!form.title || !form.category || form.price === ''}>
            {edit ? 'Save changes' : 'Create product'}
          </button>
        </Modal>
      )}
      {picker && <MediaPicker onClose={() => setPicker(false)} onPick={(url) => { setForm((f) => ({ ...f, images: [url] })); setPicker(false); }} />}

      {bulk && (
        <Modal title="Bulk price update" onClose={() => { setBulk(false); setBulkMsg(''); }}>
          <p className="muted">Adjust the base price of all your products at once (sale prices are untouched).</p>
          <div className="form-row">
            <div className="field"><label>Mode</label>
              <select value={bulkForm.mode} onChange={(e) => setBulkForm({ ...bulkForm, mode: e.target.value })}>
                <option value="percent">Percent (±%)</option>
                <option value="flat">Flat amount (±₹)</option>
              </select>
            </div>
            <div className="field"><label>Value</label>
              <input type="number" value={bulkForm.value} onChange={(e) => setBulkForm({ ...bulkForm, value: e.target.value })} placeholder="e.g. 5 or -10" />
            </div>
          </div>
          <div className="field"><label>Limit to category (optional)</label>
            <select value={bulkForm.category} onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}>
              <option value="">All categories</option>
              {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          {bulkMsg && <div className={bulkMsg.includes('✓') ? 'success-text' : 'error-text'}>{bulkMsg}</div>}
          <button
            className="btn block"
            disabled={!bulkForm.value}
            onClick={async () => {
              if (!confirm(`Apply ${bulkForm.mode === 'percent' ? bulkForm.value + '%' : '₹' + bulkForm.value} to ${bulkForm.category ? 'this category' : 'ALL your products'}?`)) return;
              try {
                const d = await api('/partner/products/bulk-price', { method: 'POST', body: { ...bulkForm, value: Number(bulkForm.value), category: bulkForm.category || undefined } });
                setBulkMsg(`Updated ${d.modifiedCount} products ✓`);
                load();
              } catch (e) { setBulkMsg(e.message); }
            }}
          >Apply</button>
        </Modal>
      )}
    </>
  );
}
