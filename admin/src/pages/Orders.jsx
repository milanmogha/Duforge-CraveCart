import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'refunded'];

export default function Orders() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const load = () => {
    const q = new URLSearchParams({ page });
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    api(`/admin/orders?${q}`).then(setData);
  };
  useEffect(load, [status, page]);

  const view = async (id) => {
    const { order } = await api(`/orders/${id}`);
    setOpen(order);
  };

  const setOrderStatus = async (s) => {
    const { order } = await api(`/orders/${open._id}/status`, { method: 'PUT', body: { status: s, reason: 'Admin action' } });
    setOpen(order); load();
  };

  return (
    <>
      <div className="topbar">
        <h1>Orders</h1>
        <div className="filters">
          <input placeholder="Search order #…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      {!data ? <Spinner /> : data.orders.length === 0 ? <Empty text="No orders found." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Store</th><th>Rider</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th><th></th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o._id}>
                  <td><strong>{o.orderNumber}</strong></td>
                  <td>{o.customer?.name}</td>
                  <td>{o.partner?.partnerProfile?.storeName || o.partner?.name}</td>
                  <td>{o.rider?.name || <span className="muted">—</span>}</td>
                  <td>{money(o.grandTotal)}</td>
                  <td><Chip s={o.paymentStatus} /> <span className="muted">{o.paymentMethod}</span></td>
                  <td><Chip s={o.status} /></td>
                  <td className="muted">{dt(o.createdAt)}</td>
                  <td><button className="btn gray sm" onClick={() => view(o._id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {Array.from({ length: data.pages }, (_, i) => (
            <button key={i} className={`btn sm ${page === i + 1 ? '' : 'gray'}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
        </div>
      )}

      {open && (
        <Modal wide title={`Order ${open.orderNumber}`} onClose={() => setOpen(null)}>
          <div className="spread">
            <div>
              <Chip s={open.status} /> <Chip s={open.paymentStatus} />
              <div className="muted" style={{ marginTop: 6 }}>
                {open.customer?.name} → {open.partner?.partnerProfile?.storeName} {open.rider ? `→ 🛵 ${open.rider.name}` : ''}
              </div>
            </div>
            <strong style={{ fontSize: 20 }}>{money(open.grandTotal)}</strong>
          </div>
          <hr className="divider" />
          {open.items.map((it, i) => (
            <div key={i} className="spread" style={{ padding: '4px 0' }}>
              <span>{it.title} {it.variantName && `(${it.variantName})`} × {it.qty}</span>
              <span>{money(it.lineTotal)}</span>
            </div>
          ))}
          <hr className="divider" />
          <div className="muted">
            Items {money(open.itemsTotal)} · Tax {money(open.taxTotal)} · Delivery {money(open.deliveryCharge)}
            {open.tip > 0 && ` · Tip ${money(open.tip)}`}
            {open.discount > 0 && ` · Discount −${money(open.discount)} (${open.promoCode})`}
          </div>
          {open.settled && (
            <div className="muted">Settled: partner {money(open.partnerEarning)} · rider {money(open.riderEarning)} · commission {money(open.commissionAmount)}</div>
          )}
          <div className="muted">📍 {open.deliveryAddress?.line1}, {open.deliveryAddress?.city}</div>
          <hr className="divider" />
          <h4 style={{ margin: '0 0 8px' }}>Timeline</h4>
          <ul className="timeline">
            {[...open.statusHistory].reverse().map((h, i) => (
              <li key={i}><strong style={{ textTransform: 'capitalize' }}>{h.status.replaceAll('_', ' ')}</strong> <span className="muted">{dt(h.at)}{h.note ? ` — ${h.note}` : ''}</span></li>
            ))}
          </ul>
          {!['delivered', 'completed', 'cancelled', 'refunded'].includes(open.status) && (
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <span className="muted">Admin override:</span>
              {['confirmed', 'cancelled', 'delivered'].map((s) => (
                <button key={s} className="btn gray sm" onClick={() => setOrderStatus(s)}>{s}</button>
              ))}
            </div>
          )}
          {open.status === 'cancelled' && open.paymentStatus !== 'refunded' && open.paymentMethod !== 'cod' && (
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setOrderStatus('refunded')}>Mark refunded</button>
          )}
        </Modal>
      )}
    </>
  );
}
