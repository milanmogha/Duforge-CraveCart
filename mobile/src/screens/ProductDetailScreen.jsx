import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { api, dt, img, money } from '../api.js';
import { useAuth, useCart } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, CheckRow, Chip, ErrorText, H2, Muted, ProductCard, QtyCtl, Row, Spinner, Spread, Stars, SuccessText } from '../components.jsx';

export default function ProductDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const [data, setData] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [addonIds, setAddonIds] = useState([]);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');
  const [fav, setFav] = useState(false);

  useEffect(() => {
    api(`/catalog/products/${id}`).then((d) => {
      setData(d);
      if (d.product.variants?.length) setVariantId(d.product.variants[0]._id);
    });
  }, [id]);

  useEffect(() => {
    if (user) setFav((user.favorites || []).some((f) => String(f) === id));
  }, [user, id]);

  if (!data) return <Spinner />;
  const p = data.product;
  const variant = p.variants.find((v) => v._id === variantId);
  const base = variant ? variant.price : (p.salePrice ?? p.price);
  const addonsTotal = p.addons.filter((a) => addonIds.includes(a._id)).reduce((s, a) => s + a.price, 0);
  const unit = base + addonsTotal;

  const addToCart = async () => {
    if (!user) return navigation.navigate('Auth');
    try {
      await api('/cart', { method: 'POST', body: { productId: p._id, variantId: variantId || undefined, addonIds, qty } });
      await refreshCart();
      setMsg('Added to cart ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { setMsg(e.message); }
  };

  const toggleFav = async () => {
    if (!user) return navigation.navigate('Auth');
    const { favorited } = await api(`/auth/favorites/${p._id}`, { method: 'POST' });
    setFav(favorited);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }}>
      <Image source={{ uri: img(p.images?.[0]) }} style={{ width: '100%', height: 240, borderRadius: 16, backgroundColor: C.line }} />

      <Spread>
        <H2 style={{ flex: 1 }}>{p.title}</H2>
        <Btn kind="ghost" sm title={fav ? '♥ Saved' : '♡ Save'} onPress={toggleFav} />
      </Spread>

      <Row style={{ flexWrap: 'wrap' }}>
        {p.ratingCount > 0 && <Chip s={`★ ${p.ratingAvg} (${p.ratingCount})`} color={C.amber} />}
        <Muted>{p.isVeg ? '🟢 Veg' : '🔴 Non-veg'} · {p.category?.name}</Muted>
      </Row>

      {p.partner && (
        <Text style={{ fontFamily: F.sb, color: C.brand, fontSize: 13.5 }} onPress={() => navigation.push('Store', { id: p.partner._id })}>
          from {p.partner.partnerProfile?.storeName} →
        </Text>
      )}

      {!!p.description && <Muted style={{ fontSize: 14, lineHeight: 20 }}>{p.description}</Muted>}

      {p.variants.length > 0 && (
        <View>
          <Bold style={{ marginBottom: 8 }}>Choose option</Bold>
          <Row style={{ flexWrap: 'wrap' }}>
            {p.variants.map((v) => (
              <Btn key={v._id} sm kind={variantId === v._id ? 'primary' : 'gray'} title={`${v.name} · ${money(v.price)}`} onPress={() => setVariantId(v._id)} />
            ))}
          </Row>
        </View>
      )}

      {p.addons.length > 0 && (
        <View>
          <Bold style={{ marginBottom: 4 }}>Add-ons</Bold>
          {p.addons.map((a) => (
            <CheckRow
              key={a._id}
              checked={addonIds.includes(a._id)}
              onToggle={() => setAddonIds((ids) => ids.includes(a._id) ? ids.filter((x) => x !== a._id) : [...ids, a._id])}
            >
              <Muted style={{ fontSize: 14, color: C.ink }}>{a.name} (+{money(a.price)})</Muted>
            </CheckRow>
          ))}
        </View>
      )}

      <Spread>
        <QtyCtl qty={qty} set={(n) => setQty(Math.max(1, n))} max={p.maxQty || 20} />
        <Text style={{ fontFamily: F.b, fontSize: 22, color: C.brand }}>{money(unit * qty)}</Text>
      </Spread>

      {p.stock <= 0 ? (
        <ErrorText>Out of stock</ErrorText>
      ) : (
        <Btn block title="Add to cart" onPress={addToCart} />
      )}
      {msg.includes('✓') ? <SuccessText>{msg}</SuccessText> : <ErrorText>{msg}</ErrorText>}

      {data.reviews.length > 0 && (
        <View style={{ gap: 10 }}>
          <H2>Reviews</H2>
          {data.reviews.map((r) => (
            <Card key={r._id} style={{ padding: 12, gap: 4 }}>
              <Spread>
                <Bold>{r.user?.name || 'Customer'}</Bold>
                <Muted>{dt(r.createdAt)}</Muted>
              </Spread>
              <Row>
                <Stars value={r.rating} size={14} />
                {r.verifiedPurchase && <Chip s="Verified purchase" color={C.green} />}
              </Row>
              {!!r.comment && <Muted style={{ color: C.ink, fontSize: 13.5 }}>{r.comment}</Muted>}
            </Card>
          ))}
        </View>
      )}

      {data.related.length > 0 && (
        <View>
          <H2>You may also like</H2>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
            {data.related.map((rp) => <ProductCard key={rp._id} p={rp} wide />)}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}
