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
