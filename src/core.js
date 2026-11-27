// Pure functions: no DOM, no network, no Leaflet.

// Titik Tengah: average of the Lokasi Rumah latitudes and longitudes.
// null when there are fewer than 2 Lokasi Rumah.
export function titikTengah(lokasiRumah) {
  const n = lokasiRumah.length;
  if (n < 2) return null;
  return {
    lat: lokasiRumah.reduce((sum, p) => sum + p.lat, 0) / n,
    lon: lokasiRumah.reduce((sum, p) => sum + p.lon, 0) / n,
  };
}

const EARTH_RADIUS_KM = 6371;

// Straight-line (great-circle) distance in km between two {lat, lon} points.
export function haversineKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export const MIN_PESERTA = 2;
export const MAX_PESERTA = 5;

export const canAddPeserta = (count) => count < MAX_PESERTA;
export const canRemovePeserta = (count) => count > MIN_PESERTA;

// Display name of the Peserta at 0-based `index`: their name, or "Orang N".
export const namaPeserta = (name, index) => name?.trim() || `Orang ${index + 1}`;

// Tempat Nongkrong with `jarakKm` from the Titik Tengah added, nearest first.
export const urutkanMenurutJarak = (places, titik) =>
  places.map((p) => ({ ...p, jarakKm: haversineKm(titik, p) })).sort((a, b) => a.jarakKm - b.jarakKm);

// Plain Google Maps link to a point (no API key).
export const googleMapsUrl = ({ lat, lon }) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

// Perkiraan Waktu Tempuh: straight-line distance x road factor / average city speed.
export const ROAD_FACTOR = 1.4; // roads wind, so the real way is ~40% longer than a straight line
export const SPEED_KMH = 20; // rough average city speed, traffic not counted

// Whole minutes from `dari` to `ke` ({lat, lon} each).
export const waktuTempuhMenit = (dari, ke) => Math.round(((haversineKm(dari, ke) * ROAD_FACTOR) / SPEED_KMH) * 60);

// Filter button value -> place type; "semua" keeps everything.
export const FILTER_TYPE = { semua: null, kafe: 'cafe', restoran: 'restaurant' };

export const filterTempat = (places, filter) =>
  FILTER_TYPE[filter] ? places.filter((p) => p.type === FILTER_TYPE[filter]) : places;

// Display text for a travel time in whole minutes: "± 12 menit", or "< 1 menit" for 0.
export const teksWaktuTempuh = (menit) => (menit < 1 ? '< 1 menit' : `± ${menit} menit`);

// Link Bagikan: only the Titik Tengah and the filter, in the URL hash, e.g. "#v=1&t=-6.20000,106.81660&f=kafe".
// Format is frozen (docs/adr/0001-link-bagikan-format.md); never add Lokasi Rumah or Peserta names.
const KOORDINAT = 5; // decimals, ~1 m
export const buatLinkBagikan = (baseUrl, titik, filter) =>
  `${baseUrl.split('#')[0]}#v=1&t=${titik.lat.toFixed(KOORDINAT)},${titik.lon.toFixed(KOORDINAT)}&f=${filter in FILTER_TYPE ? filter : 'semua'}`;

// Reads a location hash: null when empty, {ok: false} when malformed, else {ok: true, titikTengah, filter}.
export function bacaLinkBagikan(hash) {
  const text = (hash ?? '').replace(/^#/, '');
  if (!text) return null;
  const params = new URLSearchParams(text);
  const [lat, lon] = (params.get('t') ?? '').split(',').map((s) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN));
  if (params.get('v') !== '1' || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return { ok: false };
  const filter = params.get('f');
  return { ok: true, titikTengah: { lat, lon }, filter: filter in FILTER_TYPE ? filter : 'semua' };
}
