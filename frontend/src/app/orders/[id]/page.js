"use client"

import { useEffect, useState, useCallback, use } from 'react';
import { io } from 'socket.io-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money, dt, BASE, SOCKET_PATH } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { Loader2, Store, MapPin, Receipt, Clock, Motorbike, AlertCircle, RefreshCcw, Star, XCircle, CheckCircle2 } from 'lucide-react';
import { etaMinutes } from '@/lib/geo';

// Leaflet reaches for `window` at import time, so the map can never be prerendered.
const TrackingMap = dynamic(() => import('@/components/TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full bg-muted flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  ),
});

const TRACKABLE = ['assigned', 'picked_up', 'out_for_delivery'];

export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshCart } = useCart();
  
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const [tracking, setTracking] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  const placed = searchParams.get('placed') === 'true';

  const load = useCallback(() => api(`/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setErr(e.message)), [id]);
  
  useEffect(() => { load(); }, [load]);

  // Socket.io for live status and tracking
  useEffect(() => {
    if (!order) return;
    const active = !['delivered', 'completed', 'cancelled', 'refunded'].includes(order.status);
    const trackable = !order.selfPickup && TRACKABLE.includes(order.status);
    
    if (!active && !trackable) {
      setTracking(null);
      return;
    }
    
    // Same origin in every deployed environment (nginx proxies /socket.io to the API);
    // only local dev has to reach across to the backend's own port.
    const socket = io(
      window.location.hostname === 'localhost' && !BASE ? 'http://localhost:5000' : '/',
      { path: SOCKET_PATH }
    );

    if (active) {
      socket.on(`order_status_${order._id}`, () => load());
    }
    
    if (trackable) {
      let stop = false;
      api(`/orders/${id}/tracking`).then((d) => { if (!stop) setTracking(d.tracking); }).catch(() => {});
      
      if (order.rider) {
        socket.on(`rider_location_${order.rider._id}`, (loc) => {
          setTracking(prev => {
            if (!prev) return prev;
            return { ...prev, rider: { ...prev.rider, lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt } };
          });
        });
      }
      return () => { stop = true; socket.disconnect(); };
    }
    
    return () => socket.disconnect();
  }, [order?._id, order?.status, order?.rider?._id, id, load]);

  if (err) return <div className="text-center p-8 text-destructive font-medium">{err}</div>;
  if (!order) return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const canCancel = ['pending', 'confirmed', 'preparing'].includes(order.status);
  const finished = ['delivered', 'completed', 'cancelled', 'refunded'].includes(order.status);
  const eta = tracking?.rider ? etaMinutes(tracking.rider, tracking.destination) : null;

  const doReorder = async () => {
    setReordering(true);
    try {
      await api(`/orders/${order._id}/reorder`, { method: 'POST' });
      await refreshCart();
      router.push('/cart');
    } catch (e) { alert(e.message); setReordering(false); }
  };

  const doCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const d = await api(`/orders/${order._id}/status`, { method: 'PUT', body: { status: 'cancelled', reason: 'Changed my mind' } });
      setOrder(d.order);
    } catch (e) { alert(e.message); }
    setCancelling(false);
  };

  const getStatusColor = (s) => {
    if (['delivered', 'completed'].includes(s)) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
    if (['cancelled', 'refunded'].includes(s)) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (s === 'out_for_delivery') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-secondary text-secondary-foreground';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {placed && (
        <div className="mb-6 p-4 bg-green-100/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-800 dark:text-green-300 flex items-center gap-3">
          <div className="bg-green-500 rounded-full p-1"><CheckCircle2 className="h-5 w-5 text-white" /></div>
          <strong>Order placed successfully! The store has been notified.</strong>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Order {order.orderNumber}</h1>
            <Badge className={`capitalize text-sm px-3 py-1 ${getStatusColor(order.status)}`}>
              {order.status.replaceAll('_', ' ')}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Placed {dt(order.createdAt)} · {order.paymentMethod.toUpperCase()} · payment {order.paymentStatus}
          </p>
        </div>
        
        <div className="flex gap-2">
          {canCancel && (
            <Button variant="destructive" onClick={doCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Cancel Order
            </Button>
          )}
          {finished && (
            <Button onClick={doReorder} disabled={reordering}>
              {reordering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              Reorder
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tracking / Map (Simulated if active) */}
          {tracking && (
            <Card className="overflow-hidden border-primary/30 shadow-lg">
              <CardHeader className="bg-primary/5 pb-4 border-b">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Live Tracking</div>
                  <Badge variant="secondary" className="animate-pulse flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div> Live
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 relative">
                <TrackingMap
                  store={tracking.store}
                  destination={tracking.destination}
                  rider={tracking.rider}
                  height={300}
                />
                <div className="flex items-center gap-3 p-4 border-t bg-background/60">
                  <div className="w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center shrink-0">
                    <Motorbike className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {order.rider?.name ? `${order.rider.name} is on the way` : 'Finding a rider…'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {eta ? `Arriving in about ${eta} min` : 'Order is moving towards you.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> {order.partner?.partnerProfile?.storeName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.items.map((it, i) => (
                  <div key={i} className="p-4 sm:p-6 flex gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {it.image && <img src={it.image} alt={it.title} className="w-16 h-16 rounded-xl object-cover bg-muted" />}
                      <div>
                        <h4 className="font-semibold">{it.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {it.variantName && `${it.variantName} · `}Qty: {it.qty}
                          {it.addons?.length > 0 && ` · ${it.addons.map((a) => a.name).join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-lg font-bold min-w-[80px] text-right">
                      {money(it.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Delivery Details */}
          <Card>
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                {order.selfPickup ? <Store className="h-5 w-5 text-primary" /> : <MapPin className="h-5 w-5 text-primary" />}
                {order.selfPickup ? 'Self Pickup at Store' : 'Delivery Address'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!order.selfPickup && order.deliveryAddress && (
                <>
                  <strong className="block text-lg mb-1">{order.deliveryAddress.label}</strong>
                  <div className="text-muted-foreground">
                    {order.deliveryAddress.line1}, {order.deliveryAddress.area && order.deliveryAddress.area + ', '}
                    {order.deliveryAddress.city} {order.deliveryAddress.pincode}
                  </div>
                </>
              )}
              {order.customerNote && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg flex gap-3 text-sm">
                  <span>📝</span> <span><span className="font-semibold">Note:</span> {order.customerNote}</span>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Timeline */}
          <Card>
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="relative pl-6">
                    <div className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted'}`} />
                    {i !== order.statusHistory.length - 1 && (
                      <div className="absolute left-[4px] top-4 w-[2px] h-[calc(100%+8px)] bg-muted" />
                    )}
                    <strong className="block text-sm uppercase tracking-wider text-foreground mb-1">
                      {h.status.replaceAll('_', ' ')}
                    </strong>
                    <div className="text-xs text-muted-foreground">{dt(h.at)}{h.note ? ` — ${h.note}` : ''}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Receipt */}
          <Card>
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Receipt</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Items total</span>
                <span className="font-medium text-foreground">{money(order.itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes</span>
                <span className="font-medium text-foreground">{money(order.taxTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span className="font-medium text-foreground">{order.deliveryCharge === 0 ? 'FREE' : money(order.deliveryCharge)}</span>
              </div>
              {order.tip > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Rider tip</span>
                  <span className="font-medium text-foreground">{money(order.tip)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount {order.promoCode && `(${order.promoCode})`}</span>
                  <span>−{money(order.discount)}</span>
                </div>
              )}
              <div className="pt-3 border-t mt-3 flex justify-between items-end">
                <span className="font-bold text-base">Total</span>
                <span className="text-xl font-black text-primary">{money(order.grandTotal)}</span>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
