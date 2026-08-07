import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { api } from '../api.js';
import { C } from '../theme.js';
import { CheckRow, ChipSelect, Empty, Input, Muted, ProductCard, Spinner } from '../components.jsx';

const SORTS = [
  ['', 'Relevance'],
  ['popular', 'Popular'],
  ['rating', 'Top rated'],
  ['price_asc', 'Price ↑'],
  ['price_desc', 'Price ↓'],
  ['newest', 'Newest'],
];

export default function ProductsScreen({ route, navigation }) {
  const [search, setSearch] = useState(route.params?.search || '');
  const [q, setQ] = useState(route.params?.search || '');
  const [category, setCategory] = useState(route.params?.category || '');
  const [sort, setSort] = useState('');
  const [veg, setVeg] = useState(false);
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { api('/catalog/categories').then((d) => setCats(d.categories)); }, []);

  useEffect(() => {
    navigation.setOptions({ title: search ? `“${search}”` : route.params?.categoryName || 'Browse products' });
  }, [search, navigation, route.params?.categoryName]);

  const params = (p) => {
    const q = { search, category, sort, veg: veg ? 'true' : '', page: p };
    return Object.entries(q)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  };

  useEffect(() => {
    setItems(null); setPage(1);
    api(`/catalog/products?${params(1)}`)
      .then((d) => { setItems(d.products); setPages(d.pages || 1); })
      .catch(() => { setItems([]); setPages(1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, sort, veg]);

  const more = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const d = await api(`/catalog/products?${params(page + 1)}`);
      setItems((prev) => [...prev, ...d.products]);
      setPage(page + 1);
    } finally { setLoadingMore(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12, gap: 10 }}>
        <Input placeholder="Search products…" value={q} onChangeText={setQ} onSubmitEditing={() => setSearch(q.trim())} returnKeyType="search" />
        <ChipSelect options={[['', 'All categories'], ...cats.map((c) => [c._id, c.name])]} value={category} onChange={setCategory} />
        <ChipSelect options={SORTS} value={sort} onChange={setSort} />
        <CheckRow checked={veg} onToggle={() => setVeg(!veg)}>
          <Muted>Veg only</Muted>
        </CheckRow>
      </View>
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty icon="🔍" text="No products match your search." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 12 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => <ProductCard p={item} />}
          onEndReached={more}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <Spinner /> : null}
        />
      )}
    </View>
  );
}
