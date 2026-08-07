import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, img, money } from '../api.js';
import { useAuth, useCart } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, Chip, Empty, ErrorText, Muted, QtyCtl, Row, Spinner, Spread } from '../components.jsx';

export default function CartScreen({ navigation }) {
  const { user, loading } = useAuth();
  const { refreshCart } = useCart();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (user) api('/cart').then(setData).catch((e) => setErr(e.message));
    }, [user])
  );

  if (loading) return <Spinner />;
  if (!user) {
    return <Empty icon="🔐" text="Login to view your cart." action={<Btn title="Login" onPress={() => navigation.navigate('Auth')} />} />;
  }
  if (err) return <ErrorText>{err}</ErrorText>;
  if (!data) return <Spinner />;
  if (!data.groups.length) {
    return <Empty icon="🛒" text="Your cart is empty." action={<Btn title="Browse products" onPress={() => navigation.navigate('HomeTab')} />} />;
  }

  const setQty = async (itemId, qty) => {
    const d = await api(`/cart/${itemId}`, { method: 'PUT', body: { qty } });
    setData(d);
    refreshCart();
  };

  const totals = data.groups.reduce(
    (t, g) => ({ items: t.items + g.itemsTotal, tax: t.tax + g.taxTotal, delivery: t.delivery + g.deliveryCharge }),
    { items: 0, tax: 0, delivery: 0 }
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 16 }}>
        {data.groups.map((g) => (
          <Card key={g.partner._id} style={{ padding: 14, gap: 8 }}>
            <Spread>
              <Bold>🏪 {g.partner.storeName}</Bold>
              {!g.partner.isOpen && <Chip s="Store closed" color={C.red} />}
            </Spread>
            {g.items.map((it) => (
              <View key={it.cartItemId} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 6 }}>
                <Row>
                  {!!it.image && <Image source={{ uri: img(it.image) }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: C.line }} />}
                  <View style={{ flex: 1 }}>
                    <Bold>{it.title}</Bold>
                    <Muted>
                      {it.variantName ? `${it.variantName}` : ''}
                      {it.addons.length ? `${it.variantName ? ' · ' : ''}${it.addons.map((a) => a.name).join(', ')}` : ''}
                    </Muted>
                  </View>
                </Row>
                <Spread>
                  <QtyCtl qty={it.qty} set={(n) => setQty(it.cartItemId, n)} />
                  <Bold>{money(it.lineTotal)}</Bold>
                </Spread>
              </View>
            ))}
            <Muted style={{ textAlign: 'right' }}>
              Delivery: {g.deliveryCharge === 0 ? 'FREE' : money(g.deliveryCharge)}
              {g.partner.minOrder > 0 && g.itemsTotal < g.partner.minOrder ? `  ·  Min order ${money(g.partner.minOrder)}` : ''}
            </Muted>
          </Card>
        ))}

        <Card style={{ padding: 16, gap: 6 }}>
          <Bold style={{ fontSize: 16 }}>Summary</Bold>
          <Spread><Muted>Items</Muted><Muted>{money(totals.items)}</Muted></Spread>
          <Spread><Muted>Taxes</Muted><Muted>{money(totals.tax)}</Muted></Spread>
          <Spread><Muted>Delivery</Muted><Muted>{totals.delivery === 0 ? 'FREE' : money(totals.delivery)}</Muted></Spread>
          <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginVertical: 4 }} />
          <Spread>
            <Text style={{ fontFamily: F.b, fontSize: 17 }}>Total</Text>
            <Text style={{ fontFamily: F.b, fontSize: 17 }}>{money(totals.items + totals.tax + totals.delivery)}</Text>
          </Spread>
        </Card>
      </ScrollView>
      <View style={{ padding: 14, paddingTop: 0 }}>
        <Btn block title="Proceed to checkout →" onPress={() => navigation.navigate('Checkout')} />
      </View>
    </View>
  );
}
