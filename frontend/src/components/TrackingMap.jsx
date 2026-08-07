"use client"

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const emojiIcon = (emoji, size = 30) =>
  L.divIcon({
    html: `<div style="font-size:${size - 6}px;line-height:${size}px;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">${emoji}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

/**
 * Live tracking map. Props: store/destination/rider = { lat, lng, label } (any may be null).
 * Draws 🏪 store, 📍 destination, 🛵 rider + a dashed route line; auto-fits once, then
 * only the rider marker moves so the map doesn't jump while polling.
 *
 * Leaflet touches `window` at import time, so this must only ever be loaded through
 * next/dynamic with `ssr: false`.
 */
export default function TrackingMap({ store, destination, rider, height = 300 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    map.setView([20.5937, 78.9629], 5); // sane default until points arrive
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const l = layersRef.current;

    const upsert = (key, point, emoji, size) => {
      if (!point || point.lat == null) {
        if (l[key]) { l[key].remove(); delete l[key]; }
        return null;
      }
      if (l[key]) l[key].setLatLng([point.lat, point.lng]);
      else {
        l[key] = L.marker([point.lat, point.lng], { icon: emojiIcon(emoji, size) }).addTo(map);
        if (point.label) l[key].bindPopup(point.label);
      }
      return [point.lat, point.lng];
    };

    const storePt = upsert('store', store, '🏪', 30);
    const destPt = upsert('dest', destination, '📍', 30);
    const riderPt = upsert('rider', rider, '🛵', 34);

    const route = [storePt, riderPt, destPt].filter(Boolean);
    if (l.line) { l.line.remove(); delete l.line; }
    if (route.length >= 2) {
      l.line = L.polyline(riderPt && destPt ? [riderPt, destPt] : route, {
        color: '#00b3a6',
        weight: 3.5,
        dashArray: '9 9',
      }).addTo(map);
    }

    const pts = [storePt, destPt, riderPt].filter(Boolean);
    if (pts.length && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(pts).pad(0.3));
      fittedRef.current = true;
    }
  }, [store?.lat, store?.lng, destination?.lat, destination?.lng, rider?.lat, rider?.lng]);

  return <div ref={elRef} style={{ height }} className="w-full z-0" />;
}
