import { Suspense } from 'react';
import PaymentReturn from '@/components/PaymentReturn';

// useSearchParams() forces client-side rendering up to the nearest Suspense boundary,
// so the boundary is required here or the build fails on prerender.
export default function StripeReturnPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-24 text-center">Confirming your payment…</div>}>
      <PaymentReturn mode="stripe" />
    </Suspense>
  );
}
