// Tempat Nongkrong around the Titik Tengah: list in #places plus map markers, kept in sync.
import { onChange } from '../app.js';
import { urutkanMenurutJarak, googleMapsUrl } from '../core.js';
import { cariTempatNongkrong, RADIUS_KM } from '../data/overpass.js';
import { map } from './map.js';

const DEBOUNCE_MS = 800; // search once the Titik Tengah settles, not on every drag frame
const PAUSE_MS = 30000; // Overpass policy: wait 30 s after the server says it is busy
const MAX_SHOWN = 50; // ponytail: only the 50 nearest are shown; add paging if people want more

const MENCARI = 'Mencari tempat nongkrong…';
const JENIS = { cafe: 'Kafe', restaurant: 'Restoran' };
const PESAN_ERROR = {
  offline: 'Tidak ada koneksi internet. Periksa koneksimu lalu coba lagi.',
  busy: 'Layanan peta sedang sibuk. Coba lagi sebentar lagi.',
  failed: 'Gagal memuat tempat nongkrong. Coba lagi.',
};

const section = document.getElementById('places');
section.innerHTML = `
  <h2>Tempat Nongkrong</h2>
  <p class="places-status" role="status" aria-live="polite"></p>
  <button class="coba-lagi" type="button" hidden>Coba lagi</button>
  <ol class="places-list"></ol>`;
const status = section.querySelector('.places-status');
const cobaLagi = section.querySelector('.coba-lagi');
const list = section.querySelector('.places-list');
const layer = L.layerGroup().addTo(map);
const shown = new Map(); // place id -> {li, marker}

let key = null; // null so the first onChange (no Titik Tengah yet) still shows the hint
let titik = null;
let seq = 0; // bumped on every Titik Tengah change, so stale answers are dropped
let timer;
let inFlight = false;
let pausedUntil = 0;
let highlighted = null;

const jarak = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
const textLabel = (text) => Object.assign(document.createElement('span'), { textContent: text });

function show(text, { loading = false, retry = false } = {}) {
  status.textContent = text;
  status.classList.toggle('loading', loading);
  cobaLagi.hidden = !retry;
}

function clear() {
  layer.clearLayers();
  list.replaceChildren();
  shown.clear();
  highlighted = null;
}

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(search, Math.max(ms, pausedUntil - Date.now()));
}

async function search() {
  if (inFlight) return; // one request at a time; the running search reschedules if stale
  inFlight = true;
  const mine = seq;
  const at = titik;
  const result = await cariTempatNongkrong(at);
  inFlight = false;
  if (!result.ok && result.error === 'busy') pausedUntil = Date.now() + PAUSE_MS;
  if (mine !== seq) {
    if (titik) schedule(DEBOUNCE_MS);
    return;
  }
  if (!result.ok) return show(PESAN_ERROR[result.error] ?? PESAN_ERROR.failed, { retry: true });
  render(urutkanMenurutJarak(result.places, at), result.radiusKm);
}

function render(places, radiusKm) {
  if (!places.length) {
    return show(`Belum ketemu kafe atau restoran dalam ${radiusKm} km dari Titik Tengah. Coba geser Lokasi Rumah.`);
  }
  const lines = [];
  const step = RADIUS_KM.indexOf(radiusKm);
  if (step > 0) lines.push(`Tidak ada tempat dalam ${RADIUS_KM[step - 1]} km, menampilkan dalam ${radiusKm} km.`);
  lines.push(places.length > MAX_SHOWN
    ? `${places.length} tempat dalam ${radiusKm} km, ${MAX_SHOWN} terdekat ditampilkan.`
    : `${places.length} tempat dalam ${radiusKm} km, terdekat di atas.`);
  show(lines.join(' '));
  places.slice(0, MAX_SHOWN).forEach((p) => addPlace(p));
}

function addPlace(p) {
  const li = document.createElement('li');
  li.className = `place ${p.type}`;
  const pilih = document.createElement('button');
  pilih.type = 'button';
  pilih.className = 'place-pilih';
  pilih.append(
    Object.assign(document.createElement('span'), { className: 'place-nama', textContent: p.name }),
    Object.assign(document.createElement('span'), { className: 'place-info', textContent: `${JENIS[p.type]} · ${jarak(p.jarakKm)}` }),
  );
  const gmaps = Object.assign(document.createElement('a'), {
    className: 'gmaps',
    href: googleMapsUrl(p),
    target: '_blank',
    rel: 'noopener',
    textContent: 'Buka di Google Maps',
  });
  gmaps.setAttribute('aria-label', `Buka ${p.name} di Google Maps`);
  li.append(pilih, gmaps);
  list.append(li);

  const marker = L.circleMarker([p.lat, p.lon], style(p.type, false))
    .bindTooltip(textLabel(p.name), { direction: 'top', offset: [0, -6] })
    .addTo(layer);
  shown.set(p.id, { li, marker, type: p.type });
  pilih.addEventListener('click', () => {
    highlight(p.id);
    if (!map.getBounds().contains(marker.getLatLng())) map.panTo(marker.getLatLng());
    document.getElementById('map').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  marker.on('click', () => {
    highlight(p.id);
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function style(type, active) {
  const color = type === 'cafe' ? '#8a4f1d' : '#2f7d4f';
  return { radius: active ? 11 : 7, weight: active ? 4 : 2, color: active ? '#1f2933' : '#fff', fillColor: color, fillOpacity: 0.95 };
}

function highlight(id) {
  const prev = shown.get(highlighted);
  if (prev) {
    prev.li.classList.remove('active');
    prev.marker.setStyle(style(prev.type, false)).closeTooltip();
  }
  const next = shown.get(id);
  highlighted = id;
  next.li.classList.add('active');
  next.marker.setStyle(style(next.type, true)).bringToFront().openTooltip();
}

cobaLagi.addEventListener('click', () => {
  const wait = Math.ceil((pausedUntil - Date.now()) / 1000);
  show(wait > 0 ? `Layanan peta masih sibuk. Mencoba lagi dalam ${wait} detik…` : MENCARI, { loading: true });
  schedule(0);
});

onChange((state) => {
  const t = state.titikTengah;
  const k = t ? `${t.lat},${t.lon}` : '';
  if (k === key) return; // name typing and other changes don't move the Titik Tengah
  key = k;
  titik = t;
  seq++;
  clearTimeout(timer);
  clear(); // the old list's distances no longer match the new Titik Tengah
  if (!t) {
    return show('Pasang Lokasi Rumah minimal 2 Peserta untuk melihat Tempat Nongkrong di sekitar Titik Tengah.');
  }
  show(MENCARI, { loading: true });
  schedule(DEBOUNCE_MS);
});
