import { Suspense } from 'react';
import PaymentReturn from '@/components/PaymentReturn';

// Shared return page for the redirect-style gateways (PayPal / Paytm / Flutterwave).
export default function GatewayReturnPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-24 text-center">Confirming your payment…</div>}>
      <PaymentReturn mode="gateway" />
    </Suspense>
  );
}
