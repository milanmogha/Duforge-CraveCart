import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, dt, money } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, ErrorText, Input, Muted, Row, Spinner, Spread, SuccessText } from '../components.jsx';

export default function WalletScreen() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/wallet').then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <Spinner />;

  const topup = async () => {
    setMsg('');
    try {
      await api('/wallet/topup', { method: 'POST', body: { amount: Number(amount) } });
      setAmount('');
      await load();
      await refresh();
      setMsg('Money added ✓');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Card style={{ padding: 20, alignItems: 'center', gap: 8 }}>
        <Muted>DAPIGO wallet balance</Muted>
        <Text style={{ fontFamily: F.b, fontSize: 34, color: C.brand }}>{money(data.balance)}</Text>
        <Row style={{ alignSelf: 'stretch' }}>
          <Input keyboardType="numeric" placeholder="Amount" value={amount} onChangeText={setAmount} style={{ flex: 1 }} />
          <Btn sm title="Add money" onPress={topup} disabled={!amount} />
        </Row>
        {msg.includes('✓') ? <SuccessText>{msg}</SuccessText> : <ErrorText>{msg}</ErrorText>}
        <Muted style={{ fontSize: 11.5, textAlign: 'center' }}>
          Demo gateway — money is added instantly. Card/UPI top-up is available on the website.
        </Muted>
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
