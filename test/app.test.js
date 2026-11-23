import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

// Subscribes and returns a getter for the latest state seen by onChange.
function watch(app) {
  let latest;
  app.onChange((state) => { latest = state; });
  return () => latest;
}

test('starts with 2 Peserta without Lokasi Rumah and no Titik Tengah', () => {
  const state = watch(createApp());
  assert.equal(state().peserta.length, 2);
  assert.ok(state().peserta.every((p) => p.name === '' && p.lokasiRumah === null));
  assert.equal(state().titikTengah, null);
});

test('tapping the map fills the first Peserta without Lokasi Rumah, and 2 Lokasi Rumah give a Titik Tengah', () => {
  const app = createApp();
  const state = watch(app);
  assert.equal(app.tapMap({ lat: -6.1, lon: 106.8 }), true);
  assert.deepEqual(state().peserta[0].lokasiRumah, { lat: -6.1, lon: 106.8 });
  assert.equal(state().titikTengah, null);
  assert.equal(app.tapMap({ lat: -6.3, lon: 106.8 }), true);
  assert.deepEqual(state().peserta[1].lokasiRumah, { lat: -6.3, lon: 106.8 });
  assert.ok(Math.abs(state().titikTengah.lat - -6.2) < 1e-9);
});

test('tapping the map fills the selected Peserta, then clears the selection', () => {
  const app = createApp();
  const state = watch(app);
  const second = state().peserta[1].id;
  app.selectPeserta(second);
  assert.equal(state().selectedId, second);
  app.tapMap({ lat: -6.3, lon: 106.9 });
  assert.equal(state().peserta[0].lokasiRumah, null);
  assert.deepEqual(state().peserta[1].lokasiRumah, { lat: -6.3, lon: 106.9 });
  assert.equal(state().selectedId, null);
});

test('when every Peserta has a Lokasi Rumah and none is selected, a tap changes nothing', () => {
  const app = createApp();
  const state = watch(app);
  app.tapMap({ lat: -6.1, lon: 106.8 });
  app.tapMap({ lat: -6.3, lon: 106.8 });
  const before = state().peserta;
  assert.equal(app.tapMap({ lat: -6.5, lon: 106.5 }), false);
  assert.deepEqual(state().peserta, before);
});

test('Peserta can be added up to 5 and removed down to 2', () => {
  const app = createApp();
  const state = watch(app);
  for (let i = 0; i < 5; i++) app.addPeserta();
  assert.equal(state().peserta.length, 5);
  for (const p of [...state().peserta]) app.removePeserta(p.id);
  assert.equal(state().peserta.length, 2);
});

test('removing a Peserta moves the Titik Tengah, and it disappears below 2 Lokasi Rumah', () => {
  const app = createApp();
  const state = watch(app);
  app.addPeserta();
  app.tapMap({ lat: -6.0, lon: 106.8 });
  app.tapMap({ lat: -6.2, lon: 106.8 });
  app.tapMap({ lat: -6.4, lon: 106.8 });
  assert.ok(Math.abs(state().titikTengah.lat - -6.2) < 1e-9);
  app.removePeserta(state().peserta[2].id);
  assert.ok(Math.abs(state().titikTengah.lat - -6.1) < 1e-9);
  app.setLokasiRumah(state().peserta[1].id, null);
  assert.equal(state().titikTengah, null);
});

test('typing a name sets the Peserta name', () => {
  const app = createApp();
  const state = watch(app);
  app.setName(state().peserta[0].id, 'Budi');
  assert.equal(state().peserta[0].name, 'Budi');
});
