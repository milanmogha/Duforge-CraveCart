"use client"

import { useEffect, useState } from 'react';

/**
 * Motion policy for the storefront.
 *
 * This is a shop, not a showreel: the animation budget exists to make the page feel
 * responsive, never to delay someone from ordering food. Two gates decide how much
 * motion a visitor actually gets.
 */

/** Gate 1 — the user asked for less motion. Non-negotiable: honour it. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Gate 2 — can this device afford WebGL?
 *
 * A three.js canvas costs a continuous GPU loop. On a mid-range Android that competes
 * with the very scroll it is meant to enhance, so we only render it on hardware that
 * can clearly spare the frames, and fall back to a static gradient everywhere else.
 * Deliberately conservative: the fallback looks fine, a janky hero does not.
 */
export function useCanRenderWebGL() {
  const [ok, setOk] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setOk(false);
      return;
    }
    // Save-Data means the visitor is paying for bytes — don't spend ~150KB on decoration.
    if (navigator.connection?.saveData) return;

    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = navigator.deviceMemory ?? 4; // Chromium-only; assume mid-range elsewhere
    if (cores < 4 || memory < 4) return;

    // Confirm a context is actually obtainable rather than assuming it.
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return;
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    setOk(true);
  }, [reduced]);

  return ok;
}
