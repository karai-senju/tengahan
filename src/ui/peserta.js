// Peserta form: one row per Peserta, "Tambah orang" and the hint line.
import { onChange, addPeserta, removePeserta, setName, selectPeserta } from '../app.js';
import { canAddPeserta, canRemovePeserta, namaPeserta } from '../core.js';

const list = document.getElementById('peserta-list');
const tambah = document.getElementById('tambah-orang');
const hint = document.getElementById('hint');
const rows = new Map(); // Peserta id -> row elements
let selectedId = null;

tambah.addEventListener('click', addPeserta);

function addRow(id) {
  const li = document.createElement('li');
  li.className = 'peserta';
  li.innerHTML = `
    <button class="pilih" type="button" aria-pressed="false">Pilih</button>
    <div class="info">
      <input type="text" maxlength="40" autocomplete="off">
      <span class="status"></span>
    </div>
    <button class="hapus" type="button">✕</button>`;
  const row = {
    li,
    pilih: li.querySelector('.pilih'),
    input: li.querySelector('input'),
    status: li.querySelector('.status'),
    hapus: li.querySelector('.hapus'),
  };
  row.pilih.addEventListener('click', () => selectPeserta(selectedId === id ? null : id));
  row.input.addEventListener('input', () => setName(id, row.input.value));
  row.hapus.addEventListener('click', () => removePeserta(id));
  rows.set(id, row);
  return row;
}

onChange((state) => {
  selectedId = state.selectedId;
  const count = state.peserta.length;
  for (const [id, row] of rows) {
    if (!state.peserta.some((p) => p.id === id)) { row.li.remove(); rows.delete(id); }
  }
  state.peserta.forEach((p, i) => {
    const row = rows.get(p.id) ?? addRow(p.id);
    // Only move rows that are out of place, so a focused name field keeps focus.
    if (list.children[i] !== row.li) list.insertBefore(row.li, list.children[i] ?? null);
    const nama = namaPeserta(p.name, i);
    const selected = state.selectedId === p.id;
    row.li.classList.toggle('selected', selected);
    row.pilih.setAttribute('aria-pressed', String(selected));
    row.pilih.textContent = selected ? 'Dipilih' : 'Pilih';
    row.pilih.setAttribute('aria-label', `Pilih ${nama} untuk ditaruh di peta`);
    row.input.placeholder = `${namaPeserta('', i)} (opsional)`;
    row.input.setAttribute('aria-label', `Nama ${namaPeserta('', i)} (opsional)`);
    if (row.input.value !== p.name) row.input.value = p.name;
    row.status.textContent = p.lokasiRumah ? 'Lokasi Rumah sudah dipasang' : 'Belum ada Lokasi Rumah';
    row.hapus.disabled = !canRemovePeserta(count);
    row.hapus.setAttribute('aria-label', `Hapus ${nama}`);
  });
  tambah.disabled = !canAddPeserta(count);

  const targetIndex = state.peserta.findIndex((p) => p.id === state.tapTargetId);
  hint.classList.remove('attention');
  if (state.tapMissed) {
    hint.textContent = 'Semua Peserta sudah punya Lokasi Rumah. Tekan "Pilih" pada salah satu Peserta dulu, lalu ketuk peta.';
    void hint.offsetWidth; // restart the CSS animation
    hint.classList.add('attention');
  } else {
    hint.textContent = targetIndex >= 0
      ? `Ketuk peta untuk menaruh Lokasi Rumah ${namaPeserta(state.peserta[targetIndex].name, targetIndex)}.`
      : 'Geser pin untuk memindah Lokasi Rumah, atau tekan "Pilih" lalu ketuk peta.';
  }
});
