"use client"

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Undo2 } from 'lucide-react';

// Landing page the payment gateways redirect back to. The backend builds these URLs
// (see routes/payments.js), so the paths and query params here must match it exactly:
//   /payment/stripe-return?session_id=…        | ?cancelled=1
//   /payment/gateway-return?gateway=paypal&token=…
//   /payment/gateway-return?gateway=paytm&orderId=…
//   /payment/gateway-return?gateway=flutterwave&tx_ref=…&status=…
//
// Confirm is idempotent server-side, but StrictMode double-invokes effects in dev,
// so we guard with a ref to avoid firing two confirms for one redirect.
function resolveConfirm(mode, params) {
  if (mode === 'stripe') {
    const sessionId = params.get('session_id');
    return sessionId ? { path: '/payments/stripe/confirm', body: { sessionId } } : null;
  }
  const confirms = {
    // PayPal appends ?token=<orderId> on return
    paypal: { path: '/payments/paypal/confirm', body: { orderId: params.get('token') || params.get('orderId') } },
    paytm: { path: '/payments/paytm/confirm', body: { orderId: params.get('orderId') } },
    flutterwave: { path: '/payments/flutterwave/confirm', body: { txRef: params.get('tx_ref') } },
    midtrans: { path: '/payments/midtrans/confirm', body: { orderId: params.get('orderId') || params.get('order_id') } },
    phonepe: { path: '/payments/phonepe/confirm', body: { orderId: params.get('orderId') } },
  };
  const c = confirms[params.get('gateway')];
  if (!c || !Object.values(c.body)[0]) return null;
  return c;
}

export default function PaymentReturn({ mode }) {
  const params = useSearchParams();
  const router = useRouter();
  const { refreshCart } = useCart();
  const { refresh } = useAuth();
  const [state, setState] = useState({ status: 'working', message: 'Confirming your payment…' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (params.get('cancelled') || params.get('status') === 'cancelled') {
      setState({ status: 'cancelled', message: 'Payment was cancelled. Your cart is untouched.' });
      return;
    }

    const c = resolveConfirm(mode, params);
    if (!c) {
      setState({ status: 'error', message: 'Missing payment reference.' });
      return;
    }

    (async () => {
      try {
        const result = await api(c.path, { method: 'POST', body: c.body });
        await refreshCart();
        await refresh();
        if (result.purpose === 'topup') {
          router.replace('/profile?tab=wallet');
        } else if (result.orders?.length) {
          router.replace(`/orders/${result.orders[0]._id}?placed=true`);
        } else {
          setState({ status: 'done', message: result.message });
        }
      } catch (e) {
        setState({ status: 'error', message: e.message });
      }
    })();
  }, [mode, params, router, refreshCart, refresh]);

  const icon = {
    working: <Loader2 className="h-10 w-10 animate-spin text-primary" />,
    cancelled: <Undo2 className="h-10 w-10 text-muted-foreground" />,
    error: <AlertCircle className="h-10 w-10 text-destructive" />,
    done: <CheckCircle2 className="h-10 w-10 text-green-600" />,
  }[state.status];

  return (
    <div className="container mx-auto px-4 py-24 flex flex-col items-center text-center gap-6">
      <div className="rounded-full bg-muted/50 p-6">{icon}</div>
      <p className="text-lg font-medium max-w-md">{state.message}</p>

      {state.status === 'cancelled' && (
        <Button asChild><Link href="/checkout">Back to checkout</Link></Button>
      )}
      {state.status === 'error' && (
        <div className="flex gap-3">
          <Button asChild variant="outline"><Link href="/profile?tab=wallet">Check wallet</Link></Button>
          <Button asChild><Link href="/cart">Back to cart</Link></Button>
        </div>
      )}
    </div>
  );
}
