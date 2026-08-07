"use client"

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, SearchX, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  const get = (k, d = '') => searchParams.get(k) || d;
  
  const setParam = (k, v) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  useEffect(() => { 
    api('/catalog/categories').then((d) => setCats(d.categories)); 
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null);
    api(`/catalog/products?${searchParams.toString()}`)
      .then(setData)
      .catch(() => setData({ products: [], pages: 0 }))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <div className="container mx-auto px-4 py-8">
      
      {/* Filters & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 bg-card border rounded-2xl p-4 sm:p-6 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {get('search') ? `Results for “${get('search')}”` : 'Browse Products'}
          </h1>
          <p className="text-muted-foreground mt-1">Discover fresh food and essentials near you.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground ml-2" />
            <select 
              value={get('category')} 
              onChange={(e) => setParam('category', e.target.value)} 
              className="bg-transparent text-sm font-medium border-none focus:ring-0 cursor-pointer h-8 pl-1 pr-8"
            >
              <option value="">All Categories</option>
              {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border">
            <select 
              value={get('sort')} 
              onChange={(e) => setParam('sort', e.target.value)} 
              className="bg-transparent text-sm font-medium border-none focus:ring-0 cursor-pointer h-8 pl-2 pr-8"
            >
              <option value="">Sort: Relevance</option>
              <option value="popular">Popularity</option>
              <option value="rating">Top Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
          
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-muted/50 p-1.5 px-3 rounded-lg border hover:bg-muted transition-colors">
            <input 
              type="checkbox" 
              checked={get('veg') === 'true'} 
              onChange={(e) => setParam('veg', e.target.checked ? 'true' : '')} 
              className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
            />
            Veg Only
          </label>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground font-medium animate-pulse">Loading products...</p>
        </div>
      ) : data?.products?.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
          <div className="bg-muted p-6 rounded-full">
            <SearchX className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">No products found</h2>
          <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
          <Button onClick={() => router.push('/products')} variant="outline" className="mt-4">
            Clear all filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <AnimatePresence>
              {data.products.map((p, i) => (
                <motion.div
                  key={p._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard p={p} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12 pt-8 border-t">
              {Array.from({ length: data.pages }, (_, i) => (
                <Button
                  key={i}
                  variant={Number(get('page', '1')) === i + 1 ? "default" : "outline"}
                  className="w-10 h-10 p-0"
                  onClick={() => { 
                    const n = new URLSearchParams(searchParams); 
                    n.set('page', i + 1); 
                    router.push(`${pathname}?${n.toString()}`); 
                  }}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ProductsContent />
    </Suspense>
  );
}
