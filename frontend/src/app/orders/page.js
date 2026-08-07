"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, dt } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, PackageOpen, Package, Store, Clock } from 'lucide-react';

export default function OrdersPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/orders/my${status ? `?status=${status}` : ''}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [status]);

  const getStatusColor = (s) => {
    if (['delivered', 'completed'].includes(s)) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
    if (['cancelled', 'refunded'].includes(s)) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (s === 'out_for_delivery') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-secondary text-secondary-foreground';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
          <p className="text-muted-foreground mt-1">Track, review, and reorder your past purchases.</p>
        </div>
        
        <select 
          className="flex h-10 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          value={status} 
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data?.orders?.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 bg-muted/20 rounded-2xl border border-dashed p-8 text-center">
          <div className="bg-muted p-6 rounded-full">
            <PackageOpen className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">No orders found</h2>
          <p className="text-muted-foreground max-w-sm">You haven't placed any orders yet, or no orders match this status filter.</p>
          <Button asChild className="mt-4"><Link href="/products">Start Shopping</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {data?.orders?.map((o, i) => (
              <motion.div
                key={o._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/orders/${o._id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer group hover:border-primary/50">
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      
                      <div className="flex gap-4 items-start">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg">{o.orderNumber}</span>
                            <Badge variant="outline" className={`capitalize ${getStatusColor(o.status)}`}>
                              {o.status.replaceAll('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" /> {o.partner?.partnerProfile?.storeName || o.partner?.name}</span>
                            <span className="flex items-center gap-1 hidden sm:flex"><Clock className="h-3.5 w-3.5" /> {dt(o.createdAt)}</span>
                            <span className="font-medium px-2 py-0.5 bg-muted rounded">{o.items.length} item(s)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0">
                        <span className="text-xl font-black">{money(o.grandTotal)}</span>
                        <span className="text-sm font-medium text-primary sm:opacity-0 sm:-translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                          View details →
                        </span>
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
