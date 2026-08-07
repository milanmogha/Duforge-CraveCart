import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, dt, money } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, Chip, ErrorText, Input, Muted, Row, Spinner, Spread, SuccessText } from '../components.jsx';

export default function WalletScreen() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [withdrawals, setWithdrawals] = useState(null);
  const [cash, setCash] = useState(null);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = () => Promise.all([
    api('/wallet').then(setData),
    api('/wallet/withdrawals').then((d) => setWithdrawals(d.withdrawals)),
    api('/rider/cash-collection').then(setCash),
  ]).catch(() => {});
  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!data || !withdrawals || !cash) return <Spinner />;

  const requestWithdrawal = async () => {
    setMsg('');
    try {
      await api('/wallet/withdrawals', { method: 'POST', body: { amount: Number(amount) } });
      setAmount('');
      await load(); await refresh();
      setMsg('Withdrawal requested ✓ — pending admin review');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
    >
      <Card style={{ padding: 20, alignItems: 'center', gap: 8 }}>
        <Muted>Available balance</Muted>
        <Text style={{ fontFamily: F.b, fontSize: 34, color: C.brand }}>{money(data.balance)}</Text>
        <Row style={{ alignSelf: 'stretch' }}>
          <Input keyboardType="numeric" placeholder="Amount" value={amount} onChangeText={setAmount} style={{ flex: 1 }} />
          <Btn sm title="Withdraw" onPress={requestWithdrawal} disabled={!amount} />
        </Row>
        {msg.includes('✓') ? <SuccessText>{msg}</SuccessText> : <ErrorText>{msg}</ErrorText>}
        <Muted style={{ fontSize: 11.5, textAlign: 'center' }}>
          Payouts go to the bank account saved in your Profile after admin review.
        </Muted>
      </Card>

      <Card style={{ padding: 16, gap: 4 }}>
        <Bold style={{ fontSize: 16 }}>COD cash in hand</Bold>
        <Text style={{ fontFamily: F.b, fontSize: 26, color: cash.codHeld > 0 ? '#d97706' : C.green }}>
          {money(cash.codHeld)}
        </Text>
        <Muted>Cash collected on COD deliveries — deposit with admin to clear.</Muted>
        {cash.collections.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Bold style={{ marginBottom: 4 }}>Deposits</Bold>
            {cash.collections.map((c) => (
              <Spread key={c._id} style={{ paddingVertical: 5 }}>
                <Muted>{dt(c.createdAt)}</Muted>
                <Bold>{money(c.amount)}</Bold>
              </Spread>
            ))}
          </View>
        )}
        {cash.codOrders.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Bold style={{ marginBottom: 4 }}>Recent COD deliveries</Bold>
            {cash.codOrders.map((o) => (
              <Spread key={o._id} style={{ paddingVertical: 5 }}>
                <Muted>{o.orderNumber} · {dt(o.deliveredAt)}</Muted>
                <Bold>{money(o.grandTotal)}</Bold>
              </Spread>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ padding: 16, gap: 4 }}>
        <Bold style={{ fontSize: 16, marginBottom: 6 }}>Withdrawal requests</Bold>
        {withdrawals.length === 0 && <Muted>None yet.</Muted>}
        {withdrawals.map((w) => (
          <Spread key={w._id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
            <View>
              <Bold>{money(w.amount)}</Bold>
              <Muted>{dt(w.createdAt)}</Muted>
            </View>
            <Chip s={w.status} />
          </Spread>
        ))}
      </Card>

      <Card style={{ padding: 16, gap: 4 }}>
        <Bold style={{ fontSize: 16, marginBottom: 6 }}>Transactions</Bold>
        {data.transactions.length === 0 && <Muted>No transactions yet.</Muted>}
        {data.transactions.map((t) => (
          <Spread key={t._id} style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Bold style={{ textTransform: 'capitalize' }}>{t.source.replaceAll('_', ' ')}</Bold>
              <Muted>{dt(t.createdAt)}{t.note ? ` · ${t.note}` : ''}</Muted>
            </View>
            <Bold style={{ color: t.type === 'credit' ? C.green : C.red }}>
              {t.type === 'credit' ? '+' : '−'}{money(t.amount)}
            </Bold>
          </Spread>
        ))}
      </Card>
    </ScrollView>
  );
}
