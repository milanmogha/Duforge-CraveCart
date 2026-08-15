import { Router } from 'express';
import { Setting } from '../models/Misc.js';
import { protect } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';

// v1 parity: search_places / search_location / get_location_details /
// get_location_details_by_lat_long (Api.php) + admin/Openstreetmap.php.
//
// v1 called Google Places with an API key. v2's maps are already keyless OSM
// (Leaflet + OSM tiles in TrackingMap), so Nominatim is the default here and Google
// is used only if an API key is configured — same feature, no mandatory key.
//
// Geocoding runs server-side, not from the browser, for three reasons: Nominatim's
// policy requires an identifying User-Agent, its rate limit is per-IP (one shared
// server IP is easier to keep under 1 req/s than N clients), and a Google key must
// never reach the client.

const router = Router();

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'CraveCart/2.0 (self-hosted delivery platform)';

// Nominatim's usage policy caps us at ~1 request/second. Serialize through a queue
// and memoize repeated lookups — an address form fires a query per keystroke.
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 500;
let chain = Promise.resolve();
let lastCall = 0;

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

/** Serialized, throttled fetch — never more than one Nominatim call per second. */
function throttled(url) {
  chain = chain.then(async () => {
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw Object.assign(new Error(`Geocoder returned ${r.status}`), { status: 502 });
    return r.json();
  });
  return chain;
}

async function googleKey() {
  const s = await Setting.findOne({ key: 'googleMapsKey' }).lean();
  return s?.value || process.env.GOOGLE_MAPS_KEY || '';
}

/** One shape for both providers, so callers don't care which one answered. */
const fromNominatim = (p) => ({
  placeId: `${p.osm_type?.[0] || 'N'}${p.osm_id}`,
  label: p.display_name,
  lat: Number(p.lat),
  lng: Number(p.lon),
  city: p.address?.city || p.address?.town || p.address?.village || p.address?.state_district || '',
  area: p.address?.suburb || p.address?.neighbourhood || p.address?.road || '',
  pincode: p.address?.postcode || '',
  country: p.address?.country || '',
});

// GET /api/geo/search?q=…&limit=5 — v1 search_places / search_location
router.get(
  '/search',
  protect,
  asyncH(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 3) return res.json({ places: [] });
    const limit = Math.min(Number(req.query.limit) || 5, 10);

    const key = `s:${q}:${limit}`;
    const hit = cached(key);
    if (hit) return res.json({ places: hit, cached: true });

    const gkey = await googleKey();
    let places;
    if (gkey) {
      // v1 behavior when a Google key exists.
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${gkey}`
      );
      const d = await r.json().catch(() => ({}));
      if (d.status && !['OK', 'ZERO_RESULTS'].includes(d.status)) {
        return res.status(502).json({ message: `Google Places: ${d.status}` });
      }
      places = (d.results || []).slice(0, limit).map((p) => ({
        placeId: p.place_id,
        label: p.formatted_address || p.name,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
        city: '',
        area: '',
        pincode: '',
        country: '',
      }));
    } else {
      const data = await throttled(
        `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`
      );
      places = (data || []).map(fromNominatim);
    }

    remember(key, places);
    res.json({ places });
  })
);

// GET /api/geo/reverse?lat=&lng= — v1 get_location_details_by_lat_long
router.get(
  '/reverse',
  protect,
  asyncH(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    const key = `r:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    const hit = cached(key);
    if (hit) return res.json({ place: hit, cached: true });

    const data = await throttled(
      `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`
    );
    if (!data || data.error) return res.status(404).json({ message: 'No address at that location' });

    const place = fromNominatim(data);
    remember(key, place);
    res.json({ place });
  })
);

// GET /api/geo/place/:placeId — v1 get_location_details (resolve a picked suggestion)
router.get(
  '/place/:placeId',
  protect,
  asyncH(async (req, res) => {
    const id = req.params.placeId;
    const key = `p:${id}`;
    const hit = cached(key);
    if (hit) return res.json({ place: hit, cached: true });

    // Nominatim ids are "<type-initial><osm_id>", e.g. W12345 — that's what /lookup wants.
    if (!/^[NWR]\d+$/i.test(id)) {
      return res.status(400).json({ message: 'Unsupported place id' });
    }
    const data = await throttled(
      `${NOMINATIM}/lookup?format=jsonv2&addressdetails=1&osm_ids=${id.toUpperCase()}`
    );
    if (!data?.length) return res.status(404).json({ message: 'Place not found' });

    const place = fromNominatim(data[0]);
    remember(key, place);
    res.json({ place });
  })
);

export default router;
