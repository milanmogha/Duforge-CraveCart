import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { api, money, dt } from '../api.js';
import { Bold, Btn, Card, Chip, ChipSelect, Empty, ErrorText, Muted, Row, Sheet, Spinner, Spread } from '../components.jsx';
import { C } from '../theme.js';

const TABS = [['active', 'Active'], ['delivered', 'Delivered'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']];
const REJECT_REASONS = ['Item unavailable', 'Store too busy', 'Closing soon', 'Other'];
const NEXT = { pending: ['confirmed'], confirmed: ['preparing'], preparing: ['ready'] };

export default function OrdersScreen() {
  const [tab, setTab] = useState('active');
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null); // order being rejected
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const q = tab === 'active' ? '?active=true' : tab === 'all' ? '' : `?status=${tab}`;
    return api(`/orders/partner${q}`).then(setData).catch(() => {});
  }, [tab]);

  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(load, 10000); // poll for new orders, same as the web console
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const setStatus = async (order, status, note) => {
    setErr('');
    try {
      await api(`/orders/${order._id}/status`, { method: 'PUT', body: { status, reason: note } });
      setRejecting(null);
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ChipSelect options={TABS} value={tab} onChange={setTab} style={{ flexGrow: 0, paddingHorizontal: 14, paddingVertical: 10 }} />
      <ErrorText>{err ? `  ${err}` : ''}</ErrorText>
      {!data ? <Spinner /> : data.orders.length === 0 ? (
        <Empty icon="📦" text="No orders here. New orders appear automatically." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingTop: 4, gap: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        >
          {data.orders.map((o) => (
            <Card key={o._id} style={{ padding: 14, gap: 8 }}>
              <Spread>
                <Bold>{o.orderNumber}</Bold>
                <Chip s={o.status} />
              </Spread>
              <Muted>{dt(o.createdAt)} · {o.customer?.name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''}</Muted>
              <View style={{ gap: 2 }}>
                {o.items.map((it, i) => (
                  <Muted key={i} style={{ color: C.ink }}>
                    {it.qty}× {it.title}{it.variantName ? ` (${it.variantName})` : ''}
                  </Muted>
                ))}
                {!!o.customerNote && <Muted>📝 {o.customerNote}</Muted>}
              </View>
              <Spread>
                <Bold style={{ fontSize: 16 }}>{money(o.grandTotal)}</Bold>
                <Row>
                  <Muted>{o.paymentMethod.toUpperCase()}</Muted>
                  <Chip s={o.paymentStatus} />
                </Row>
              </Spread>
              <Muted>
                {o.selfPickup ? '🏪 Self pickup' : o.rider?.name ? `🛵 ${o.rider.name}` : '🛵 No rider yet'}
              </Muted>

              <Row style={{ flexWrap: 'wrap' }}>
                {o.status === 'pending' && (
                  <>
                    <Btn sm kind="green" title="Accept" onPress={() => setStatus(o, 'confirmed')} />
                    <Btn sm kind="danger" title="Reject" onPress={() => { setReason(REJECT_REASONS[0]); setRejecting(o); }} />
                  </>
                )}
                {(NEXT[o.status] || []).filter((s) => s !== 'confirmed').map((s) => (
                  <Btn key={s} sm title={s === 'preparing' ? 'Start preparing' : s === 'ready' ? 'Mark ready' : s} onPress={() => setStatus(o, s)} />
                ))}
                {o.selfPickup && o.status === 'ready' && (
                  <Btn sm kind="green" title="✓ Handed over" onPress={() => setStatus(o, 'delivered')} />
                )}
              </Row>
            </Card>
          ))}
        </ScrollView>
      )}

      {rejecting && (
        <Sheet title={`Reject order ${rejecting.orderNumber}?`} onClose={() => setRejecting(null)}>
          <Muted style={{ marginBottom: 8 }}>Reason</Muted>
          <ChipSelect options={REJECT_REASONS.map((r) => [r, r])} value={reason} onChange={setReason} style={{ flexGrow: 0, marginBottom: 12 }} />
          <Muted style={{ marginBottom: 14 }}>Prepaid orders are refunded to the customer's wallet automatically.</Muted>
          <Row>
            <Btn kind="danger" title="Reject order" onPress={() => setStatus(rejecting, 'cancelled', reason)} style={{ flex: 1 }} />
            <Btn kind="gray" title="Back" onPress={() => setRejecting(null)} style={{ flex: 1 }} />
          </Row>
        </Sheet>
      )}
    </View>
  );
}
