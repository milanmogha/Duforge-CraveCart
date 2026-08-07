"use client"

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import { usePrefersReducedMotion } from '@/lib/motion';

// Lenis drives scrolling on a rAF loop so wheel input eases instead of snapping.
// Two things it must not break, both handled below: reduced-motion users, and
// navigation (a new page must start at the top, not inherit the last scroll position).
let lenis = null;
export const getLenis = () => lenis;

export default function SmoothScroll({ children }) {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return; // native scrolling, untouched

    lenis = new Lenis({
      duration: 1.05,          // long enough to feel eased, short enough to feel direct
      smoothWheel: true,
      // Never hijack touch: on a phone the OS scroll is better than anything we can fake,
      // and momentum-jacking is the single most complained-about "smooth scroll" sin.
      syncTouch: false,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    let frame;
    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenis = null;
    };
  }, [reduced]);

  // Next keeps the scroll position across client navigations while Lenis owns the
  // scroller, so a route change would otherwise land you mid-page.
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return children;
}
