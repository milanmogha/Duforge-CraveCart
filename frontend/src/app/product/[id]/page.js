"use client"

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, money, dt } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { ProductCard } from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Heart, Plus, Minus, Star, Store, ShoppingCart, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ProductDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { refreshCart } = useCart();
  
  const [data, setData] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [addonIds, setAddonIds] = useState([]);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null); setVariantId(''); setAddonIds([]); setQty(1); setMsg('');
    api(`/catalog/products/${id}`).then((d) => {
      setData(d);
      if (d.product.variants?.length) setVariantId(d.product.variants[0]._id);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (user) setFav((user.favorites || []).some((f) => String(f) === id));
  }, [user, id]);

  if (loading || !data) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  const p = data.product;
  const variant = p.variants.find((v) => v._id === variantId);
  const base = variant ? variant.price : (p.salePrice ?? p.price);
  const addonsTotal = p.addons.filter((a) => addonIds.includes(a._id)).reduce((s, a) => s + a.price, 0);
  const unit = base + addonsTotal;

  const addToCart = async () => {
    if (!user) return router.push('/auth');
    setAdding(true);
    try {
      await api('/cart', { method: 'POST', body: { productId: p._id, variantId: variantId || undefined, addonIds, qty } });
      await refreshCart();
      setMsg('Added to cart ✓');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { 
      setMsg(e.message); 
    }
    setAdding(false);
  };

  const toggleFav = async () => {
    if (!user) return router.push('/auth');
    const { favorited } = await api(`/auth/favorites/${p._id}`, { method: 'POST' });
    setFav(favorited);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        
        {/* Product Image */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative aspect-square lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={p.images?.[0] || 'https://picsum.photos/seed/food/800/800'} 
            alt={p.title} 
            className="w-full h-full object-cover"
          />
          <Button 
            variant="secondary" 
            size="icon" 
            className="absolute top-4 right-4 rounded-full shadow-lg hover:scale-110 transition-transform"
            onClick={toggleFav}
          >
            <Heart className={`h-5 w-5 ${fav ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          
          <div className="absolute top-4 left-4 flex gap-2">
            {p.salePrice != null && <Badge variant="destructive" className="shadow-lg">Sale</Badge>}
            {p.isVeg ? (
              <Badge variant="outline" className="bg-green-100/90 text-green-700 dark:bg-green-900/90 dark:text-green-300 border-transparent shadow-lg">Veg</Badge>
            ) : (
              <Badge variant="outline" className="bg-red-100/90 text-red-700 dark:bg-red-900/90 dark:text-red-300 border-transparent shadow-lg">Non-veg</Badge>
            )}
          </div>
        </motion.div>

        {/* Product Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col space-y-6"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">{p.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm mt-3">
              {p.ratingCount > 0 && (
                <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 px-2.5 py-1 rounded-md font-bold">
                  <Star className="h-4 w-4 fill-current" />
                  {p.ratingAvg} <span className="font-normal opacity-70 ml-1">({p.ratingCount} reviews)</span>
                </div>
              )}
              {p.category?.name && (
                <Badge variant="secondary">{p.category.name}</Badge>
              )}
              {p.partner && (
                <Link href={`/store/${p.partner._id}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                  <Store className="h-4 w-4" />
                  <span className="underline underline-offset-4">{p.partner.partnerProfile?.storeName}</span>
                </Link>
              )}
            </div>
          </div>
          
          <p className="text-lg text-muted-foreground leading-relaxed">{p.description}</p>
          
          <div className="h-px bg-border w-full" />

          {/* Variants */}
          {p.variants?.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Options</label>
              <div className="flex flex-wrap gap-3">
                {p.variants.map((v) => (
                  <Button 
                    key={v._id} 
                    variant={variantId === v._id ? "default" : "outline"}
                    className={`h-auto py-2.5 px-4 ${variantId === v._id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                    onClick={() => setVariantId(v._id)}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold">{v.name}</span>
                      <span className="text-xs opacity-80">{money(v.price)}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {p.addons?.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add-ons</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {p.addons.map((a) => (
                  <label 
                    key={a._id} 
                    className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all hover:bg-muted/50 ${addonIds.includes(a._id) ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                        checked={addonIds.includes(a._id)}
                        onChange={(e) => setAddonIds((ids) => e.target.checked ? [...ids, a._id] : ids.filter((x) => x !== a._id))}
                      />
                      <span className="font-medium">{a.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">+{money(a.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Bar */}
          <Card className="border-primary/20 shadow-lg bg-card/60 backdrop-blur-xl mt-4">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Total</span>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black">{money(unit * qty)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 bg-muted rounded-full p-1 border ml-auto sm:ml-4">
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-background" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-bold text-lg">{qty}</span>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-background" onClick={() => setQty((q) => Math.min(p.maxQty || 20, q + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="w-full sm:flex-1 relative">
                {p.stock <= 0 ? (
                  <Button disabled variant="destructive" className="w-full h-14 text-lg font-bold">Out of Stock</Button>
                ) : (
                  <Button 
                    className="w-full h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all" 
                    onClick={addToCart}
                    disabled={adding}
                  >
                    {adding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />}
                    Add to Cart
                  </Button>
                )}
                
                <AnimatePresence>
                  {msg && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`absolute -top-12 left-0 right-0 flex justify-center`}
                    >
                      <Badge className={msg.includes('✓') ? 'bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 text-sm shadow-lg' : 'bg-destructive px-3 py-1.5 text-sm shadow-lg'}>
                        {msg}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Reviews & Related */}
      <div className="mt-20 space-y-16">
        {data.related?.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-6">You may also like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {data.related.map((rp, i) => (
                <motion.div key={rp._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <ProductCard p={rp} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {data.reviews?.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
              Reviews <Badge variant="secondary" className="rounded-full">{data.reviews.length}</Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.reviews.map((r, i) => (
                <motion.div key={r._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                          <span className="font-bold">{r.user?.name || 'Customer'}</span>
                          <span className="text-sm text-muted-foreground">{dt(r.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.verifiedPurchase && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>}
                        </div>
                      </div>
                      
                      <div className="flex gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted opacity-30'}`} />
                        ))}
                      </div>
                      
                      {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
