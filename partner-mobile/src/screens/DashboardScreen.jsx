import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { api, money, dt } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { Bold, Btn, Card, Chip, Bars, Muted, Spinner, Spread, Stat } from '../components.jsx';
import { C } from '../theme.js';

export default function DashboardScreen() {
  const { logout } = useAuth();
  const [d, setD] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/partner/dashboard').then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!d) return <Spinner />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      {d.kycStatus !== 'approved' && (
        <Card style={{ padding: 14, backgroundColor: '#fffbeb', borderColor: '#f6d089' }}>
          <Bold>KYC status: {d.kycStatus || 'pending'}</Bold>
          <Muted>Your store must be approved by admin before it appears to customers.</Muted>
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="Active orders" value={d.activeOrders} sub={`${d.todayOrders} orders today`} />
        <Stat label="Total sales" value={money(d.totalSales)} sub={`${d.totalOrders} orders all-time`} />
        <Stat label="Earnings (after commission)" value={money(d.totalEarning)} sub={`Wallet ${money(d.walletBalance)}`} />
        <Stat label="Rating" value={d.rating.count ? `★ ${d.rating.avg}` : '—'} sub={`${d.rating.count} rating(s) · ${d.productCount} products`} />
      </View>

      <Card style={{ padding: 16 }}>
        <Bold style={{ fontSize: 16, marginBottom: 4 }}>Sales — last 7 days</Bold>
        <Bars data={d.daily} />
      </Card>

      <Card style={{ padding: 16, gap: 4 }}>
        <Bold style={{ fontSize: 16, marginBottom: 6 }}>Recent orders</Bold>
        {d.recentOrders.length === 0 && <Muted>No orders yet.</Muted>}
        {d.recentOrders.map((o) => (
          <Spread key={o._id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Bold>{o.orderNumber} <Muted>{o.customer?.name}</Muted></Bold>
              <Muted>{dt(o.createdAt)}</Muted>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Bold>{money(o.grandTotal)}</Bold>
              <Chip s={o.status} />
            </View>
          </Spread>
        ))}
      </Card>

      <Btn kind="ghost" title="Logout" onPress={logout} />
    </ScrollView>
  );
}
