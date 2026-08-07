import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, dt, money } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, Chip, ChipSelect, Empty, Muted, Spinner, Spread } from '../components.jsx';

const STATUSES = [
  ['', 'All'],
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['preparing', 'Preparing'],
  ['out_for_delivery', 'On the way'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

export default function OrdersScreen({ navigation }) {
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const d = await api(`/orders/my${status ? `?status=${status}` : ''}`);
    setData(d);
  }, [user, status]);

  useFocusEffect(
    useCallback(() => { load(); }, [load])
  );

  if (loading) return <Spinner />;
  if (!user) {
    return <Empty icon="🔐" text="Login to see your orders." action={<Btn title="Login" onPress={() => navigation.navigate('Auth')} />} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12 }}>
        <ChipSelect options={STATUSES} value={status} onChange={setStatus} />
      </View>
      {!data ? (
        <Spinner />
      ) : data.orders.length === 0 ? (
        <Empty icon="📦" text="No orders yet." action={<Btn title="Start shopping" onPress={() => navigation.navigate('HomeTab')} />} />
      ) : (
        <FlatList
          data={data.orders}
          keyExtractor={(o) => o._id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, gap: 10 }}
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          renderItem={({ item: o }) => (
            <Card style={{ padding: 14, gap: 4 }} onPress={() => navigation.push('OrderDetail', { id: o._id })}>
              <Spread>
                <Bold>{o.orderNumber}</Bold>
                <Bold style={{ color: C.brand }}>{money(o.grandTotal)}</Bold>
              </Spread>
              <Muted>{o.partner?.partnerProfile?.storeName || o.partner?.name}</Muted>
              <Spread>
                <Muted>{dt(o.createdAt)} · {o.items.length} item(s)</Muted>
                <Chip s={o.status} />
              </Spread>
            </Card>
          )}
        />
      )}
    </View>
  );
}
