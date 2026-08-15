import { useEffect, useMemo, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

/* v1 parity: Point_of_sale.php + Table_booking.php + Waiter management,
   rebuilt as one partner page. */

// Opens a print window with a thermal-receipt-styled invoice (v1
// partner_thermal_invoice.php equivalent, 80mm paper).
export function printReceipt(order, store) {
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) return alert('Allow pop-ups to print receipts');
  const lines = order.items.map((it) =>
    `<tr><td>${it.title}${it.variantName ? ` (${it.variantName})` : ''} × ${it.qty}</td><td style="text-align:right">${it.lineTotal.toFixed(2)}</td></tr>`
  ).join('');
  w.document.write(`<!doctype html><html><head><title>${order.orderNumber}</title><style>
    body { font-family: monospace; width: 280px; margin: 0 auto; font-size: 12px; color: #000; }
    h2, p.center { text-align: center; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    .rule { border-top: 1px dashed #000; margin: 6px 0; }
    .tot td { font-weight: 700; }
  </style></head><body>
    <h2>${store || 'CraveCart'}</h2>
    <p class="center">${order.orderType === 'dine_in' ? 'DINE-IN' : 'POS'} · ${order.orderNumber}</p>
    <p class="center">${new Date(order.createdAt).toLocaleString('en-IN')}</p>
    ${order.table?.title ? `<p class="center">Table: ${order.table.title}${order.waiter?.name ? ` · Waiter: ${order.waiter.name}` : ''}</p>` : ''}
    <div class="rule"></div>
    <table>${lines}</table>
    <div class="rule"></div>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">${order.itemsTotal.toFixed(2)}</td></tr>
      ${order.taxTotal ? `<tr><td>Tax</td><td style="text-align:right">${order.taxTotal.toFixed(2)}</td></tr>` : ''}
      ${order.discount ? `<tr><td>Discount</td><td style="text-align:right">−${order.discount.toFixed(2)}</td></tr>` : ''}
      <tr class="tot"><td>TOTAL</td><td style="text-align:right">₹${order.grandTotal.toFixed(2)}</td></tr>
    </table>
    <div class="rule"></div>
    <p class="center">Thank you! Visit again 🙏</p>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`);
  w.document.close();
}

const TABS = [['pos', 'POS billing'], ['sales', 'Sales'], ['tables', 'Tables & floors'], ['waiters', 'Waiters'], ['bookings', 'Bookings']];

export default function DineIn() {
  const [tab, setTab] = useState('pos');
  return (
    <>
      <div className="topbar"><h1>Dine-in & POS</h1></div>
      <div className="tabs">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'pos' && <Pos />}
      {tab === 'sales' && <Sales />}
      {tab === 'tables' && <Tables />}
      {tab === 'waiters' && <Waiters />}
      {tab === 'bookings' && <Bookings />}
    </>
  );
}

