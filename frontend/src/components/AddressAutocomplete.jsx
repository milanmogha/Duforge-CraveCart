"use client"

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, LocateFixed } from 'lucide-react';

// v1 parity: search_places + get_location_details_by_lat_long, wired into the address
// form so a saved address actually carries lat/lng. Without this the coordinates are
// never populated and delivery-radius checks and rider tracking silently degrade.
//
// The geocoder is rate-limited (Nominatim allows ~1 req/s), so debounce hard rather
// than firing per keystroke.
export default function AddressAutocomplete({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState('');
  // A slow response for an old query must not overwrite a newer one.
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const d = await api(`/geo/search?q=${encodeURIComponent(q)}`);
        if (mine === seq.current) setResults(d.places || []);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (p) => {
    onPick(p);
    setQ('');
    setResults([]);
  };

  const useMyLocation = () => {
    setErr('');
    if (!navigator.geolocation) return setErr('Location is not available in this browser.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const d = await api(`/geo/reverse?lat=${latitude}&lng=${longitude}`);
          pick(d.place);
        } catch (e) {
          setErr(e.message);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setErr('Could not get your location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for your address…"
            autoComplete="off"
          />
          {busy && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} title="Use my location">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        </Button>
      </div>

      {err && <p className="text-xs text-destructive">{err}</p>}

      {results.length > 0 && (
        <ul className="border rounded-lg divide-y max-h-56 overflow-y-auto bg-background">
          {results.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 flex gap-2 items-start"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span className="text-sm leading-snug">{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
