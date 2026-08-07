"use client"

import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { usePrefersReducedMotion } from '@/lib/motion';

/**
 * Scroll reveal, anime.js v4.
 *
 * Wraps a group and animates its children in as the group enters the viewport, with a
 * stagger so a grid of cards resolves in a wave rather than all at once.
 *
 * Two rules it follows, because a reveal that gets them wrong is worse than no reveal:
 *   1. Content starts *visible* in the markup and is hidden by JS only once we know we
 *      can animate it. If the script fails or motion is reduced, the page still reads —
 *      it never leaves content stranded at opacity 0.
 *   2. It fires once, then stops observing. Re-animating on every scroll-past is the
 *      thing that makes "animated" sites exhausting to use.
 */
export default function Reveal({
  children,
  className = '',
  selector = ':scope > *',
  delay = 60,
  y = 24,
}) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll(selector));
    if (!items.length) return;

    const show = (el) => {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.willChange = '';
    };

    // `reduced` cannot be known on the server, so it starts false and flips to true on the
    // client once the media query resolves — by which time this effect has already run once
    // and hidden everything. Declining to animate is therefore NOT enough: we have to put
    // the content back, or a reduced-motion visitor is left staring at invisible products.
    if (reduced) {
      items.forEach(show);
      return;
    }

    // Hide only now — see rule 1.
    items.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = `translateY(${y}px)`;
      el.style.willChange = 'opacity, transform';
    });

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        animate(items, {
          opacity: [0, 1],
          translateY: [y, 0],
          duration: 620,
          delay: stagger(delay),
          ease: 'out(3)',
          onComplete: () => items.forEach((el) => { el.style.willChange = 'auto'; }),
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(root);

    return () => io.disconnect();
  }, [reduced, selector, delay, y]);

  // Last-ditch safety net: if this component ever unmounts mid-reveal (a route change while
  // a grid is animating), nothing is left behind holding content at opacity 0.
  useEffect(() => {
    const root = ref.current;
    return () => {
      root?.querySelectorAll(selector).forEach((el) => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.willChange = '';
      });
    };
  }, [selector]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
