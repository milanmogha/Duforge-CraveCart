import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, money } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { Bold, Btn, Card, Muted, Spinner, Stat, SwitchRow } from '../components.jsx';
import { C } from '../theme.js';

export default function DashboardScreen({ navigation }) {
  const { logout } = useAuth();
  const [d, setD] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/rider/dashboard').then(setD).catch(() => {}), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!d) return <Spinner />;

  const setOnline = async (isOnline) => {
    setD((x) => ({ ...x, isOnline })); // optimistic
    try { await api('/rider/status', { method: 'PUT', body: { isOnline } }); }
    catch { setD((x) => ({ ...x, isOnline: !isOnline })); }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      <Card style={{ padding: 16 }}>
        <SwitchRow
          label={d.isOnline ? "You're ONLINE" : "You're OFFLINE"}
          sub={d.isOnline ? 'Ready to take deliveries.' : 'Go online to start receiving orders.'}
          value={d.isOnline}
          onChange={setOnline}
        />
      </Card>

      {d.kycStatus !== 'approved' && (
        <Card style={{ padding: 14, backgroundColor: '#fffbeb', borderColor: '#f6d089' }}>
          <Bold>KYC status: {d.kycStatus || 'pending'}</Bold>
          <Muted>Admin approval is required before you can deliver.</Muted>
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="Today's earnings" value={money(d.today.earning)} sub={`${d.today.deliveries} deliveries today`} />
        <Stat label="This week" value={money(d.week.earning)} sub={`${d.week.deliveries} deliveries`} />
        <Stat label="Wallet balance" value={money(d.walletBalance)} sub={`COD held ${money(d.codHeld)}`} />
        <Stat label="Rating" value={d.rating.count ? `★ ${d.rating.avg}` : '—'} sub={`${d.totalDeliveries} deliveries all-time`} />
      </View>

      <Card style={{ padding: 16, gap: 8 }}>
        {d.activeCount > 0 ? (
          <>
            <Bold style={{ fontSize: 16 }}>🛵 You have {d.activeCount} active deliver{d.activeCount > 1 ? 'ies' : 'y'}</Bold>
            <Btn title="Go to deliveries →" onPress={() => navigation.navigate('DeliveriesTab')} />
          </>
        ) : (
          <>
            <Bold style={{ fontSize: 16 }}>No active deliveries</Bold>
            <Muted>Check available orders and accept your next delivery.</Muted>
            <Btn title="Find orders →" onPress={() => navigation.navigate('DeliveriesTab')} />
          </>
        )}
      </Card>

      <Btn kind="ghost" title="Logout" onPress={logout} />
    </ScrollView>
  );
}
