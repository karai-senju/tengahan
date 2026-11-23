// App state: the Peserta list, the selected Peserta and the Titik Tengah. No DOM.
// Features subscribe with onChange(listener); listeners get the current state
// right away and after every change. Treat the state as read-only.
import { MIN_PESERTA, canAddPeserta, canRemovePeserta, titikTengah } from './core.js';

export function createApp() {
  let nextId = 1;
  const newPeserta = () => ({ id: nextId++, name: '', lokasiRumah: null });
  const listeners = [];
  const state = {
    peserta: Array.from({ length: MIN_PESERTA }, newPeserta),
    selectedId: null,
    titikTengah: null,
  };

  function update(peserta, selectedId = state.selectedId) {
    state.peserta = peserta;
    state.selectedId = selectedId;
    state.titikTengah = titikTengah(peserta.map((p) => p.lokasiRumah).filter(Boolean));
    listeners.forEach((listener) => listener(state));
  }

  const patch = (id, fields) => state.peserta.map((p) => (p.id === id ? { ...p, ...fields } : p));

  function onChange(listener) {
    listeners.push(listener);
    listener(state);
  }

  function setLokasiRumah(id, lokasiRumah) {
    update(patch(id, { lokasiRumah }));
  }

  function addPeserta() {
    if (canAddPeserta(state.peserta.length)) update([...state.peserta, newPeserta()]);
  }

  function removePeserta(id) {
    if (!canRemovePeserta(state.peserta.length)) return;
    update(state.peserta.filter((p) => p.id !== id), state.selectedId === id ? null : state.selectedId);
  }

  function setName(id, name) {
    update(patch(id, { name }));
  }

  // Pick which Peserta the next map tap places; null clears the selection.
  function selectPeserta(id) {
    update(state.peserta, id);
  }

  // Map tap: fill the selected Peserta, otherwise the first one without a
  // Lokasi Rumah. Returns false (and changes nothing) when there is nobody to fill.
  function tapMap(lokasiRumah) {
    const id = state.selectedId ?? state.peserta.find((p) => !p.lokasiRumah)?.id;
    if (id == null) return false;
    update(patch(id, { lokasiRumah }), null);
    return true;
  }

  return { onChange, addPeserta, removePeserta, setName, setLokasiRumah, selectPeserta, tapMap };
}

export const { onChange, addPeserta, removePeserta, setName, setLokasiRumah, selectPeserta, tapMap } = createApp();
