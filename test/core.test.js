import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buatLinkBagikan, bacaLinkBagikan, titikTengah, haversineKm, canAddPeserta, canRemovePeserta, namaPeserta, waktuTempuhMenit, teksWaktuTempuh, filterTempat, ROAD_FACTOR, SPEED_KMH } from '../src/core.js';

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

test('Perkiraan Waktu Tempuh is distance x road factor / speed, in whole minutes', () => {
  const monas = { lat: -6.1754, lon: 106.8272 };
  const blokM = { lat: -6.2443, lon: 106.7983 };
  // 8.30 km x 1.4 / 20 km/h = 34.8 min
  assert.equal(waktuTempuhMenit(monas, blokM), 35);
  assert.equal(waktuTempuhMenit(monas, monas), 0);
  assert.equal(ROAD_FACTOR, 1.4);
  assert.equal(SPEED_KMH, 20);
});

test('Perkiraan Waktu Tempuh rounds to the nearest minute', () => {
  const a = { lat: 0, lon: 0 };
  // 1 km straight = 1.4 / 20 h = 4.2 min -> 4; 1.2 km = 5.04 -> 5
  const east = (km) => ({ lat: 0, lon: km / 111.195 });
  assert.equal(waktuTempuhMenit(a, east(1)), 4);
  assert.equal(waktuTempuhMenit(a, east(1.2)), 5);
});

test('filterTempat keeps all, only cafes, or only restaurants', () => {
  const places = [{ id: 1, type: 'cafe' }, { id: 2, type: 'restaurant' }, { id: 3, type: 'cafe' }];
  assert.deepEqual(filterTempat(places, 'semua').map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(filterTempat(places, 'kafe').map((p) => p.id), [1, 3]);
  assert.deepEqual(filterTempat(places, 'restoran').map((p) => p.id), [2]);
});

test('teksWaktuTempuh shows "< 1 menit" for 0 and "± N menit" otherwise', () => {
  assert.equal(teksWaktuTempuh(0), '< 1 menit');
  assert.equal(teksWaktuTempuh(1), '± 1 menit');
  assert.equal(teksWaktuTempuh(35), '± 35 menit');
});

const BASE = 'https://karai-senju.github.io/tengahan/';

test('Link Bagikan round-trips the Titik Tengah (5 decimals) and the filter', () => {
  const link = buatLinkBagikan(BASE, { lat: -6.2088123456, lon: 106.8456789 }, 'kafe');
  assert.equal(link, `${BASE}#v=1&t=-6.20881,106.84568&f=kafe`);
  assert.deepEqual(bacaLinkBagikan(new URL(link).hash), { ok: true, titikTengah: { lat: -6.20881, lon: 106.84568 }, filter: 'kafe' });
});

test('buatLinkBagikan replaces an old hash and falls back to "semua" for an unknown filter', () => {
  assert.equal(buatLinkBagikan(`${BASE}#v=1&t=1,2&f=kafe`, { lat: 1, lon: 2 }, 'mall'), `${BASE}#v=1&t=1.00000,2.00000&f=semua`);
});

test('a Link Bagikan never contains a Lokasi Rumah coordinate or a Peserta name', () => {
  const peserta = [
    { name: 'Budi', lokasiRumah: { lat: -6.1111111, lon: 106.7222222 } },
    { name: 'Sari', lokasiRumah: { lat: -6.3333333, lon: 106.9444444 } },
  ];
  const link = buatLinkBagikan(BASE, titikTengah(peserta.map((p) => p.lokasiRumah)), 'semua');
  for (const { name, lokasiRumah } of peserta) {
    assert.ok(!link.includes(name));
    for (const v of [lokasiRumah.lat, lokasiRumah.lon]) {
      assert.ok(!link.includes(String(v)) && !link.includes(v.toFixed(5)) && !link.includes(v.toFixed(2)));
    }
  }
});

test('bacaLinkBagikan: empty hash is null, a lost filter becomes "semua", malformed links are not ok', () => {
  assert.equal(bacaLinkBagikan(''), null);
  assert.equal(bacaLinkBagikan('#'), null);
  assert.equal(bacaLinkBagikan('#v=1&t=-6.2,106.8').filter, 'semua');
  for (const bad of ['#abc', '#v=2&t=-6.2,106.8&f=kafe', '#v=1&t=-6.2&f=kafe', '#v=1&t=abc,def', '#v=1&t=91,106.8', '#v=1&t=-6.2,181', '#v=1&t=1e2,3', '#v=1']) {
    assert.deepEqual(bacaLinkBagikan(bad), { ok: false }, bad);
  }
});
