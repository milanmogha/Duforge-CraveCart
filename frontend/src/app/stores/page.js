"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Store, Search, Star, MapPin } from 'lucide-react';

export default function StoresPage() {
  const [partners, setPartners] = useState(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api(`/catalog/partners?search=${encodeURIComponent(q)}`)
        .then((d) => setPartners(d.partners))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="container mx-auto px-4 py-8">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-card border rounded-3xl p-6 md:p-8 shadow-sm">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Discover Stores</h1>
          <p className="text-muted-foreground text-lg">Find the best local stores and restaurants near you.</p>
        </div>
        <div className="w-full md:w-[350px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search stores by name or cuisine..." 
            className="pl-10 h-12 text-md rounded-2xl bg-muted/50 border-primary/20 focus-visible:ring-primary/50"
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : partners?.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
          <div className="bg-muted p-6 rounded-full"><Store className="h-12 w-12 text-muted-foreground" /></div>
          <h2 className="text-2xl font-bold">No stores found</h2>
          <p className="text-muted-foreground">Try adjusting your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {partners?.map((s, i) => (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/store/${s._id}`}>
                  <Card className="h-full overflow-hidden hover:shadow-xl transition-all group border-primary/10">
                    <CardContent className="p-0 flex flex-row items-center h-full">
                      <div className="w-1/3 sm:w-32 h-full min-h-[140px] bg-muted relative overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={s.partnerProfile.logo || 'https://picsum.photos/seed/store/200'} 
                          alt={s.partnerProfile.storeName} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between h-full">
                        <div>
                          <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
                            {s.partnerProfile.storeName}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {(s.partnerProfile.cuisineTags || []).slice(0, 3).join(', ')}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[80px]">{s.partnerProfile.city}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.partnerProfile.ratingCount > 0 && (
                              <Badge variant="secondary" className="flex items-center gap-1 shadow-sm">
                                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                {s.partnerProfile.ratingAvg}
                              </Badge>
                            )}
                            <Badge variant={s.partnerProfile.isOpen ? "default" : "destructive"}>
                              {s.partnerProfile.isOpen ? 'Open' : 'Closed'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
