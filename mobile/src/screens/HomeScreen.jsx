import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api, img } from '../api.js';
import { C, F } from '../theme.js';
import { Bold, Card, Empty, H2, Input, Muted, ProductCard, Row, Spinner, Spread, StoreCard } from '../components.jsx';

const W = Dimensions.get('window').width;

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [slide, setSlide] = useState(0);
  const sliderRef = useRef(null);

  const load = () => api('/catalog/home').then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!data?.sliders?.length) return;
    const t = setInterval(() => {
      setSlide((s) => {
        const next = (s + 1) % data.sliders.length;
        sliderRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [data]);

  const search = () => q.trim() && navigation.push('Products', { search: q.trim() });

  if (err && !data) return <Empty icon="⚠️" text={err} />;
  if (!data) return <Spinner />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.brand} />}
    >
      <View style={{ padding: 14, gap: 16, paddingBottom: 32 }}>
        <Input
          placeholder="Search for dishes, groceries, stores…"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={search}
          returnKeyType="search"
        />

        {data.sliders.length > 0 && (
          <View>
            <FlatList
              ref={sliderRef}
              data={data.sliders}
              keyExtractor={(s) => s._id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, i) => ({ length: W - 28, offset: (W - 28) * i, index: i })}
              onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / (W - 28)))}
              renderItem={({ item }) => (
                <View style={{ width: W - 28, borderRadius: 16, overflow: 'hidden' }}>
                  <Image source={{ uri: img(item.image) }} style={{ width: '100%', height: 150, backgroundColor: C.line }} />
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 8 }}>
                    <Text style={{ fontFamily: F.b, color: '#fff', fontSize: 14 }}>{item.title}</Text>
                  </View>
                </View>
              )}
            />
            <Row style={{ justifyContent: 'center', marginTop: 8 }}>
              {data.sliders.map((_, i) => (
                <View key={i} style={{ width: i === slide ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === slide ? C.brand : C.line }} />
              ))}
            </Row>
          </View>
        )}

        <View>
          <H2>Shop by category</H2>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 12 }}>
            {data.categories.map((c) => (
              <TouchableOpacity key={c._id} style={{ alignItems: 'center', width: 72 }} onPress={() => navigation.push('Products', { category: c._id, categoryName: c.name })}>
                <Image source={{ uri: img(c.image) }} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: C.line }} />
                <Text numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12, color: C.ink, marginTop: 5 }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {data.featured.length > 0 && (
          <View>
            <Spread>
              <H2>Featured</H2>
              <Text style={{ fontFamily: F.sb, color: C.brand, fontSize: 13 }} onPress={() => navigation.push('Products', {})}>View all →</Text>
            </Spread>
            <HList products={data.featured} />
          </View>
        )}

        {(data.sections || []).map((sec) =>
          sec.products.length > 0 && (
            <View key={sec._id}>
              <H2>{sec.title}</H2>
              {!!sec.subtitle && <Muted>{sec.subtitle}</Muted>}
              <HList products={sec.products.slice(0, 8)} />
            </View>
          )
        )}

        <View>
          <Spread>
            <H2>Popular stores</H2>
            <Text style={{ fontFamily: F.sb, color: C.brand, fontSize: 13 }} onPress={() => navigation.navigate('StoresTab')}>All stores →</Text>
          </Spread>
          <View style={{ gap: 10, marginTop: 10 }}>
            {data.partners.map((s) => <StoreCard key={s._id} s={s} />)}
          </View>
        </View>

        <View>
          <H2>Popular right now</H2>
          <HList products={data.popular} />
        </View>

        {data.offers.length > 0 && (
          <View>
            <H2>Offers for you</H2>
            <View style={{ gap: 10, marginTop: 10 }}>
              {data.offers.map((o) => (
                <Card key={o._id} style={{ overflow: 'hidden' }}>
                  {!!o.image && <Image source={{ uri: img(o.image) }} style={{ width: '100%', height: 120, backgroundColor: C.line }} />}
                  <View style={{ padding: 12 }}>
                    <Bold>{o.title}</Bold>
                    <Muted>{o.description}</Muted>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const HList = ({ products }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
    {products.map((p) => <ProductCard key={p._id} p={p} wide />)}
  </ScrollView>
);
