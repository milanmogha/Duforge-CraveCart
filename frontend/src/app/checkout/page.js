"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, money } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MapPin, CreditCard, Ticket, Store, Home, ArrowRight, ShieldCheck, Wallet } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import AddressAutocomplete from '@/components/AddressAutocomplete';

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load payment SDK'));
    document.body.appendChild(s);
  });
}

export async function openRazorpay(orderData, onDismiss) {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: orderData.keyId,
      order_id: orderData.razorpayOrderId,
      amount: Math.round(orderData.amount * 100),
      currency: orderData.currency,
      name: orderData.name || 'DapiGO',
      image: '/logo.png',
      prefill: orderData.prefill,
      theme: { color: '#00b3a6' },
      handler: resolve,
      modal: { ondismiss: () => { onDismiss?.(); reject(new Error('Payment cancelled')); } },
    });
    rzp.on('payment.failed', (resp) => reject(new Error(resp.error?.description || 'Payment failed')));
    rzp.open();
  });
}

// Redirect-style gateways: create the intent, then hand the browser to the gateway's
// hosted page. Each returns { url }; they all come back to /payment/gateway-return,
// which the backend builds from the `returnUrl` origin we pass here.
const REDIRECT_GATEWAYS = {
  paypal: '/payments/paypal/create-order',
  paytm: '/payments/paytm/create-txn',
  flutterwave: '/payments/flutterwave/create-payment',
  midtrans: '/payments/midtrans/create-transaction',
  phonepe: '/payments/phonepe/create-payment',
};

