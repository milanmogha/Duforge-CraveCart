import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api, dt, money } from '../api.js';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, Chip, Empty, Muted, Row, Spinner } from '../components.jsx';

export default function OffersScreen() {
  const [promos, setPromos] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => { api('/catalog/promos').then((d) => setPromos(d.promos)); }, []);
  if (!promos) return <Spinner />;

  const copy = async (code) => {
    await Clipboard.setStringAsync(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 32 }}>
      <Muted>Apply these codes at checkout to save on your order.</Muted>
      {promos.length === 0 ? (
        <Empty icon="🎟️" text="No active offers right now — check back soon!" />
      ) : (
        promos.map((p) => (
          <Card key={p._id} style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ backgroundColor: C.brandLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', minWidth: 78 }}>
              <Text style={{ fontFamily: F.b, color: C.brand, fontSize: 16 }}>
                {p.type === 'percent' ? `${p.value}%` : money(p.value)}
              </Text>
              <Text style={{ fontFamily: F.sb, color: C.brand, fontSize: 10 }}>OFF</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Row>
                <Bold style={{ letterSpacing: 0.5 }}>{p.code}</Bold>
                {!!p.store && <Chip s={p.store} color={C.green} />}
              </Row>
              <Muted>{p.description}</Muted>
              <Muted style={{ fontSize: 11.5 }}>
                {p.minOrder > 0 && `Min order ${money(p.minOrder)}`}
                {p.maxDiscount ? ` · up to ${money(p.maxDiscount)}` : ''}
                {p.endsAt ? ` · valid till ${dt(p.endsAt)}` : ''}
              </Muted>
            </View>
            <Btn kind="ghost" sm title={copied === p.code ? '✓' : 'Copy'} onPress={() => copy(p.code)} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}
