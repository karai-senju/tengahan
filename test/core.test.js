import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titikTengah, haversineKm, canAddPeserta, canRemovePeserta, namaPeserta } from '../src/core.js';

test('Titik Tengah of 2 Lokasi Rumah is the average of their lat and lon', () => {
  const tt = titikTengah([{ lat: -6.1, lon: 106.8 }, { lat: -6.3, lon: 106.9 }]);
  assert.ok(Math.abs(tt.lat - -6.2) < 1e-9);
  assert.ok(Math.abs(tt.lon - 106.85) < 1e-9);
});

test('Titik Tengah of 5 Lokasi Rumah is the average of their lat and lon', () => {
  const tt = titikTengah([
    { lat: -6.0, lon: 106.0 },
    { lat: -6.1, lon: 106.5 },
    { lat: -6.2, lon: 107.0 },
    { lat: -6.3, lon: 106.5 },
    { lat: -6.4, lon: 106.5 },
  ]);
  assert.ok(Math.abs(tt.lat - -6.2) < 1e-9);
  assert.ok(Math.abs(tt.lon - 106.5) < 1e-9);
});

test('there is no Titik Tengah with fewer than 2 Lokasi Rumah', () => {
  assert.equal(titikTengah([]), null);
  assert.equal(titikTengah([{ lat: -6.2, lon: 106.8 }]), null);
});

test('haversine distance from Monas to Blok M is about 8.30 km', () => {
  const monas = { lat: -6.1754, lon: 106.8272 };
  const blokM = { lat: -6.2443, lon: 106.7983 };
  assert.ok(Math.abs(haversineKm(monas, blokM) - 8.3) <= 0.05);
  assert.ok(Math.abs(haversineKm(blokM, monas) - 8.3) <= 0.05);
});

test('a Peserta can be added while there are fewer than 5', () => {
  assert.equal(canAddPeserta(2), true);
  assert.equal(canAddPeserta(4), true);
  assert.equal(canAddPeserta(5), false);
});

test('a Peserta can be removed only while there are more than 2', () => {
  assert.equal(canRemovePeserta(2), false);
  assert.equal(canRemovePeserta(3), true);
  assert.equal(canRemovePeserta(5), true);
});

test('a Peserta without a name is shown as "Orang N" by 1-based position', () => {
  assert.equal(namaPeserta('', 0), 'Orang 1');
  assert.equal(namaPeserta('   ', 4), 'Orang 5');
  assert.equal(namaPeserta(undefined, 1), 'Orang 2');
});

test('a Peserta with a name is shown by that name, trimmed', () => {
  assert.equal(namaPeserta('  Budi ', 2), 'Budi');
});
