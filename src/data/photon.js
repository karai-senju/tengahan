// Photon (komoot, OSM-based) address search and reverse lookup.
// Usage policy (photon.komoot.io): free, fair use, no heavy load, credit OSM; callers debounce.
// Never throws: resolves {ok: true, ...} or {ok: false, error: 'offline' | 'busy' | 'failed'}.
const BASE = 'https://photon.komoot.io';
export const JAKARTA = { lat: -6.2, lon: 106.8166 }; // search bias, not a filter

// Readable one-line label from a Photon feature's properties.
function label(p) {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const parts = [p.name, street, p.district || p.locality, p.city || p.county, p.state];
  return parts.filter((x, i) => x && parts.indexOf(x) === i).join(', ');
}

const toPlace = (f) => ({ label: label(f.properties ?? {}), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] });

async function get(url, fetchFn, signal) {
  let res;
  try {
    res = await fetchFn(url, { signal });
  } catch {
    return { ok: false, error: signal?.aborted ? 'failed' : 'offline' };
  }
  if (res.status === 429 || res.status >= 500) return { ok: false, error: 'busy' };
  if (!res.ok) return { ok: false, error: 'failed' };
  try {
    return { ok: true, features: (await res.json()).features ?? [] };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function searchAddress(query, { fetch: fetchFn = globalThis.fetch, signal, bias = JAKARTA, limit = 5 } = {}) {
  const q = new URLSearchParams({ q: query, limit, lat: bias.lat, lon: bias.lon, location_bias_scale: 0.1 });
  const r = await get(`${BASE}/api/?${q}`, fetchFn, signal);
  if (!r.ok) return r;
  const seen = new Set(); // the same road can come back as several OSM segments
  const results = r.features.map(toPlace).filter((p) => p.label && !seen.has(p.label) && seen.add(p.label));
  return { ok: true, results };
}

export async function reverseAddress({ lat, lon }, { fetch: fetchFn = globalThis.fetch, signal } = {}) {
  const r = await get(`${BASE}/reverse?${new URLSearchParams({ lat, lon })}`, fetchFn, signal);
  if (!r.ok) return r;
  const found = r.features.map(toPlace).find((p) => p.label);
  return found ? { ok: true, label: found.label } : { ok: false, error: 'failed' };
}
