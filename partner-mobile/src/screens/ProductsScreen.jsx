import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { api, img, money } from '../api.js';
import { Bold, Card, Chip, Empty, ErrorText, Input, Muted, Row, Spinner, Spread, SwitchRow } from '../components.jsx';
import { C } from '../theme.js';

// Mobile scope is day-to-day inventory: search + availability/stock at a glance,
// and flip products active/inactive. Full product editing stays on the web console.
export default function ProductsScreen() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () => api(`/partner/products${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(setData).catch(() => {}),
    [search]
  );

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, search]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggle = async (p) => {
    setErr(''); setBusyId(p._id);
    const status = p.status === 'active' ? 'out_of_stock' : 'active';
    try {
      await api(`/partner/products/${p._id}`, { method: 'PUT', body: { status } });
      setData((d) => ({ ...d, products: d.products.map((x) => (x._id === p._id ? { ...x, status } : x)) }));
    } catch (e) { setErr(e.message); }
    setBusyId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 14, paddingBottom: 6 }}>
        <Input placeholder="Search products…" value={search} onChangeText={setSearch} autoCapitalize="none" />
        <ErrorText>{err}</ErrorText>
      </View>
      {!data ? <Spinner /> : data.products.length === 0 ? (
        <Empty icon="🍽️" text={search ? 'No products match your search.' : 'No products yet — add them from the web console.'} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingTop: 6, gap: 10, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        >
          <Muted>{data.total} product(s) · toggle to hide/show on the storefront</Muted>
          {data.products.map((p) => (
            <Card key={p._id} style={{ padding: 12 }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Image source={{ uri: img(p.images?.[0]) }} style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: C.line }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Row>
                    <Muted style={{ fontSize: 10 }}>{p.isVeg ? '🟢' : '🔴'}</Muted>
                    <Bold numberOfLines={1} style={{ flex: 1 }}>{p.title}</Bold>
                  </Row>
                  <Muted>{p.category?.name || 'Uncategorised'} · {money(p.salePrice ?? p.price)}</Muted>
                  <Row>
                    <Chip s={p.status} color={p.status === 'active' ? C.green : C.red} />
                    <Muted style={{ color: p.stock <= (p.lowStockAlert ?? 5) ? C.red : C.muted }}>stock {p.stock}</Muted>
                  </Row>
                </View>
              </Row>
              <Spread style={{ marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <SwitchRow
                    label={p.status === 'active' ? 'Available to order' : p.status === 'draft' ? 'Draft (edit on web console)' : 'Marked out of stock'}
                    value={p.status === 'active'}
                    onChange={() => busyId !== p._id && p.status !== 'draft' && toggle(p)}
                  />
                </View>
              </Spread>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
