import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// ~20 km/h average city riding speed, same assumption as the web TrackingMap
export const etaMinutes = (from, to) =>
  from?.lat != null && to?.lat != null ? Math.max(1, Math.round((haversineKm(from, to) / 20) * 60)) : null;

const html = (store, dest, rider) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;width:100%}.emoji{font-size:26px;line-height:26px;text-shadow:0 1px 3px rgba(0,0,0,.35)}</style>
</head><body><div id="map"></div><script>
  var map = L.map('map', { zoomControl: false, attributionControl: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  function mark(lat, lng, emoji, title) {
    return L.marker([lat, lng], { icon: L.divIcon({ html: '<div class="emoji" title="'+title+'">'+emoji+'</div>', className: '', iconSize: [26,26], iconAnchor: [13,13] }) }).addTo(map);
  }
  var pts = [];
  ${store?.lat != null ? `mark(${store.lat}, ${store.lng}, '🏪', 'Store'); pts.push([${store.lat}, ${store.lng}]);` : ''}
  ${dest?.lat != null ? `mark(${dest.lat}, ${dest.lng}, '📍', 'Delivery'); pts.push([${dest.lat}, ${dest.lng}]);` : ''}
  ${store?.lat != null && dest?.lat != null
    ? `L.polyline([[${store.lat},${store.lng}],[${dest.lat},${dest.lng}]], { color: '#00b3a6', dashArray: '8 8', weight: 3 }).addTo(map);`
    : ''}
  var riderMarker = null;
  window.updateRider = function (lat, lng) {
    if (lat == null) return;
    if (!riderMarker) riderMarker = mark(lat, lng, '🛵', 'Rider');
    else riderMarker.setLatLng([lat, lng]);
  };
  ${rider?.lat != null ? `updateRider(${rider.lat}, ${rider.lng}); pts.push([${rider.lat}, ${rider.lng}]);` : ''}
  if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36] });
  else if (pts.length === 1) map.setView(pts[0], 15);
  else map.setView([20.59, 78.96], 4);
</script></body></html>`;

export default function TrackingMap({ store, destination, rider, height = 280 }) {
  const ref = useRef(null);
  const first = useRef(true);

  // The map HTML is built once (fitBounds runs a single time); later rider moves
  // are injected so tiles don't reload on every location tick.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (rider?.lat != null) {
      ref.current?.injectJavaScript(`window.updateRider(${rider.lat}, ${rider.lng}); true;`);
    }
  }, [rider?.lat, rider?.lng]);

  return (
    <View style={{ height, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#ebebeb' }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: html(store, destination, rider) }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
