"use client"

import { useEffect, useState, use } from 'react';
import { api, dt } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Clock, Star, Info, MessageSquare } from 'lucide-react';

export default function StoreDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    setLoading(true);
    api(`/catalog/partners/${id}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !data) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  
  const s = data.partner.partnerProfile;
  const byCat = {};
  
  for (const p of data.products) {
    const cat = p.category?.name || 'Other';
    (byCat[cat] = byCat[cat] || []).push(p);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      
      {/* Store Banner & Profile */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden bg-card border shadow-lg mb-12 relative"
      >
        <div className="h-48 md:h-64 w-full relative bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={s.banner || 'https://picsum.photos/seed/restaurant/1200/400'} 
            className="w-full h-full object-cover" 
            alt="Store Banner" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        </div>
        
        <div className="px-6 md:px-10 pb-8 pt-4 flex flex-col md:flex-row gap-6 items-start md:items-end relative -mt-16 md:-mt-20 z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={s.logo || 'https://picsum.photos/seed/store/200'} 
            className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-card object-cover shadow-xl bg-muted" 
            alt={s.storeName} 
          />
          
          <div className="flex-1 w-full text-white md:text-foreground md:pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-16 md:mt-0">
            <div>
              <h1 className="text-3xl md:text-4xl font-black mb-2 text-foreground">{s.storeName}</h1>
              <p className="text-muted-foreground max-w-2xl text-sm md:text-base mb-4">{s.description}</p>
              
              <div className="flex flex-wrap gap-2 md:gap-3">
                {s.ratingCount > 0 && (
                  <Badge variant="secondary" className="px-3 py-1 text-sm shadow-sm">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                    {s.ratingAvg} ({s.ratingCount} reviews)
                  </Badge>
                )}
                <Badge variant={s.isOpen ? "default" : "destructive"} className="px-3 py-1 text-sm">
                  {s.isOpen ? 'Open Now' : 'Closed'}
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-sm bg-background">
                  <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                  {s.openTime} – {s.closeTime}
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-sm bg-background">
                  <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                  {s.city}
                </Badge>
              </div>
            </div>
            
            <Card className="hidden lg:block min-w-[250px] shadow-sm bg-background/90 backdrop-blur">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Info className="h-4 w-4" /> Delivery Fee</span>
                  <span className="font-semibold">₹{s.deliveryCharge}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t pt-2">
                  <span className="text-muted-foreground">Free delivery above</span>
                  <span className="font-semibold">₹{s.freeDeliveryAbove}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>

      {/* Products by Category */}
      <div className="space-y-12">
        {Object.entries(byCat).map(([cat, products], idx) => (
          <motion.section 
            key={cat}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold tracking-tight">{cat}</h2>
              <div className="h-px bg-border flex-1 ml-4" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {products.map((p) => (
                <ProductCard key={p._id} p={p} />
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      {/* Reviews */}
      {data.reviews?.length > 0 && (
        <motion.section 
          className="mt-20 pt-12 border-t"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">What customers say</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.reviews.map((r, i) => (
              <Card key={r._id} className="h-full bg-muted/20 border-primary/10">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{r.user?.name || 'Verified Customer'}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{dt(r.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted opacity-30'}`} />
                    ))}
                  </div>
                  
                  {r.comment && <p className="text-sm text-muted-foreground leading-relaxed italic">"{r.comment}"</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>
      )}
      
    </div>
  );
}
