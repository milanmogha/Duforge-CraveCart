import { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, View } from 'react-native';
import { api, dt, img } from '../api.js';
import { C, F } from '../theme.js';
import { Bold, Card, Chip, Empty, H2, Input, Muted, ProductCard, Row, Spinner, Spread, Stars, StoreCard } from '../components.jsx';

export default function StoresScreen() {
  const [partners, setPartners] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/catalog/partners?search=${encodeURIComponent(q)}`).then((d) => setPartners(d.partners));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12 }}>
        <Input placeholder="Search stores…" value={q} onChangeText={setQ} />
      </View>
      {!partners ? (
        <Spinner />
      ) : partners.length === 0 ? (
        <Empty icon="🏪" text="No stores found." />
      ) : (
        <FlatList
          data={partners}
          keyExtractor={(s) => s._id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, gap: 10 }}
          renderItem={({ item }) => <StoreCard s={item} />}
        />
      )}
    </View>
  );
}

export function StoreScreen({ route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);

  useEffect(() => { api(`/catalog/partners/${id}`).then(setData); }, [id]);
  if (!data) return <Spinner />;
  const s = data.partner.partnerProfile;

  const byCat = {};
  for (const p of data.products) {
    const cat = p.category?.name || 'Other';
    (byCat[cat] = byCat[cat] || []).push(p);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 32 }}>
      <Card style={{ overflow: 'hidden' }}>
        {!!s.banner && <Image source={{ uri: img(s.banner) }} style={{ width: '100%', height: 140, backgroundColor: C.line }} />}
        <View style={{ padding: 14, gap: 6 }}>
          <Row>
            {!!s.logo && <Image source={{ uri: img(s.logo) }} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: C.line }} />}
            <View style={{ flex: 1 }}>
              <H2>{s.storeName}</H2>
              <Muted>{s.description}</Muted>
            </View>
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {s.ratingCount > 0 && <Chip s={`★ ${s.ratingAvg} (${s.ratingCount})`} color={C.amber} />}
            <Chip s={s.isOpen ? `Open ${s.openTime}–${s.closeTime}` : 'Closed'} color={s.isOpen ? C.green : C.red} />
          </Row>
          <Muted>📍 {s.address}, {s.city}</Muted>
          <Muted>🛵 Delivery ₹{s.deliveryCharge} · Free above ₹{s.freeDeliveryAbove}</Muted>
        </View>
      </Card>

      {Object.entries(byCat).map(([cat, products]) => (
        <View key={cat}>
          <H2>{cat}</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {products.map((p) => (
              <View key={p._id} style={{ width: '48%' }}>
                <ProductCard p={p} />
              </View>
            ))}
          </View>
        </View>
      ))}

      {data.reviews.length > 0 && (
        <View style={{ gap: 10 }}>
          <H2>What customers say</H2>
          {data.reviews.map((r) => (
            <Card key={r._id} style={{ padding: 12, gap: 4 }}>
              <Spread>
                <Bold>{r.user?.name || 'Customer'}</Bold>
                <Muted>{dt(r.createdAt)}</Muted>
              </Spread>
              <Stars value={r.rating} size={14} />
              {!!r.comment && <Muted style={{ color: C.ink, fontSize: 13.5 }}>{r.comment}</Muted>}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
