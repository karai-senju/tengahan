// Address search, "Pakai lokasi saya" and reverse lookup, added to each Peserta row.
import { onChange, setLokasiRumah } from '../app.js';
import { namaPeserta } from '../core.js';
import { searchAddress, reverseAddress } from '../data/photon.js';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400; // keeps typing within Photon's fair use
const ERRORS = {
  offline: 'Tidak ada internet. Coba lagi nanti.',
  busy: 'Layanan alamat sedang sibuk. Coba lagi sebentar lagi.',
  failed: 'Alamat tidak ditemukan. Coba kata lain, atau ketuk peta.',
};
const GEO_ERRORS = {
  1: 'Izin lokasi ditolak. Ketik alamat atau ketuk peta saja.',
  2: 'Lokasi tidak tersedia. Ketik alamat atau ketuk peta saja.',
  3: 'Lokasi terlalu lama didapat. Ketik alamat atau ketuk peta saja.',
};

const style = document.createElement('style');
style.textContent = `
.alamat { display: grid; gap: 4px; margin-top: 4px; }
.alamat input { width: 100%; padding: 0 10px; border: 1px solid #c7ccd1; border-radius: 8px; }
.alamat .lokasi-saya { justify-self: start; }
.alamat .saran { list-style: none; margin: 0; padding: 0; border: 1px solid #c7ccd1; border-radius: 8px; background: #fff; }
.alamat .saran:empty { display: none; }
.alamat .saran button { width: 100%; min-height: 44px; border: 0; border-radius: 0; text-align: left; font-size: 0.9rem; }
.alamat .saran li + li button { border-top: 1px solid #e4e7eb; }
.alamat .pesan { margin: 0; font-size: 0.85rem; color: #b03a15; }
.alamat .pesan:empty { display: none; }`;
document.head.append(style);

const list = document.getElementById('peserta-list');
const rows = new Map(); // Peserta id -> {input, saran, pesan}
const known = new Map(); // Peserta id -> Lokasi Rumah we already have an address for
const reverseTimers = new Map();
const reverseAborts = new Map();

const same = (a, b) => a && b && a.lat === b.lat && a.lon === b.lon;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function addRow(id, li) {
  const box = document.createElement('div');
  box.className = 'alamat';
  box.innerHTML = `
    <input type="text" class="alamat-input" autocomplete="off" placeholder="Ketik alamat…">
    <ul class="saran"></ul>
    <p class="pesan" role="status"></p>
    <button type="button" class="lokasi-saya">📍 Pakai lokasi saya</button>`;
  li.querySelector('.info').append(box);
  const row = { input: box.querySelector('input'), saran: box.querySelector('.saran'), pesan: box.querySelector('.pesan') };
  let abort;

  const search = debounce(async () => {
    abort?.abort();
    const q = row.input.value.trim();
    row.saran.replaceChildren();
    if (q.length < MIN_CHARS) { row.pesan.textContent = ''; return; }
    abort = new AbortController();
    const mine = abort;
    const r = await searchAddress(q, { signal: mine.signal });
    if (mine.signal.aborted) return; // stale
    row.pesan.textContent = r.ok ? (r.results.length ? '' : ERRORS.failed) : ERRORS[r.error];
    for (const place of r.ok ? r.results : []) {
      const item = document.createElement('li');
      const btn = Object.assign(document.createElement('button'), { type: 'button', textContent: place.label });
      btn.addEventListener('click', () => {
        const loc = { lat: place.lat, lon: place.lon };
        known.set(id, loc);
        row.input.value = place.label;
        row.saran.replaceChildren();
        setLokasiRumah(id, loc);
      });
      item.append(btn);
      row.saran.append(item);
    }
  }, DEBOUNCE_MS);
  row.input.addEventListener('input', () => { abort?.abort(); search(); });

  box.querySelector('.lokasi-saya').addEventListener('click', () => {
    row.pesan.textContent = '';
    if (!navigator.geolocation) { row.pesan.textContent = GEO_ERRORS[2]; return; }
    row.pesan.textContent = 'Mencari lokasi kamu…';
    navigator.geolocation.getCurrentPosition(
      (pos) => { row.pesan.textContent = ''; row.saran.replaceChildren(); setLokasiRumah(id, { lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      (err) => { row.pesan.textContent = GEO_ERRORS[err.code] ?? GEO_ERRORS[2]; },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
  rows.set(id, row);
  return row;
}

// A pin set by tap, drag or geolocation: look up its address (debounced, stale calls cancelled).
function reverse(id, loc) {
  clearTimeout(reverseTimers.get(id));
  reverseAborts.get(id)?.abort();
  reverseTimers.set(id, setTimeout(async () => {
    const abort = new AbortController();
    reverseAborts.set(id, abort);
    const r = await reverseAddress(loc, { signal: abort.signal });
    const row = rows.get(id);
    if (abort.signal.aborted || !row) return;
    row.input.value = r.ok ? r.label : '';
    row.pesan.textContent = r.ok ? '' : ERRORS[r.error];
    row.saran.replaceChildren();
  }, DEBOUNCE_MS));
}

onChange((state) => {
  for (const id of rows.keys()) {
    if (!state.peserta.some((p) => p.id === id)) { rows.delete(id); known.delete(id); reverseAborts.get(id)?.abort(); clearTimeout(reverseTimers.get(id)); }
  }
  state.peserta.forEach((p, i) => {
    const li = list.children[i];
    if (!li) return; // peserta.js has not drawn this row yet
    const row = rows.get(p.id) ?? addRow(p.id, li);
    row.input.setAttribute('aria-label', `Alamat ${namaPeserta(p.name, i)}`);
    if (p.lokasiRumah && !same(p.lokasiRumah, known.get(p.id))) {
      known.set(p.id, p.lokasiRumah);
      reverse(p.id, p.lokasiRumah);
    }
  });
});
