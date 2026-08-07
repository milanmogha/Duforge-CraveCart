import { useEffect, useState, useCallback, useRef } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Empty } from '../components.jsx';
import TrackingMap from '../TrackingMap.jsx';

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'out_for_delivery'];

export default function Deliveries() {
  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState(null);
  const [mine, setMine] = useState(null);
  const [note, setNote] = useState('');
  const [myPos, setMyPos] = useState(null);
  const [simulating, setSimulating] = useState(null); // order id being simulated
  const simRef = useRef(null);
  const lastPushRef = useRef(0);

  const pushLocation = async (lat, lng) => {
    setMyPos({ lat, lng });
    try { await api('/rider/location', { method: 'PUT', body: { lat, lng } }); } catch { /* offline is fine */ }
  };

  const stopSim = useCallback(() => {
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = null;
    setSimulating(null);
  }, []);

  // Demo mode: glide from the store to the customer, pushing location every 2s.
  const startSim = (o) => {
    stopSim();
    const from = {
      lat: o.partner?.partnerProfile?.lat ?? 12.9716,
      lng: o.partner?.partnerProfile?.lng ?? 77.5946,
    };
    const to = {
      lat: o.deliveryAddress?.lat ?? from.lat + 0.02,
      lng: o.deliveryAddress?.lng ?? from.lng + 0.02,
    };
    let step = 0;
    const steps = 25;
    setSimulating(o._id);
    pushLocation(from.lat, from.lng);
    simRef.current = setInterval(() => {
      step += 1;
      const t = step / steps;
      pushLocation(from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t);
      if (step >= steps) stopSim();
    }, 2000);
  };
  useEffect(() => stopSim, [stopSim]);

  // Real GPS: while there is an active delivery, watch position and push every ~8s.
  const hasActive = (mine || []).some((o) => ACTIVE_STATUSES.includes(o.status));
  useEffect(() => {
    if (!hasActive || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPushRef.current < 8000) return;
        lastPushRef.current = now;
        pushLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => { /* denied — rider can use Simulate ride instead */ },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasActive]);

  const load = useCallback(() => {
    api('/orders/rider/available').then((d) => { setAvailable(d.orders); setNote(d.message || ''); });
    api(`/orders/rider/mine${tab === 'active' ? '?active=true' : ''}`).then((d) => setMine(d.orders));
  }, [tab]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const accept = async (id) => {
    try { await api(`/orders/${id}/accept`, { method: 'POST' }); setTab('active'); load(); }
    catch (e) { alert(e.message); }
  };
  const setStatus = async (id, status) => {
    try {
      await api(`/orders/${id}/status`, { method: 'PUT', body: { status } });
      if (status === 'delivered' && simulating === id) stopSim();
      load();
    } catch (e) { alert(e.message); }
  };

  const firstActive = (mine || []).find((o) => ACTIVE_STATUSES.includes(o.status));

  const NEXT = {
    assigned: ['picked_up', 'Picked up from store'],
    ready: ['picked_up', 'Picked up from store'],
    picked_up: ['out_for_delivery', 'Start delivery'],
    out_for_delivery: ['delivered', '✓ Mark delivered'],
  };

  return (
    <>
      <div className="topbar"><h1>Deliveries</h1></div>
      <div className="tabs">
        <button className={tab === 'available' ? 'on' : ''} onClick={() => setTab('available')}>
          Available {available ? `(${available.length})` : ''}
        </button>
        <button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>My active</button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'available' && (
        !available ? <Spinner /> : (
          <>
            {note && <div className="card pad" style={{ marginBottom: 14, background: '#fffbeb' }}>{note}</div>}
            {available.length === 0 ? <Empty icon="🛵" text="No orders waiting for a rider right now. Auto-refreshes every 10s." /> : (
              <div className="grid cols-2">
                {available.map((o) => (
                  <div key={o._id} className="card pad">
                    <div className="spread">
                      <strong>{o.orderNumber}</strong>
                      <Chip s={o.status} />
                    </div>
                    <div style={{ margin: '8px 0' }}>
                      <div>🏪 <strong>{o.partner?.partnerProfile?.storeName}</strong></div>
                      <div className="muted">{o.partner?.partnerProfile?.address}, {o.partner?.partnerProfile?.city}</div>
                      <div style={{ marginTop: 6 }}>📍 Deliver to {o.deliveryAddress?.area || o.deliveryAddress?.city}</div>
                      <div className="muted">{o.items.length} item(s) · {o.paymentMethod === 'cod' ? `Collect ${money(o.grandTotal)} (COD)` : 'Prepaid'}</div>
                    </div>
                    <div className="spread">
                      <strong style={{ color: 'var(--green)' }}>Earn {money(o.deliveryCharge + o.tip)}</strong>
                      <button className="btn" onClick={() => accept(o._id)}>Accept</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      {tab === 'active' && firstActive && (
        <div style={{ marginBottom: 16 }}>
          <TrackingMap
            store={{
              lat: firstActive.partner?.partnerProfile?.lat,
              lng: firstActive.partner?.partnerProfile?.lng,
              label: `🏪 ${firstActive.partner?.partnerProfile?.storeName || 'Store'}`,
            }}
            destination={{
              lat: firstActive.deliveryAddress?.lat,
              lng: firstActive.deliveryAddress?.lng,
              label: '📍 Customer',
            }}
            rider={myPos ? { ...myPos, label: '🛵 You' } : null}
            height={280}
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {myPos
              ? 'Your live location is being shared with the customer.'
              : 'Waiting for GPS… or use “Simulate ride” below (demo).'}
          </div>
        </div>
      )}

      {tab !== 'available' && (
        !mine ? <Spinner /> : mine.length === 0 ? <Empty icon="📦" text={tab === 'active' ? 'No active deliveries.' : 'No past deliveries.'} /> : (
          <div className="grid cols-2">
            {mine.map((o) => (
              <div key={o._id} className="card pad">
                <div className="spread">
                  <strong>{o.orderNumber}</strong>
                  <Chip s={o.status} />
                </div>
                <div style={{ margin: '8px 0' }}>
                  <div>🏪 {o.partner?.partnerProfile?.storeName} <span className="muted">— {o.partner?.partnerProfile?.address}</span></div>
                  <div>👤 {o.customer?.name} <span className="muted">{o.customer?.phone}</span></div>
                  <div className="muted">📍 {o.deliveryAddress?.line1}, {o.deliveryAddress?.area && o.deliveryAddress.area + ', '}{o.deliveryAddress?.city}</div>
                  <div className="muted">
                    {o.paymentMethod === 'cod' ? `💵 Collect ${money(o.grandTotal)}` : '✓ Prepaid'} · your earning {money(o.deliveryCharge + o.tip)}
                    {o.tip > 0 && ` (incl. ${money(o.tip)} tip)`}
                  </div>
                  <div className="muted">{dt(o.createdAt)}</div>
                </div>
                {NEXT[o.status] && (
                  <button className="btn block" onClick={() => setStatus(o._id, NEXT[o.status][0])}>
                    {NEXT[o.status][1]}
                  </button>
                )}
                {ACTIVE_STATUSES.includes(o.status) && (
                  <button
                    className={`btn block ${simulating === o._id ? 'danger' : 'gray'}`}
                    style={{ marginTop: 8 }}
                    onClick={() => (simulating === o._id ? stopSim() : startSim(o))}
                  >
                    {simulating === o._id ? '⏸ Stop simulation' : '▶ Simulate ride (demo GPS)'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
