"use client"

import { useEffect, useRef } from 'react';
import {
  Clock, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from 'three';

// Ambient WebGL backdrop for the hero.
//
// Deliberately a single full-bleed shader plane, not a particle system and not
// react-three-fiber: one draw call, no scene graph, no extra dependency. The whole
// effect lives in the fragment shader, so cost scales with pixels rather than objects.
//
// It renders *behind* the slider at low opacity — it must never compete with the food
// photography or the "order" button, only give the panel some depth.

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Domain-warped value noise: cheap, and gives the slow "liquid" drift we want without
// the banding a plain gradient would show on a large panel.
const fragment = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec2  uResolution;

  const vec3 TEAL   = vec3(0.000, 0.702, 0.651); // #00b3a6 — brand
  const vec3 DEEP   = vec3(0.008, 0.243, 0.239);
  const vec3 WARM   = vec3(0.980, 0.706, 0.302); // #fab44d — brand warning/accent

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    uv.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.045;                 // slow: this is wallpaper, not a screensaver
    vec2 parallax = uMouse * 0.08;

    // Warp the sample point by another noise field so the blobs fold into each other.
    vec2 q = vec2(fbm(uv + parallax + t), fbm(uv + vec2(3.2, 1.7) - t));
    float n = fbm(uv * 1.6 + q * 1.4);

    vec3 col = mix(DEEP, TEAL, smoothstep(0.25, 0.85, n));
    col = mix(col, WARM, smoothstep(0.72, 0.98, n) * 0.35); // rare warm highlight

    // Fade at the edges so the canvas dissolves into the card instead of ending abruptly.
    float vignette = smoothstep(1.15, 0.25, length(vUv - 0.5) * 1.6);

    gl_FragColor = vec4(col, vignette);
  }
`;

export default function HeroCanvas({ className = '' }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    // Retina costs 4x the fragments for a background nobody looks at directly.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    host.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new Vector2(0, 0) },
      uResolution: { value: new Vector2(1, 1) },
    };
    const mesh = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true })
    );
    scene.add(mesh);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Pointer parallax, in normalized [-1,1] space, eased toward the target so the
    // background drifts after the cursor rather than snapping to it.
    const target = new Vector2(0, 0);
    const onPointer = (e) => {
      const r = host.getBoundingClientRect();
      target.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    // A GPU loop that runs while the hero is scrolled away — or the tab is in the
    // background — is pure waste and drains a phone. Only run when actually visible.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(host);
    const onVisibility = () => { visible = !document.hidden && visible; };
    document.addEventListener('visibilitychange', onVisibility);

    const clock = new Clock();
    let frame;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      uniforms.uTime.value = clock.getElapsedTime();
      uniforms.uMouse.value.lerp(target, 0.03);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      // WebGL contexts are a limited resource — leaking one per navigation eventually
      // kills the tab, so tear the whole thing down explicitly.
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
