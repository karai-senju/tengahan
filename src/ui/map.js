// Leaflet wiring: Peserta pins, the Titik Tengah marker and map taps.
import { onChange, setLokasiRumah, tapMap } from '../app.js';
import { namaPeserta } from '../core.js';

const JAKARTA = [-6.2, 106.8166];

const map = L.map('map').setView(JAKARTA, 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

map.on('click', (e) => tapMap({ lat: e.latlng.lat, lon: e.latlng.lng }));

const titikTengahMarker = L.marker(JAKARTA, {
  icon: L.divIcon({ className: 'titik-tengah-icon', iconSize: [26, 26] }),
  interactive: false,
  keyboard: false,
  zIndexOffset: 1000,
}).bindTooltip('Titik Tengah', { permanent: true, direction: 'top', offset: [0, -14], className: 'titik-tengah-label' });

const pins = new Map(); // Peserta id -> Leaflet marker
let dragging = false;
let current;
let lastFitKey = '';

// Leaflet inserts string tooltip content as HTML, so names go in as a text-only element.
const textLabel = (text) => Object.assign(document.createElement('span'), { textContent: text });

function addPin(id, latlng) {
  const pin = L.marker(latlng, { draggable: true })
    .bindTooltip(textLabel(''), { permanent: true, direction: 'top', offset: [-15, -28] })
    .addTo(map);
  pin.on('dragstart', () => { dragging = true; });
  pin.on('drag', () => {
    const { lat, lng } = pin.getLatLng();
    setLokasiRumah(id, { lat, lon: lng });
  });
  pin.on('dragend', () => { dragging = false; fit(current); });
  pins.set(id, pin);
  return pin;
}

// Fit all pins plus the Titik Tengah, but only when a location changed
// (not on name typing) and not mid-drag.
function fit(state) {
  const points = [...state.peserta.map((p) => p.lokasiRumah), state.titikTengah]
    .filter(Boolean)
    .map((p) => [p.lat, p.lon]);
  const key = JSON.stringify(points);
  if (dragging || key === lastFitKey) return;
  lastFitKey = key;
  if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 13));
  else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
}

onChange((state) => {
  current = state;
  const ids = new Set(state.peserta.filter((p) => p.lokasiRumah).map((p) => p.id));
  for (const [id, pin] of pins) {
    if (!ids.has(id)) { pin.remove(); pins.delete(id); }
  }
  state.peserta.forEach((p, i) => {
    if (!p.lokasiRumah) return;
    const latlng = [p.lokasiRumah.lat, p.lokasiRumah.lon];
    const pin = pins.get(p.id) ?? addPin(p.id, latlng);
    if (!dragging) pin.setLatLng(latlng);
    pin.setTooltipContent(textLabel(namaPeserta(p.name, i)));
  });

  if (state.titikTengah) titikTengahMarker.setLatLng([state.titikTengah.lat, state.titikTengah.lon]).addTo(map);
  else titikTengahMarker.remove();

  fit(state);
});