export default function CheckoutPage() {
  const { user, refresh } = useAuth();
  const { refreshCart } = useCart();
  const router = useRouter();
  
  const [cart, setCart] = useState(null);
  const [methods, setMethods] = useState([]);
  
  const [addressId, setAddressId] = useState('');
  const [payment, setPayment] = useState('cod');
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState(null);
  const [tip, setTip] = useState(0);
  const [note, setNote] = useState('');
  
  const [err, setErr] = useState('');
  const [placing, setPlacing] = useState(false);
  const [selfPickup, setSelfPickup] = useState(false);
  
  const [addrSheetOpen, setAddrSheetOpen] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: 'Home', line1: '', city: '', area: '', pincode: '', lat: null, lng: null });

  useEffect(() => {
    api('/cart').then((d) => {
      if (!d.groups.length) return router.push('/cart');
      setCart(d);
    });
    api('/payments/methods').then((d) => setMethods(d.methods.filter((m) => m.enabled)));
  }, [router]);

  useEffect(() => {
    const def = (user?.addresses || []).find((a) => a.isDefault) || user?.addresses?.[0];
    if (def) setAddressId(def._id);
  }, [user]);

  if (!cart || !user) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

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
    } catch (e) { 
      setApplied(null); 
      setErr(e.message); 
    }
  };

  const addAddress = async () => {
    setErr('');
    try {
      const { addresses } = await api('/auth/addresses', { method: 'POST', body: newAddr });
      await refresh();
      setAddressId(addresses[addresses.length - 1]._id);
      setAddrSheetOpen(false);
      setNewAddr({ label: 'Home', line1: '', city: '', area: '', pincode: '', lat: null, lng: null });
    } catch (e) { 
      setErr(e.message); 
    }
  };

  const checkoutParams = () => ({
    addressId: selfPickup ? undefined : addressId,
    promoCode: applied ? applied.code : undefined,
    tip: selfPickup ? 0 : Number(tip || 0),
    note,
    selfPickup,
  });

  const placeOrder = async () => {
    setErr(''); setPlacing(true);
    try {
      if (payment === 'stripe') {
        const d = await api('/payments/stripe/create-session', {
          method: 'POST',
          body: { purpose: 'order', params: checkoutParams(), returnUrl: window.location.origin },
        });
        window.location.href = d.url; 
        return;
      }
      if (payment === 'razorpay') {
        const orderData = await api('/payments/razorpay/create-order', {
          method: 'POST',
          body: { purpose: 'order', params: checkoutParams() },
        });
        const resp = await openRazorpay(orderData, () => setPlacing(false));
        const result = await api('/payments/razorpay/verify', { method: 'POST', body: resp });
        await refreshCart();
        await refresh();
        router.push(`/orders/${result.orders[0]._id}?placed=true`);
        return;
      }
      if (REDIRECT_GATEWAYS[payment]) {
        const d = await api(REDIRECT_GATEWAYS[payment], {
          method: 'POST',
          body: { purpose: 'order', params: checkoutParams(), returnUrl: window.location.origin },
        });
        window.location.href = d.url;
        return;
      }

      const { orders } = await api('/orders', {
        method: 'POST',
        body: { ...checkoutParams(), paymentMethod: payment },
      });
      await refreshCart();
      await refresh();
      router.push(`/orders/${orders[0]._id}?placed=true`);
    } catch (e) { 
      setErr(e.message); 
      setPlacing(false); 
    }
  };

  const tipOptions = [0, 10, 20, 30, 50];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          
          {/* Fulfillment Type */}
          <Card className="overflow-hidden border-primary/20">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className={`border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${!selfPickup ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:border-primary/50'}`}
                  onClick={() => setSelfPickup(false)}
                >
                  <Home className="h-8 w-8" />
                  <span className="font-semibold">Home Delivery</span>
                </div>
                <div 
                  className={`border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${selfPickup ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:border-primary/50'}`}
                  onClick={() => setSelfPickup(true)}
                >
                  <Store className="h-8 w-8" />
                  <span className="font-semibold">Self Pickup</span>
                  <Badge variant="secondary" className="text-[10px]">Save Delivery Fee</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address */}
          <AnimatePresence>
            {!selfPickup && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card>
                  <CardHeader className="bg-muted/30 pb-4 border-b flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" /> Delivery Address
                    </CardTitle>
                    <Sheet open={addrSheetOpen} onOpenChange={setAddrSheetOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm">+ Add New</Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader className="mb-6">
                          <SheetTitle>Add new address</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Find your address</label>
                            <AddressAutocomplete
                              onPick={(p) =>
                                setNewAddr((a) => ({
                                  ...a,
                                  // Keep whatever the customer already typed in line1 (flat/house
                                  // number) — the geocoder can't know it.
                                  line1: a.line1 || p.label.split(',')[0] || '',
                                  area: p.area || a.area,
                                  city: p.city || a.city,
                                  pincode: p.pincode || a.pincode,
                                  lat: p.lat,
                                  lng: p.lng,
                                }))
                              }
                            />
                            {newAddr.lat != null && (
                              <p className="text-xs text-muted-foreground">
                                📍 Pinned at {Number(newAddr.lat).toFixed(4)}, {Number(newAddr.lng).toFixed(4)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Label</label>
                            <select 
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                              value={newAddr.label} 
                              onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                            >
                              <option>Home</option><option>Work</option><option>Other</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Address Line 1</label>
                            <Input placeholder="Flat, House no., Building" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Area / Sector</label>
                            <Input placeholder="Area, Street, Sector" value={newAddr.area} onChange={(e) => setNewAddr({ ...newAddr, area: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">City</label>
                              <Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Pincode</label>
                              <Input value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })} />
                            </div>
                          </div>
                          <Button className="w-full mt-4" onClick={addAddress}>Save Address</Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </CardHeader>
                  <CardContent className="p-6">
                    {(user.addresses || []).length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-xl">
                        No saved addresses. Please add one to continue.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(user.addresses || []).map((a) => (
                          <div 
                            key={a._id}
                            onClick={() => setAddressId(a._id)}
                            className={`border-2 rounded-xl p-4 cursor-pointer relative transition-all ${addressId === a._id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{a.label}</span>
                              {a.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                              {addressId === a._id && <ShieldCheck className="h-5 w-5 text-primary absolute top-4 right-4" />}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {a.line1}{a.line2 ? ', ' + a.line2 : ''}, {a.area ? a.area + ', ' : ''}{a.city} {a.pincode}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Payment Method */}
          <Card>
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {methods.map((m) => (
                  <div 
                    key={m.id}
                    onClick={() => setPayment(m.id)}
                    className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${payment === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payment === m.id ? 'border-primary' : 'border-muted-foreground'}`}>
                        {payment === m.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold">{m.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.id === 'cod' && 'Pay with cash upon delivery'}
                          {m.id === 'wallet' && `Available balance: ${money(user.walletBalance)}`}
                          {m.id === 'stripe' && 'Secure hosted credit card checkout'}
                          {m.id === 'razorpay' && 'UPI, Wallets, Cards, Netbanking'}
                          {m.id === 'paypal' && 'Pay with your PayPal balance or card'}
                          {m.id === 'paytm' && 'Paytm wallet, UPI and cards'}
                          {m.id === 'flutterwave' && 'Cards, bank transfer and mobile money'}
                          {m.id === 'midtrans' && 'Cards, bank transfer and e-wallets'}
                          {m.id === 'phonepe' && 'PhonePe wallet, UPI and cards'}
                        </span>
                      </div>
                    </div>
                    {m.id === 'wallet' && <Wallet className="h-6 w-6 text-muted-foreground opacity-50" />}
                    {m.id === 'cod' && <div className="text-2xl opacity-50">💵</div>}
                    {m.id === 'stripe' && <CreditCard className="h-6 w-6 text-muted-foreground opacity-50" />}
                    {m.id === 'razorpay' && <div className="text-2xl opacity-50">🇮🇳</div>}
                    {m.id === 'paypal' && <div className="text-2xl opacity-50">🅿️</div>}
                    {m.id === 'paytm' && <div className="text-2xl opacity-50">📲</div>}
                    {m.id === 'flutterwave' && <div className="text-2xl opacity-50">🌍</div>}
                    {m.id === 'midtrans' && <div className="text-2xl opacity-50">🇮🇩</div>}
                    {m.id === 'phonepe' && <div className="text-2xl opacity-50">🟣</div>}
                  </div>
                ))}
              </div>
              {payment === 'wallet' && user.walletBalance < grand && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Wallet balance is insufficient. Top up from your profile or choose another method.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extras */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="bg-muted/30 pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" /> Promo Code
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. DAPIGO10" 
                    value={promo} 
                    onChange={(e) => setPromo(e.target.value.toUpperCase())} 
                    className="uppercase font-medium"
                  />
                  <Button variant="secondary" onClick={applyPromo} disabled={!promo}>Apply</Button>
                </div>
                {applied && (
                  <div className="mt-3 text-sm font-medium text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-md flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    {applied.code} applied — you save {money(applied.discount)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-muted/30 pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  📝 Order Note
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Textarea 
                  rows={2} 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  placeholder="e.g. Less spicy, call on arrival…" 
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>
          
          <AnimatePresence>
            {!selfPickup && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Card>
                  <CardHeader className="bg-muted/30 pb-3 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">🛵 Tip your rider</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-wrap gap-2">
                    {tipOptions.map((t) => (
                      <Button 
                        key={t} 
                        variant={Number(tip) === t ? "default" : "outline"}
                        onClick={() => setTip(t)}
                        className="flex-1 min-w-[80px]"
                      >
                        {t === 0 ? 'No tip' : money(t)}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <Card className="shadow-xl border-primary/20 bg-card/60 backdrop-blur-xl">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle>Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              
              <div className="space-y-2 mb-4 pb-4 border-b">
                {cart.groups.map((g) => (
                  <div key={g.partner._id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[200px]">{g.partner.storeName}</span>
                    <span className="font-medium">{g.items.length} item(s)</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Items total</span>
                <span className="font-medium text-foreground">{money(totals.items)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes</span>
                <span className="font-medium text-foreground">{money(totals.tax)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span className="font-medium text-foreground">
                  {selfPickup ? 'Self Pickup' : totals.delivery === 0 ? <span className="text-green-600 font-bold">FREE</span> : money(totals.delivery)}
                </span>
              </div>
              
              <AnimatePresence>
                {!selfPickup && Number(tip) > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-between text-muted-foreground overflow-hidden">
                    <span>Rider Tip</span>
                    <span className="font-medium text-foreground">{money(tip)}</span>
                  </motion.div>
                )}
                {discount > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-between text-green-600 overflow-hidden">
                    <span>Discount</span>
                    <span className="font-medium">−{money(discount)}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="pt-4 border-t mt-4 flex justify-between items-end">
                <span className="text-lg font-semibold">To Pay</span>
                <span className="text-3xl font-black text-primary">{money(grand)}</span>
              </div>

              {err && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm font-medium text-center mt-4">
                  {err}
                </div>
              )}
              
              <Button 
                className="w-full h-14 text-lg font-bold mt-6 shadow-md hover:shadow-lg transition-all group" 
                disabled={placing || (!selfPickup && !addressId) || (payment === 'wallet' && user.walletBalance < grand)}
                onClick={placeOrder}
              >
                {placing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing…</>
                ) : (
                  <>
                    {payment === 'cod' || payment === 'wallet' ? `Place Order · ${money(grand)}` : `Pay ${money(grand)}`}
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
