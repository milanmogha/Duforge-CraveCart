import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, money } from '../api.js';
import { useAuth, useCart } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, ErrorText, Field, Input, Muted, RadioRow, Row, Sheet, Spinner, Spread, SuccessText } from '../components.jsx';

// Stripe/Razorpay run through web-only JS SDKs — mobile checkout offers COD + wallet
// (matching what POST /orders accepts); card/UPI stays on the web app for now.
const MOBILE_METHODS = ['cod', 'wallet'];

export default function CheckoutScreen({ navigation }) {
  const { user, refresh } = useAuth();
  const { refreshCart } = useCart();
  const [cart, setCart] = useState(null);
  const [addressId, setAddressId] = useState('');
  const [payment, setPayment] = useState('cod');
  const [methods, setMethods] = useState([]);
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState(null);
  const [tip, setTip] = useState(0);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [placing, setPlacing] = useState(false);
  const [addrModal, setAddrModal] = useState(false);
  const [selfPickup, setSelfPickup] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: 'Home', line1: '', city: '', area: '', pincode: '' });

  useEffect(() => {
    api('/cart').then((d) => {
      if (!d.groups.length) return navigation.goBack();
      setCart(d);
    });
    api('/payments/methods').then((d) => setMethods(d.methods.filter((m) => m.enabled && MOBILE_METHODS.includes(m.id))));
  }, [navigation]);

  useEffect(() => {
    const def = (user?.addresses || []).find((a) => a.isDefault) || user?.addresses?.[0];
    if (def) setAddressId(def._id);
  }, [user]);

  if (!cart || !user) return <Spinner />;

  const totals = cart.groups.reduce(
    (t, g) => ({ items: t.items + g.itemsTotal, tax: t.tax + g.taxTotal, delivery: t.delivery + g.deliveryCharge }),
    { items: 0, tax: 0, delivery: 0 }
  );
  if (selfPickup) totals.delivery = 0;
  const discount = applied?.discount || 0;
  const grand = totals.items + totals.tax + totals.delivery + (selfPickup ? 0 : Number(tip || 0)) - discount;

  const applyPromo = async () => {
    setErr('');
    try {
      const d = await api('/orders/promo-check', { method: 'POST', body: { code: promo } });
      setApplied(d);
    } catch (e) { setApplied(null); setErr(e.message); }
  };

  const addAddress = async () => {
    try {
      const { addresses } = await api('/auth/addresses', { method: 'POST', body: newAddr });
      await refresh();
      setAddressId(addresses[addresses.length - 1]._id);
      setAddrModal(false);
    } catch (e) { setErr(e.message); }
  };

  const placeOrder = async () => {
    setErr(''); setPlacing(true);
    try {
      const { orders } = await api('/orders', {
        method: 'POST',
        body: {
          addressId,
          paymentMethod: payment,
          promoCode: applied ? applied.code : undefined,
          tip: selfPickup ? 0 : Number(tip || 0),
          note,
          selfPickup,
        },
      });
      await refreshCart();
      await refresh();
      navigation.replace('OrderDetail', { id: orders[0]._id, placed: true });
    } catch (e) { setErr(e.message); setPlacing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 16 }}>
        <Card style={{ padding: 14, gap: 10 }}>
          <Bold style={{ fontSize: 15 }}>🛍️ How do you want it?</Bold>
          <Row>
            <Btn sm kind={!selfPickup ? 'primary' : 'gray'} title="🛵 Home delivery" onPress={() => setSelfPickup(false)} />
            <Btn sm kind={selfPickup ? 'primary' : 'gray'} title="🏪 Self pickup" onPress={() => setSelfPickup(true)} />
          </Row>
          {selfPickup && <Muted>No delivery charge — collect your order at the store when it's ready.</Muted>}
        </Card>

        {!selfPickup && (
          <Card style={{ padding: 14, gap: 6 }}>
            <Spread>
              <Bold style={{ fontSize: 15 }}>📍 Delivery address</Bold>
              <Btn kind="ghost" sm title="+ Add new" onPress={() => setAddrModal(true)} />
            </Spread>
            {(user.addresses || []).length === 0 && <Muted>No saved addresses — add one to continue.</Muted>}
            {(user.addresses || []).map((a) => (
              <RadioRow key={a._id} checked={addressId === a._id} onPress={() => setAddressId(a._id)}>
                <Bold>{a.label} {a.isDefault ? ' (default)' : ''}</Bold>
                <Muted>{a.line1}{a.line2 ? ', ' + a.line2 : ''}, {a.area ? a.area + ', ' : ''}{a.city} {a.pincode}</Muted>
              </RadioRow>
            ))}
          </Card>
        )}

        <Card style={{ padding: 14, gap: 6 }}>
          <Bold style={{ fontSize: 15 }}>💳 Payment method</Bold>
          {methods.map((m) => (
            <RadioRow key={m.id} checked={payment === m.id} onPress={() => setPayment(m.id)}>
              <Bold>
                {m.id === 'cod' ? '💵 ' : '👛 '}{m.label}
                {m.id === 'wallet' && <Muted>  (balance: {money(user.walletBalance)})</Muted>}
              </Bold>
            </RadioRow>
          ))}
          <Muted style={{ fontSize: 11.5 }}>Card / UPI payments are available on the CraveCart website.</Muted>
          {payment === 'wallet' && user.walletBalance < grand && (
            <ErrorText>Wallet balance is not enough for this order. Top up from your profile.</ErrorText>
          )}
        </Card>

        <Card style={{ padding: 14, gap: 8 }}>
          <Bold style={{ fontSize: 15 }}>🎟️ Promo code</Bold>
          <Row>
            <Input placeholder="e.g. CRAVECART10" autoCapitalize="characters" value={promo} onChangeText={(t) => setPromo(t.toUpperCase())} style={{ flex: 1 }} />
            <Btn sm title="Apply" onPress={applyPromo} disabled={!promo} />
          </Row>
          {applied && <SuccessText>✓ {applied.code} applied — you save {money(applied.discount)}</SuccessText>}
        </Card>

        <Card style={{ padding: 14, gap: 8 }}>
          {!selfPickup && (
            <>
              <Bold style={{ fontSize: 15 }}>🛵 Tip your rider</Bold>
              <Row style={{ flexWrap: 'wrap' }}>
                {[0, 10, 20, 30, 50].map((t) => (
                  <Btn key={t} sm kind={Number(tip) === t ? 'primary' : 'gray'} title={t === 0 ? 'No tip' : money(t)} onPress={() => setTip(t)} />
                ))}
              </Row>
            </>
          )}
          <Field label="Order note (optional)">
            <Input multiline placeholder="e.g. Less spicy, call on arrival…" value={note} onChangeText={setNote} />
          </Field>
        </Card>

        <Card style={{ padding: 16, gap: 6 }}>
          <Bold style={{ fontSize: 16 }}>Bill details</Bold>
          {cart.groups.map((g) => (
            <Muted key={g.partner._id}>{g.partner.storeName}: {g.items.length} item(s)</Muted>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginVertical: 4 }} />
          <Spread><Muted>Items</Muted><Muted>{money(totals.items)}</Muted></Spread>
          <Spread><Muted>Taxes</Muted><Muted>{money(totals.tax)}</Muted></Spread>
          <Spread><Muted>Delivery</Muted><Muted>{selfPickup ? 'Self pickup' : totals.delivery === 0 ? 'FREE' : money(totals.delivery)}</Muted></Spread>
          {!selfPickup && Number(tip) > 0 && <Spread><Muted>Rider tip</Muted><Muted>{money(tip)}</Muted></Spread>}
          {discount > 0 && (
            <Spread>
              <Muted style={{ color: C.green }}>Discount</Muted>
              <Muted style={{ color: C.green }}>−{money(discount)}</Muted>
            </Spread>
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginVertical: 4 }} />
          <Spread>
            <Text style={{ fontFamily: F.b, fontSize: 17 }}>To pay</Text>
            <Text style={{ fontFamily: F.b, fontSize: 17 }}>{money(grand)}</Text>
          </Spread>
          <ErrorText>{err}</ErrorText>
        </Card>
      </ScrollView>

      <View style={{ padding: 14, paddingTop: 0 }}>
        <Btn
          block
          title={placing ? 'Please wait…' : `Place order · ${money(grand)}`}
          disabled={placing || (!selfPickup && !addressId) || (payment === 'wallet' && user.walletBalance < grand)}
          onPress={placeOrder}
        />
      </View>

      {addrModal && (
        <Sheet title="Add address" onClose={() => setAddrModal(false)}>
          <Field label="Label">
            <Row>
              {['Home', 'Work', 'Other'].map((l) => (
                <Btn key={l} sm kind={newAddr.label === l ? 'primary' : 'gray'} title={l} onPress={() => setNewAddr({ ...newAddr, label: l })} />
              ))}
            </Row>
          </Field>
          <Field label="Address line"><Input value={newAddr.line1} onChangeText={(t) => setNewAddr({ ...newAddr, line1: t })} /></Field>
          <Field label="Area"><Input value={newAddr.area} onChangeText={(t) => setNewAddr({ ...newAddr, area: t })} /></Field>
          <Field label="City"><Input value={newAddr.city} onChangeText={(t) => setNewAddr({ ...newAddr, city: t })} /></Field>
          <Field label="Pincode"><Input keyboardType="number-pad" value={newAddr.pincode} onChangeText={(t) => setNewAddr({ ...newAddr, pincode: t })} /></Field>
          <Btn block title="Save address" onPress={addAddress} disabled={!newAddr.line1 || !newAddr.city} />
        </Sheet>
      )}
    </View>
  );
}
