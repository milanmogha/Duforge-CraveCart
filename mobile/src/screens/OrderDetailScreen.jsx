import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { io } from 'socket.io-client';
import { SOCKET_ORIGIN, SOCKET_PATH, api, dt, img, money } from '../api.js';
import { useCart } from '../ctx.jsx';
import { C, F } from '../theme.js';
import TrackingMap, { etaMinutes } from '../TrackingMap.jsx';
import { Bold, Btn, Card, Chip, ErrorText, Field, Input, Muted, Row, Sheet, Spinner, Spread, Stars, SuccessText } from '../components.jsx';

const TRACKABLE = ['assigned', 'picked_up', 'out_for_delivery'];
const FINISHED = ['delivered', 'completed', 'cancelled', 'refunded'];

export default function OrderDetailScreen({ route, navigation }) {
  const { id, placed } = route.params;
  const { refreshCart } = useCart();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const [reorderMsg, setReorderMsg] = useState('');
  const [rateModal, setRateModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [riderRating, setRiderRating] = useState(5);
  const [comment, setComment] = useState('');
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [tracking, setTracking] = useState(null);

  const load = useCallback(
    () => api(`/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setErr(e.message)),
    [id]
  );
  useEffect(() => { load(); }, [load]);

  // Live status + rider location over socket.io (same events the web app uses)
  useEffect(() => {
    if (!order) return;
    const active = !FINISHED.includes(order.status);
    const trackable = !order.selfPickup && TRACKABLE.includes(order.status);
    if (!active && !trackable) { setTracking(null); return; }

    const socket = io(SOCKET_ORIGIN, { path: SOCKET_PATH, transports: ['websocket', 'polling'] });
    if (active) socket.on(`order_status_${order._id}`, () => load());

    let stop = false;
    if (trackable) {
      api(`/orders/${id}/tracking`).then((d) => { if (!stop) setTracking(d.tracking); }).catch(() => {});
      if (order.rider) {
        socket.on(`rider_location_${order.rider._id}`, (loc) => {
          setTracking((prev) =>
            prev ? { ...prev, rider: { ...prev.rider, lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt } } : prev
          );
        });
      }
    }
    return () => { stop = true; socket.disconnect(); };
  }, [order?._id, order?.status, order?.rider?._id, id, load]);

  if (err) return <ErrorText>{err}</ErrorText>;
  if (!order) return <Spinner />;

  const canCancel = ['pending', 'confirmed', 'preparing'].includes(order.status);
  const canRate = ['delivered', 'completed'].includes(order.status) && !order.rated;
  const finished = FINISHED.includes(order.status);

  const doReorder = async () => {
    setReorderMsg('');
    try {
      const d = await api(`/orders/${order._id}/reorder`, { method: 'POST' });
      await refreshCart();
      setReorderMsg(d.message + (d.skipped?.length ? ` (unavailable: ${d.skipped.join(', ')})` : ''));
      setTimeout(() => navigation.navigate('CartTab'), 900);
    } catch (e) { setReorderMsg(e.message); }
  };

  const doCancel = async () => {
    try {
      const d = await api(`/orders/${order._id}/status`, { method: 'PUT', body: { status: 'cancelled', reason: cancelReason } });
      setOrder(d.order); setCancelModal(false);
    } catch (e) { setErr(e.message); }
  };

  const doRate = async () => {
    try {
      const d = await api(`/orders/${order._id}/rate`, {
        method: 'POST',
        body: { rating, comment, riderRating: order.rider ? riderRating : undefined },
      });
      setOrder(d.order); setRateModal(false);
    } catch (e) { setErr(e.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}>
      {placed && (
        <Card style={{ padding: 14, backgroundColor: '#dcfce7', borderColor: '#86efac' }}>
          <Bold>🎉 Order placed successfully! The store has been notified.</Bold>
        </Card>
      )}

      <Spread>
        <Bold style={{ fontSize: 18 }}>{order.orderNumber}</Bold>
        <Chip s={order.status} />
      </Spread>
      <Muted>Placed {dt(order.createdAt)} · {order.paymentMethod.toUpperCase()} · payment {order.paymentStatus}</Muted>

      <Card style={{ padding: 14, gap: 8 }}>
        <Bold style={{ fontSize: 15 }}>🏪 {order.partner?.partnerProfile?.storeName}</Bold>
        {order.items.map((it, i) => (
          <Spread key={i} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
            <Row style={{ flex: 1 }}>
              {!!it.image && <Image source={{ uri: img(it.image) }} style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: C.line }} />}
              <View style={{ flex: 1 }}>
                <Bold>{it.title}</Bold>
                <Muted>
                  {it.variantName ? `${it.variantName} · ` : ''}qty {it.qty}
                  {it.addons?.length ? ` · ${it.addons.map((a) => a.name).join(', ')}` : ''}
                </Muted>
              </View>
            </Row>
            <Bold>{money(it.lineTotal)}</Bold>
          </Spread>
        ))}
        <View style={{ borderTopWidth: 1, borderTopColor: C.line }} />
        <Spread><Muted>Items</Muted><Muted>{money(order.itemsTotal)}</Muted></Spread>
        <Spread><Muted>Taxes</Muted><Muted>{money(order.taxTotal)}</Muted></Spread>
        <Spread><Muted>Delivery</Muted><Muted>{order.deliveryCharge === 0 ? 'FREE' : money(order.deliveryCharge)}</Muted></Spread>
        {order.tip > 0 && <Spread><Muted>Rider tip</Muted><Muted>{money(order.tip)}</Muted></Spread>}
        {order.discount > 0 && (
          <Spread>
            <Muted style={{ color: C.green }}>Discount {order.promoCode ? `(${order.promoCode})` : ''}</Muted>
            <Muted style={{ color: C.green }}>−{money(order.discount)}</Muted>
          </Spread>
        )}
        <Spread>
          <Text style={{ fontFamily: F.b, fontSize: 16 }}>Total</Text>
          <Text style={{ fontFamily: F.b, fontSize: 16 }}>{money(order.grandTotal)}</Text>
        </Spread>
      </Card>

      {order.rider && (
        <Card style={{ padding: 14, gap: 8 }}>
          <Spread>
            <Bold style={{ fontSize: 15 }}>🛵 Your rider</Bold>
            {tracking?.rider?.lat != null && (
              <Chip s={`ETA ~${etaMinutes(tracking.rider, tracking.destination) ?? '–'} min`} color={C.brand} />
            )}
          </Spread>
          <Spread>
            <View>
              <Bold>{order.rider.name}</Bold>
              <Muted>{order.rider.riderProfile?.vehicleType} · {order.rider.phone}</Muted>
            </View>
            {tracking?.rider?.updatedAt && (
              <Muted style={{ fontSize: 11 }}>
                updated {Math.max(0, Math.round((Date.now() - new Date(tracking.rider.updatedAt)) / 1000))}s ago
              </Muted>
            )}
          </Spread>
          {tracking && (
            <>
              <TrackingMap store={tracking.store} destination={tracking.destination} rider={tracking.rider} height={260} />
              <Muted style={{ fontSize: 11.5 }}>Live map updates while your order is on the move.</Muted>
            </>
          )}
        </Card>
      )}

      <Card style={{ padding: 14, gap: 4 }}>
        <Bold style={{ fontSize: 15 }}>{order.selfPickup ? '🏪 Self pickup at store' : '📍 Delivering to'}</Bold>
        <Bold>{order.deliveryAddress?.label}</Bold>
        <Muted>
          {order.deliveryAddress?.line1}, {order.deliveryAddress?.area ? order.deliveryAddress.area + ', ' : ''}
          {order.deliveryAddress?.city} {order.deliveryAddress?.pincode}
        </Muted>
        {!!order.customerNote && <Muted>📝 {order.customerNote}</Muted>}
      </Card>

      <Card style={{ padding: 14, gap: 10 }}>
        <Bold style={{ fontSize: 15 }}>Status timeline</Bold>
        {[...order.statusHistory].reverse().map((h, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i === 0 ? C.brand : C.line, marginTop: 5 }} />
            <View style={{ flex: 1 }}>
              <Bold style={{ textTransform: 'capitalize' }}>{h.status.replaceAll('_', ' ')}</Bold>
              <Muted>{dt(h.at)}{h.note ? ` — ${h.note}` : ''}</Muted>
            </View>
          </Row>
        ))}
      </Card>

      {canCancel && <Btn block kind="danger" title="Cancel order" onPress={() => setCancelModal(true)} />}
      {canRate && <Btn block title="★ Rate this order" onPress={() => setRateModal(true)} />}
      {finished && <Btn block kind="ghost" title="🔁 Re-order" onPress={doReorder} />}
      {reorderMsg ? (reorderMsg.includes('added') ? <SuccessText>{reorderMsg}</SuccessText> : <ErrorText>{reorderMsg}</ErrorText>) : null}
      {order.rated && <SuccessText>✓ You rated this order. Thanks!</SuccessText>}

      {cancelModal && (
        <Sheet title="Cancel order?" onClose={() => setCancelModal(false)}>
          <Field label="Reason">
            {['Changed my mind', 'Ordered by mistake', 'Taking too long', 'Other'].map((r) => (
              <Btn key={r} sm kind={cancelReason === r ? 'primary' : 'gray'} title={r} onPress={() => setCancelReason(r)} style={{ marginBottom: 6 }} />
            ))}
          </Field>
          <Muted style={{ marginBottom: 12 }}>Prepaid amounts are refunded instantly to your wallet.</Muted>
          <Row>
            <Btn kind="danger" title="Yes, cancel order" onPress={doCancel} />
            <Btn kind="gray" title="Keep order" onPress={() => setCancelModal(false)} />
          </Row>
        </Sheet>
      )}

      {rateModal && (
        <Sheet title="Rate your order" onClose={() => setRateModal(false)}>
          <Field label="Food & store"><Stars value={rating} onChange={setRating} size={30} /></Field>
          {order.rider && (
            <Field label={`Delivery by ${order.rider.name}`}><Stars value={riderRating} onChange={setRiderRating} size={30} /></Field>
          )}
          <Field label="Comment (optional)">
            <Input multiline placeholder="How was it?" value={comment} onChangeText={setComment} />
          </Field>
          <Btn block title="Submit rating" onPress={doRate} />
        </Sheet>
      )}
    </ScrollView>
  );
}
