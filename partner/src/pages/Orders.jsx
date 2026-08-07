import { useEffect, useState, useRef } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

export default function Orders() {
  const [tab, setTab] = useState('active');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState('Item unavailable');
  const [rejectModal, setRejectModal] = useState(false);
  const timer = useRef(null);

  const load = () => {
    const q = tab === 'active' ? '?active=true' : tab === 'all' ? '' : `?status=${tab}`;
    return api(`/orders/partner${q}`).then(setData);
  };
  useEffect(() => {
    setData(null);
    load();
    timer.current = setInterval(load, 10000); // poll for new orders
    return () => clearInterval(timer.current);
  }, [tab]);

  const setStatus = async (order, status, note) => {
    try {
      await api(`/orders/${order._id}/status`, { method: 'PUT', body: { status, reason: note } });
      setOpen(null); setRejectModal(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const NEXT = { pending: ['confirmed'], confirmed: ['preparing'], preparing: ['ready'] };

  return (
    <>
      <div className="topbar"><h1>Orders</h1></div>
      <div className="tabs">
        {[['active', 'Active'], ['delivered', 'Delivered'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {!data ? <Spinner /> : data.orders.length === 0 ? <Empty icon="📦" text="No orders here." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Rider</th><th>Actions</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o._id}>
                  <td><strong>{o.orderNumber}</strong><div className="muted">{dt(o.createdAt)}</div></td>
                  <td>{o.customer?.name}<div className="muted">{o.customer?.phone}</div></td>
                  <td>
                    {o.items.map((it, i) => (
                      <div key={i} style={{ fontSize: 13.5 }}>{it.qty}× {it.title}{it.variantName && ` (${it.variantName})`}</div>
                    ))}
                    {o.customerNote && <div className="muted">📝 {o.customerNote}</div>}
                  </td>
                  <td><strong>{money(o.grandTotal)}</strong></td>
                  <td>{o.paymentMethod.toUpperCase()}<div><Chip s={o.paymentStatus} /></div></td>
                  <td><Chip s={o.status} /></td>
                  <td>{o.selfPickup ? <span className="chip ready">🏪 self pickup</span> : o.rider?.name || <span className="muted">—</span>}</td>
                  <td>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      {o.status === 'pending' && (
                        <>
                          <button className="btn green sm" onClick={() => setStatus(o, 'confirmed')}>Accept</button>
                          <button className="btn danger sm" onClick={() => { setOpen(o); setRejectModal(true); }}>Reject</button>
                        </>
                      )}
                      {(NEXT[o.status] || []).filter((s) => s !== 'confirmed').map((s) => (
                        <button key={s} className="btn sm" onClick={() => setStatus(o, s)}>
                          {s === 'preparing' ? 'Start preparing' : s === 'ready' ? 'Mark ready' : s}
                        </button>
                      ))}
                      {o.selfPickup && o.status === 'ready' && (
                        <button className="btn green sm" onClick={() => setStatus(o, 'delivered')}>✓ Handed over</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectModal && open && (
        <Modal title={`Reject order ${open.orderNumber}?`} onClose={() => setRejectModal(false)}>
          <div className="field">
            <label>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Item unavailable</option>
              <option>Store too busy</option>
              <option>Closing soon</option>
              <option>Other</option>
            </select>
          </div>
          <p className="muted">Prepaid orders are refunded to the customer's wallet automatically.</p>
          <div className="row">
            <button className="btn danger" onClick={() => setStatus(open, 'cancelled', reason)}>Reject order</button>
            <button className="btn gray" onClick={() => setRejectModal(false)}>Back</button>
          </div>
        </Modal>
      )}
    </>
  );
}
