// Bagikan button (normal page) and the read-only Link Bagikan view.
import { onChange, linkRusak } from '../app.js';
import { buatLinkBagikan } from '../core.js';

const places = document.getElementById('places');
const box = Object.assign(document.createElement('section'), { id: 'bagikan', ariaLabel: 'Bagikan' });
box.innerHTML = `
  <button class="bagikan-tombol" type="button" hidden>Bagikan</button>
  <p class="bagikan-info" role="status" aria-live="polite"></p>
  <input class="bagikan-link" type="text" readonly hidden aria-label="Link Bagikan, salin dengan tekan lama">`;
places.before(box);
const tombol = box.querySelector('.bagikan-tombol');
const info = box.querySelector('.bagikan-info');
const field = box.querySelector('.bagikan-link');

let state;
const tampilkan = (teks) => { info.textContent = teks; };

async function bagikan() {
  const link = buatLinkBagikan(location.href, state.titikTengah, state.filter);
  field.hidden = true;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Tengahan', text: 'Titik tengah dan tempat nongkrong kita:', url: link });
      return tampilkan('Link dibagikan');
    }
    await navigator.clipboard.writeText(link);
    return tampilkan('Link disalin');
  } catch (e) {
    if (e?.name === 'AbortError') return; // the person closed the share sheet
  }
  // No share and no clipboard: show the link to copy by hand.
  field.value = link;
  field.hidden = false;
  field.select();
  tampilkan('Salin link ini lalu tempel di grup WhatsApp.');
}
tombol.addEventListener('click', bagikan);

if (linkRusak) {
  history.replaceState(null, '', location.pathname + location.search);
  tampilkan('Link Bagikan tidak bisa dibuka (rusak atau terpotong). Kamu bisa membuat tengahan sendiri di bawah.');
}

onChange((next) => {
  state = next;
  if (next.readOnly) return;
  tombol.hidden = !next.titikTengah;
  if (!next.titikTengah) { field.hidden = true; tampilkan(''); }
});

if (state.readOnly) {
  document.body.classList.add('readonly');
  tombol.textContent = 'Buat tengahan sendiri';
  tombol.hidden = false;
  tombol.removeEventListener('click', bagikan);
  tombol.addEventListener('click', () => { // dropping only the hash is no page load, so reload for fresh state
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  });
  tampilkan('Ini Titik Tengah dari Link Bagikan. Lokasi Rumah tidak ikut dibagikan.');
}
