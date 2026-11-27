// Tempat Nongkrong from the Overpass API (OpenStreetMap). Never throws: resolves to
// {ok: true, ...} or {ok: false, error: 'offline' | 'busy' | 'failed'}.
// Usage policy (re-checked 2026-11-25): keep requests few and one at a time, declare a
// timeout, and pause 30 s after a 429/504. The pause lives in src/ui/places.js.
// ponytail: the public overpass-api.de instance counts every visitor together; move to a
// self-hosted or paid instance if the site gets popular (see spec #1, Further Notes).
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Radius Pencarian steps in km: start at 2, widen when nothing is found.
export const RADIUS_KM = [2, 5, 10];

// Give up on a stalled request (the query itself declares a 25 s server timeout).
const TIMEOUT_MS = 30000;

// Only cafes and restaurants (malls are never asked for). nwr + out center also
// returns cafes mapped as building outlines, with a center point.
export function buildQuery({ lat, lon }, radiusKm) {
  return `[out:json][timeout:25];nwr(around:${radiusKm * 1000},${lat},${lon})[amenity~"^(cafe|restaurant)$"][name];out center;`;
}

function parse(elements) {
  return elements.flatMap((el) => {
    const name = el?.tags?.name?.trim();
    const lat = el?.lat ?? el?.center?.lat;
    const lon = el?.lon ?? el?.center?.lon;
    if (!name || lat == null || lon == null) return [];
    return [{ id: `${el.type}/${el.id}`, name, lat, lon, type: el.tags.amenity }];
  });
}

// One query at one radius → {ok: true, places: [{id, name, lat, lon, type}]}.
export async function cariTempat(titik, radiusKm, { fetch: fetchFn = globalThis.fetch } = {}) {
  let res;
  try {
    res = await fetchFn(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(buildQuery(titik, radiusKm))}`,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'busy' : 'offline' };
  }
  if (res.status === 429 || res.status >= 500) return { ok: false, error: 'busy' };
  if (!res.ok) return { ok: false, error: 'failed' };
  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'failed' };
  }
  // A query cut short by the server still answers 200, with a remark and no elements.
  if (/runtime error|timed out|out of memory/i.test(json?.remark ?? '')) return { ok: false, error: 'busy' };
  if (!Array.isArray(json?.elements)) return { ok: false, error: 'failed' };
  return { ok: true, places: parse(json.elements) };
}

// Radius Pencarian loop: 2 → 5 → 10 km, one request at a time, stop at the first
// radius with places or at the first error. → {ok: true, places, radiusKm}.
export async function cariTempatNongkrong(titik, options = {}) {
  for (const radiusKm of RADIUS_KM) {
    const result = await cariTempat(titik, radiusKm, options);
    if (!result.ok) return result;
    if (result.places.length) return { ...result, radiusKm };
  }
  return { ok: true, places: [], radiusKm: RADIUS_KM.at(-1) };
}
