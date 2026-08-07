// Pure geo helpers — deliberately free of Leaflet so pages can compute an ETA
// without pulling the map (and its `window` access) into the server bundle.

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** ETA in whole minutes assuming city riding speed (~20 km/h), minimum 1 min. */
export function etaMinutes(from, to, speedKmh = 20) {
  const km = haversineKm(from, to);
  if (km == null) return null;
  return Math.max(1, Math.round((km / speedKmh) * 60));
}