function Pos() {
  const [products, setProducts] = useState(null);
  const [tables, setTables] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [search, setSearch] = useState('');
  const [bill, setBill] = useState([]); // { productId, title, variantId, variantName, unitPrice, qty }
  const [meta, setMeta] = useState({ orderType: 'pos', table: '', waiter: '', customerName: '', customerPhone: '', discount: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null); // created order

  useEffect(() => {
    api('/partner/products?limit=200').then((d) => setProducts(d.products.filter((p) => p.status === 'active')));
    api('/dinein/tables').then((d) => setTables(d.items.filter((t) => t.active)));
    api('/dinein/waiters').then((d) => setWaiters(d.items.filter((w) => w.active)));
  }, []);

  const filtered = useMemo(
    () => (products || []).filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const add = (p, variant) => {
    const variantId = variant?._id || null;
    const key = p._id + (variantId || '');
    setBill((b) => {
      const existing = b.find((l) => l.key === key);
      if (existing) return b.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...b, {
        key, productId: p._id, title: p.title, variantId,
        variantName: variant?.name || null,
        unitPrice: variant ? variant.price : (p.salePrice ?? p.price), qty: 1,
      }];
    });
    setDone(null);
  };

  const setQty = (key, qty) => setBill((b) => (qty <= 0 ? b.filter((l) => l.key !== key) : b.map((l) => (l.key === key ? { ...l, qty } : l))));

  const subtotal = bill.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discount = Math.min(Number(meta.discount) || 0, subtotal);

  const charge = async () => {
    setBusy(true); setErr('');
    try {
      const d = await api('/dinein/pos/orders', {
        method: 'POST',
        body: {
          items: bill.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, qty: l.qty })),
          orderType: meta.orderType,
          table: meta.table || undefined,
          waiter: meta.waiter || undefined,
          customerName: meta.customerName || undefined,
          customerPhone: meta.customerPhone || undefined,
          discount,
        },
      });
      setDone(d.order); setBill([]);
      setMeta({ ...meta, customerName: '', customerPhone: '', discount: '' });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!products) return <Spinner />;
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
      <div>
        <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 9, padding: '9px 12px', marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, maxHeight: '70vh', overflow: 'auto' }}>
          {filtered.map((p) => (
            <div key={p._id} className="card" style={{ overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => (p.variants.length ? null : add(p))}>
              {p.images?.[0] && <img src={p.images[0]} alt="" style={{ width: '100%', height: 70, objectFit: 'cover' }} />}
              <div style={{ padding: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.title}</div>
                {p.variants.length === 0 ? (
                  <div className="muted">{money(p.salePrice ?? p.price)}</div>
                ) : (
                  p.variants.map((v) => (
                    <button key={v._id} className="btn gray sm" style={{ margin: '4px 4px 0 0', padding: '2px 8px', fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); add(p, v); }}>
                      {v.name} {money(v.price)}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card pad">
        <h3 style={{ marginTop: 0 }}>Bill</h3>
        {bill.length === 0 && !done && <p className="muted">Click products to add them.</p>}
        {bill.map((l) => (
          <div key={l.key} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <div>
              <strong style={{ fontSize: 13.5 }}>{l.title}{l.variantName ? ` (${l.variantName})` : ''}</strong>
              <div className="muted">{money(l.unitPrice)} each</div>
            </div>
            <div className="row">
              <button className="btn gray sm" onClick={() => setQty(l.key, l.qty - 1)}>−</button>
              <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{l.qty}</span>
              <button className="btn gray sm" onClick={() => setQty(l.key, l.qty + 1)}>+</button>
            </div>
          </div>
        ))}
        {bill.length > 0 && (
          <>
            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="field"><label>Type</label>
                <select value={meta.orderType} onChange={(e) => setMeta({ ...meta, orderType: e.target.value })}>
                  <option value="pos">Counter (POS)</option>
                  <option value="dine_in">Dine-in</option>
                </select>
              </div>
              <div className="field"><label>Discount ₹</label>
                <input type="number" min="0" value={meta.discount} onChange={(e) => setMeta({ ...meta, discount: e.target.value })} />
              </div>
            </div>
            {meta.orderType === 'dine_in' && (
              <div className="form-row">
                <div className="field"><label>Table</label>
                  <select value={meta.table} onChange={(e) => setMeta({ ...meta, table: e.target.value })}>
                    <option value="">—</option>
                    {tables.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="field"><label>Waiter</label>
                  <select value={meta.waiter} onChange={(e) => setMeta({ ...meta, waiter: e.target.value })}>
                    <option value="">—</option>
                    {waiters.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="field"><label>Customer name (optional)</label>
                <input value={meta.customerName} onChange={(e) => setMeta({ ...meta, customerName: e.target.value })} />
              </div>
              <div className="field"><label>Phone (optional)</label>
                <input value={meta.customerPhone} onChange={(e) => setMeta({ ...meta, customerPhone: e.target.value })} />
              </div>
            </div>
            <div className="spread" style={{ margin: '8px 0' }}>
              <span className="muted">Subtotal</span><strong>{money(subtotal)}</strong>
            </div>
            {discount > 0 && (
              <div className="spread" style={{ marginBottom: 8 }}>
                <span className="muted">Discount</span><strong>−{money(discount)}</strong>
              </div>
            )}
            <p className="muted" style={{ margin: '0 0 8px' }}>Tax is added per product rate at charge time.</p>
            {err && <div className="error-text">{err}</div>}
            <button className="btn block" disabled={busy} onClick={charge}>
              {busy ? 'Charging…' : `Charge cash · ${money(subtotal - discount)}+tax`}
            </button>
          </>
        )}
        {done && (
          <div style={{ marginTop: 12, padding: 12, background: '#dcfce7', borderRadius: 10 }}>
            <strong>✓ Sale {done.orderNumber} recorded — {money(done.grandTotal)}</strong>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => printReceipt(done, undefined)}>🖨 Print receipt</button>
              <button className="btn gray sm" onClick={() => setDone(null)}>New sale</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Sales() {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/dinein/pos/orders').then((d) => setItems(d.items)); }, []);
  if (!items) return <Spinner />;
  if (items.length === 0) return <Empty icon="🧾" text="No POS / dine-in sales yet." />;
  return (
    <div className="card">
      <table className="table">
        <thead><tr><th>Order</th><th>Type</th><th>Table / Waiter</th><th>Customer</th><th>Total</th><th>When</th><th></th></tr></thead>
        <tbody>
          {items.map((o) => (
            <tr key={o._id}>
              <td><strong>{o.orderNumber}</strong></td>
              <td><Chip s={o.orderType === 'dine_in' ? 'confirmed' : 'completed'} />{o.orderType === 'dine_in' ? ' dine-in' : ' pos'}</td>
              <td>{o.table?.title || '—'}{o.waiter?.name ? ` · ${o.waiter.name}` : ''}</td>
              <td>{o.customer?.name}<div className="muted">{o.customer?.phone}</div></td>
              <td><strong>{money(o.grandTotal)}</strong></td>
              <td className="muted">{dt(o.createdAt)}</td>
              <td><button className="btn gray sm" onClick={() => printReceipt(o, undefined)}>🖨 Receipt</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tables() {
  const [floors, setFloors] = useState(null);
  const [tables, setTables] = useState(null);
  const [floorName, setFloorName] = useState('');
  const [form, setForm] = useState({ title: '', floor: '', capacity: 4 });

  const load = () => {
    api('/dinein/floors').then((d) => setFloors(d.items));
    api('/dinein/tables').then((d) => setTables(d.items));
  };
  useEffect(() => { load(); }, []);

  if (!floors || !tables) return <Spinner />;
  return (
    <div className="grid" style={{ gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
      <div className="card pad">
        <h4 style={{ marginTop: 0 }}>Floors</h4>
        <form className="row" style={{ marginBottom: 10 }} onSubmit={async (e) => { e.preventDefault(); if (!floorName.trim()) return; await api('/dinein/floors', { method: 'POST', body: { title: floorName } }); setFloorName(''); load(); }}>
          <input placeholder="e.g. Ground floor" value={floorName} onChange={(e) => setFloorName(e.target.value)}
            style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 9, padding: '7px 10px' }} />
          <button className="btn sm">Add</button>
        </form>
        {floors.map((f) => (
          <div key={f._id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{f.title}</span>
            <button className="btn danger sm" onClick={async () => { if (confirm('Delete floor?')) { await api(`/dinein/floors/${f._id}`, { method: 'DELETE' }); load(); } }}>✕</button>
          </div>
        ))}
        {floors.length === 0 && <p className="muted">No floors yet.</p>}
      </div>

      <div className="card pad">
        <h4 style={{ marginTop: 0 }}>Tables</h4>
        <div className="filters" style={{ marginBottom: 12 }}>
          <input placeholder="Table name (e.g. T1)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}>
            <option value="">No floor</option>
            {floors.map((f) => <option key={f._id} value={f._id}>{f.title}</option>)}
          </select>
          <input type="number" min="1" style={{ width: 90 }} title="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <button className="btn sm" disabled={!form.title.trim()} onClick={async () => {
            await api('/dinein/tables', { method: 'POST', body: { ...form, floor: form.floor || undefined, capacity: Number(form.capacity) || 4 } });
            setForm({ title: '', floor: form.floor, capacity: 4 }); load();
          }}>+ Add table</button>
        </div>
        {tables.length === 0 ? <Empty icon="🪑" text="No tables yet." /> : (
          <table className="table">
            <thead><tr><th>Table</th><th>Floor</th><th>Capacity</th><th></th></tr></thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t._id}>
                  <td><strong>{t.title}</strong></td>
                  <td>{t.floor?.title || '—'}</td>
                  <td>{t.capacity}</td>
                  <td><button className="btn danger sm" onClick={async () => { if (confirm('Delete table?')) { await api(`/dinein/tables/${t._id}`, { method: 'DELETE' }); load(); } }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Waiters() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const load = () => api('/dinein/waiters').then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);
  if (!items) return <Spinner />;
  return (
    <div className="card pad" style={{ maxWidth: 640 }}>
      <div className="filters" style={{ marginBottom: 12 }}>
        <input placeholder="Waiter name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button className="btn sm" disabled={!form.name.trim()} onClick={async () => {
          await api('/dinein/waiters', { method: 'POST', body: form });
          setForm({ name: '', phone: '' }); load();
        }}>+ Add waiter</button>
      </div>
      {items.length === 0 ? <Empty icon="🤵" text="No waiters yet." /> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w._id}>
                <td><strong>{w.name}</strong></td>
                <td>{w.phone}</td>
                <td><Chip s={w.active ? 'active' : 'suspended'} /></td>
                <td>
                  <div className="row">
                    <button className="btn gray sm" onClick={async () => { await api(`/dinein/waiters/${w._id}`, { method: 'PUT', body: { active: !w.active } }); load(); }}>{w.active ? 'Disable' : 'Enable'}</button>
                    <button className="btn danger sm" onClick={async () => { if (confirm('Delete waiter?')) { await api(`/dinein/waiters/${w._id}`, { method: 'DELETE' }); load(); } }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Bookings() {
  const [items, setItems] = useState(null);
  const [tables, setTables] = useState([]);
  const [status, setStatus] = useState('');

  const load = () => api(`/dinein/bookings${status ? `?status=${status}` : ''}`).then((d) => setItems(d.items));
  useEffect(() => { setItems(null); load(); }, [status]);
  useEffect(() => { api('/dinein/tables').then((d) => setTables(d.items)); }, []);

  const update = async (id, body) => { await api(`/dinein/bookings/${id}`, { method: 'PUT', body }); load(); };

  if (!items) return <Spinner />;
  return (
    <>
      <div className="filters" style={{ marginBottom: 14 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option><option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option><option value="seated">Seated</option>
          <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      {items.length === 0 ? <Empty icon="📅" text="No table bookings." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Guest</th><th>Party</th><th>When</th><th>Table</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b._id}>
                  <td><strong>{b.name}</strong><div className="muted">{b.phone}{b.note ? ` · ${b.note}` : ''}</div></td>
                  <td>{b.partySize}</td>
                  <td>{dt(b.bookedFor)}</td>
                  <td>
                    <select value={b.table?._id || ''} onChange={(e) => update(b._id, { table: e.target.value || null })}>
                      <option value="">—</option>
                      {tables.map((t) => <option key={t._id} value={t._id}>{t.title} ({t.capacity})</option>)}
                    </select>
                  </td>
                  <td><Chip s={b.status} /></td>
                  <td>
                    <div className="row">
                      {b.status === 'pending' && <button className="btn sm" onClick={() => update(b._id, { status: 'confirmed' })}>Confirm</button>}
                      {b.status === 'confirmed' && <button className="btn sm" onClick={() => update(b._id, { status: 'seated' })}>Seat</button>}
                      {b.status === 'seated' && <button className="btn sm" onClick={() => update(b._id, { status: 'completed' })}>Complete</button>}
                      {['pending', 'confirmed'].includes(b.status) && <button className="btn danger sm" onClick={() => update(b._id, { status: 'cancelled' })}>Cancel</button>}
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
