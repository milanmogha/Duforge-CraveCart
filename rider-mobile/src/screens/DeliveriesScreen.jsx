import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import * as Location from 'expo-location';
import { api, money, dt } from '../api.js';
import TrackingMap from '../TrackingMap.jsx';
import { Bold, Btn, Card, Chip, ChipSelect, Empty, ErrorText, Muted, Row, Spinner, Spread } from '../components.jsx';
import { C } from '../theme.js';

const ACTIVE_STATUSES = ['assigned', 'picked_up', 'out_for_delivery'];
const TABS = [['available', 'Available'], ['active', 'My active'], ['history', 'History']];
const NEXT = {
  assigned: ['picked_up', 'Picked up from store'],
  ready: ['picked_up', 'Picked up from store'],
  picked_up: ['out_for_delivery', 'Start delivery'],
  out_for_delivery: ['delivered', '✓ Mark delivered'],
};

export default function DeliveriesScreen() {
  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState(null);
  const [mine, setMine] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [myPos, setMyPos] = useState(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [simulating, setSimulating] = useState(null); // order id being simulated
  const [refreshing, setRefreshing] = useState(false);
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

  // Real GPS: while there is an active delivery, watch position and push every ~8s
  // (mirror of the web console's navigator.geolocation.watchPosition).
  const hasActive = (mine || []).some((o) => ACTIVE_STATUSES.includes(o.status));
  useEffect(() => {
    if (!hasActive) return;
    let sub = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsDenied(true); return; }
      setGpsDenied(false);
      if (cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (pos) => {
          const now = Date.now();
          if (now - lastPushRef.current < 8000) return;
          lastPushRef.current = now;
          pushLocation(pos.coords.latitude, pos.coords.longitude);
        }
      );
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, [hasActive]);

  const load = useCallback(() => Promise.all([
    api('/orders/rider/available').then((d) => { setAvailable(d.orders); setNote(d.message || ''); }),
    api(`/orders/rider/mine${tab === 'active' ? '?active=true' : ''}`).then((d) => setMine(d.orders)),
  ]).catch(() => {}), [tab]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const accept = async (id) => {
    setErr('');
    try { await api(`/orders/${id}/accept`, { method: 'POST' }); setTab('active'); load(); }
    catch (e) { setErr(e.message); }
  };
  const setStatus = async (id, status) => {
    setErr('');
    try {
      await api(`/orders/${id}/status`, { method: 'PUT', body: { status } });
      if (status === 'delivered' && simulating === id) stopSim();
      load();
    } catch (e) { setErr(e.message); }
  };

  const firstActive = (mine || []).find((o) => ACTIVE_STATUSES.includes(o.status));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ChipSelect
        options={TABS.map(([k, l]) => [k, k === 'available' && available ? `${l} (${available.length})` : l])}
        value={tab}
        onChange={setTab}
        style={{ flexGrow: 0, paddingHorizontal: 14, paddingVertical: 10 }}
      />
      <ErrorText>{err ? `  ${err}` : ''}</ErrorText>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: 4, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {tab === 'available' && (
          !available ? <Spinner /> : (
            <>
              {!!note && (
                <Card style={{ padding: 14, backgroundColor: '#fffbeb', borderColor: '#f6d089' }}>
                  <Muted style={{ color: C.ink }}>{note}</Muted>
                </Card>
              )}
              {available.length === 0 ? (
                <Empty icon="🛵" text="No orders waiting for a rider right now. Auto-refreshes every 10s." />
              ) : available.map((o) => (
                <Card key={o._id} style={{ padding: 14, gap: 8 }}>
                  <Spread>
                    <Bold>{o.orderNumber}</Bold>
                    <Chip s={o.status} />
                  </Spread>
                  <View style={{ gap: 2 }}>
                    <Bold>🏪 {o.partner?.partnerProfile?.storeName}</Bold>
                    <Muted>{o.partner?.partnerProfile?.address}, {o.partner?.partnerProfile?.city}</Muted>
                    <Muted style={{ color: C.ink, marginTop: 4 }}>📍 Deliver to {o.deliveryAddress?.area || o.deliveryAddress?.city}</Muted>
                    <Muted>{o.items.length} item(s) · {o.paymentMethod === 'cod' ? `Collect ${money(o.grandTotal)} (COD)` : 'Prepaid'}</Muted>
                  </View>
                  <Spread>
                    <Bold style={{ color: C.green }}>Earn {money(o.deliveryCharge + o.tip)}</Bold>
                    <Btn sm title="Accept" onPress={() => accept(o._id)} />
                  </Spread>
                </Card>
              ))}
            </>
          )
        )}

        {tab === 'active' && firstActive && (
          <View style={{ gap: 6 }}>
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
              height={260}
            />
            <Muted style={{ fontSize: 12 }}>
              {myPos
                ? 'Your live location is being shared with the customer.'
                : gpsDenied
                  ? 'Location permission denied — use “Simulate ride” below (demo).'
                  : 'Waiting for GPS… or use “Simulate ride” below (demo).'}
            </Muted>
          </View>
        )}

        {tab !== 'available' && (
          !mine ? <Spinner /> : mine.length === 0 ? (
            <Empty icon="📦" text={tab === 'active' ? 'No active deliveries.' : 'No past deliveries.'} />
          ) : mine.map((o) => (
            <Card key={o._id} style={{ padding: 14, gap: 8 }}>
              <Spread>
                <Bold>{o.orderNumber}</Bold>
                <Chip s={o.status} />
              </Spread>
              <View style={{ gap: 2 }}>
                <Muted style={{ color: C.ink }}>🏪 {o.partner?.partnerProfile?.storeName} <Muted>— {o.partner?.partnerProfile?.address}</Muted></Muted>
                <Muted style={{ color: C.ink }}>👤 {o.customer?.name} <Muted>{o.customer?.phone}</Muted></Muted>
                <Muted>📍 {o.deliveryAddress?.line1}{o.deliveryAddress?.area ? `, ${o.deliveryAddress.area}` : ''}, {o.deliveryAddress?.city}</Muted>
                <Muted>
                  {o.paymentMethod === 'cod' ? `💵 Collect ${money(o.grandTotal)}` : '✓ Prepaid'} · your earning {money(o.deliveryCharge + o.tip)}
                  {o.tip > 0 ? ` (incl. ${money(o.tip)} tip)` : ''}
                </Muted>
                <Muted>{dt(o.createdAt)}</Muted>
              </View>
              {NEXT[o.status] && (
                <Btn block title={NEXT[o.status][1]} onPress={() => setStatus(o._id, NEXT[o.status][0])} />
              )}
              {ACTIVE_STATUSES.includes(o.status) && (
                <Btn
                  block
                  kind={simulating === o._id ? 'danger' : 'gray'}
                  title={simulating === o._id ? '⏸ Stop simulation' : '▶ Simulate ride (demo GPS)'}
                  onPress={() => (simulating === o._id ? stopSim() : startSim(o))}
                />
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
