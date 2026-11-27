// App state: the Peserta list, the selected Peserta and the Titik Tengah. No DOM.
// Features subscribe with onChange(listener); listeners get the current state
// right away and after every change. Treat the state as read-only.
import { FILTER_TYPE, bacaLinkBagikan, MIN_PESERTA, canAddPeserta, canRemovePeserta, titikTengah } from './core.js';

// `shared`: a decoded Link Bagikan ({titikTengah, filter}) starts a read-only view with no Peserta.
export function createApp(shared = null) {
  let nextId = 1;
  const newPeserta = () => ({ id: nextId++, name: '', lokasiRumah: null });
  const listeners = [];
  const state = {
    peserta: Array.from({ length: MIN_PESERTA }, newPeserta),
    selectedId: null,
    titikTengah: null,
    tapTargetId: null, // Peserta the next map tap fills, or null when nobody can be filled
    filter: 'semua', // Tempat Nongkrong filter: 'semua' | 'kafe' | 'restoran'
    tapMissed: false, // true right after a map tap that had nobody to fill
    readOnly: Boolean(shared), // Link Bagikan view: Titik Tengah and filter only, nothing can change it
  };

  function update(peserta, selectedId = state.selectedId, tapMissed = false) {
    if (state.readOnly) return;
    state.peserta = peserta;
    state.selectedId = selectedId;
    state.titikTengah = titikTengah(peserta.map((p) => p.lokasiRumah).filter(Boolean));
    state.tapTargetId = selectedId ?? peserta.find((p) => !p.lokasiRumah)?.id ?? null;
    state.tapMissed = tapMissed;
    listeners.forEach((listener) => listener(state));
  }
  update(state.peserta); // fill the derived fields; no listeners yet
  if (shared) Object.assign(state, { peserta: [], titikTengah: shared.titikTengah, filter: shared.filter });

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

  // Map tap: fill the tapTargetId Peserta. Returns false, changes no Peserta
  // and sets tapMissed when there is nobody to fill.
  function tapMap(lokasiRumah) {
    if (state.tapTargetId == null) {
      update(state.peserta, state.selectedId, true);
      return false;
    }
    update(patch(state.tapTargetId, { lokasiRumah }), null);
    return true;
  }

  function setFilter(filter) {
    if (!(filter in FILTER_TYPE) || filter === state.filter) return;
    state.filter = filter;
    listeners.forEach((listener) => listener(state));
  }

  return { onChange, setFilter, addPeserta, removePeserta, setName, setLokasiRumah, selectPeserta, tapMap };
}

// The page's own state: a valid Link Bagikan in the URL hash opens read-only.
const link = bacaLinkBagikan(globalThis.location?.hash);
export const linkRusak = link?.ok === false;
export const { onChange, setFilter, addPeserta, removePeserta, setName, setLokasiRumah, selectPeserta, tapMap } = createApp(link?.ok ? link : null);
