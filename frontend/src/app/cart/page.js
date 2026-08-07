"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, money } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart, Lock, Plus, Minus, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CartPage() {
  const { user, loading } = useAuth();
  const { refreshCart } = useCart();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = () => api('/cart').then(setData).catch((e) => setErr(e.message));
  
  useEffect(() => { 
    if (user) load(); 
  }, [user]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="bg-muted p-6 rounded-full"><Lock className="h-12 w-12 text-muted-foreground" /></div>
        <h2 className="text-2xl font-bold">Login to view your cart</h2>
        <Button asChild size="lg"><Link href="/auth">Login or Sign up</Link></Button>
      </div>
    );
  }

  if (err) return <div className="text-center p-8 text-destructive font-medium">{err}</div>;
  
  if (!data) return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  
  if (!data.groups.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="bg-muted p-6 rounded-full"><ShoppingCart className="h-12 w-12 text-muted-foreground" /></div>
        <h2 className="text-2xl font-bold">Your cart is empty</h2>
        <Button asChild size="lg"><Link href="/products">Browse products</Link></Button>
      </div>
    );
  }

  const setQty = async (itemId, qty) => {
    setUpdatingId(itemId);
    try {
      const d = await api(`/cart/${itemId}`, { method: 'PUT', body: { qty } });
      setData(d);
      refreshCart();
    } catch (e) {
      setErr(e.message);
    }
    setUpdatingId(null);
  };

  const totals = data.groups.reduce(
    (t, g) => ({
      items: t.items + g.itemsTotal,
      tax: t.tax + g.taxTotal,
      delivery: t.delivery + g.deliveryCharge,
    }),
    { items: 0, tax: 0, delivery: 0 }
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {data.groups.map((g, i) => (
              <motion.div
                key={g.partner._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-4 border-b flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{g.partner.storeName}</CardTitle>
                    </div>
                    {!g.partner.isOpen && <Badge variant="destructive">Store closed</Badge>}
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {g.items.map((it) => (
                        <div key={it.cartItemId} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {it.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.image} alt={it.title} className="w-16 h-16 rounded-xl object-cover bg-muted" />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                                <ShoppingCart className="h-6 w-6 text-muted-foreground/50" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold">{it.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {it.variantName && `${it.variantName} `}
                                {it.addons?.length > 0 && `· ${it.addons.map((a) => a.name).join(', ')}`}
                              </p>
                              <div className="text-primary font-bold mt-1 sm:hidden">{money(it.lineTotal)}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="flex items-center gap-3 bg-muted rounded-full p-1 border">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-full hover:bg-background"
                                disabled={updatingId === it.cartItemId}
                                onClick={() => setQty(it.cartItemId, it.qty - 1)}
                              >
                                {updatingId === it.cartItemId && it.qty - 1 >= 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
                              </Button>
                              <span className="w-4 text-center font-medium">{it.qty}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-full hover:bg-background"
                                disabled={updatingId === it.cartItemId}
                                onClick={() => setQty(it.cartItemId, it.qty + 1)}
                              >
                                {updatingId === it.cartItemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                            <div className="text-lg font-bold hidden sm:block min-w-[80px] text-right">
                              {money(it.lineTotal)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-muted/10 p-4 border-t text-sm text-right flex flex-col sm:flex-row justify-end items-end sm:items-center gap-2">
                      <span className="text-muted-foreground">Delivery fee: {g.deliveryCharge === 0 ? <Badge variant="secondary" className="ml-1 text-green-600">FREE</Badge> : money(g.deliveryCharge)}</span>
                      {g.partner.minOrder > 0 && g.itemsTotal < g.partner.minOrder && (
                        <span className="text-destructive font-medium bg-destructive/10 px-2 py-1 rounded">
                          Min order {money(g.partner.minOrder)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:sticky lg:top-24">
          <Card className="shadow-lg border-primary/10">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
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
                  {totals.delivery === 0 ? <span className="text-green-600 font-bold">FREE</span> : money(totals.delivery)}
                </span>
              </div>
              
              <div className="pt-4 border-t mt-4 flex justify-between items-end">
                <span className="text-lg font-semibold">Total To Pay</span>
                <span className="text-3xl font-black text-primary">{money(totals.items + totals.tax + totals.delivery)}</span>
              </div>
              
              <Button 
                className="w-full h-14 text-lg font-bold mt-6 shadow-md hover:shadow-lg transition-all" 
                onClick={() => router.push('/checkout')}
              >
                Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
