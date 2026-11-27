import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuery, cariTempat, cariTempatNongkrong } from '../src/data/overpass.js';
import { urutkanMenurutJarak, googleMapsUrl } from '../src/core.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const BLOK_M = { lat: -6.2443, lon: 106.7983 };

// Fake fetch: answers from `bodies` in order and records each decoded query.
function fakeFetch(...bodies) {
  const queries = [];
  const fn = async (url, init) => {
    queries.push(decodeURIComponent(init.body.replace(/^data=/, '')));
    return { ok: true, status: 200, json: async () => bodies[queries.length - 1] };
  };
  fn.queries = queries;
  fn.radii = () => queries.map((q) => Number(q.match(/around:(\d+)/)[1]) / 1000);
  return fn;
}
const status = (code) => async () => ({ ok: false, status: code, json: async () => ({}) });

test('parses nodes and ways (from center), drops unnamed Tempat Nongkrong', async () => {
  const result = await cariTempat(BLOK_M, 2, { fetch: fakeFetch(fixture('overpass-blok-m.json')) });
  assert.deepEqual(result, {
    ok: true,
    places: [
      { id: 'node/1001', name: 'Kopi Taman Literasi', lat: -6.2448, lon: 106.799, type: 'cafe' },
      { id: 'node/1002', name: 'Sate Blok M', lat: -6.2431, lon: 106.7975, type: 'restaurant' },
      { id: 'way/2001', name: 'Rumah Kopi Melawai', lat: -6.246, lon: 106.8001, type: 'cafe' },
    ],
  });
});

test('the query asks only for amenity=cafe and amenity=restaurant, with nwr and out center', () => {
  const query = buildQuery(BLOK_M, 2);
  assert.match(query, /nwr\(around:2000,-6\.2443,106\.7983\)/);
  assert.match(query, /\[amenity~"\^\(cafe\|restaurant\)\$"\]/);
  assert.match(query, /out center;/);
  assert.match(query, /\[timeout:\d+\]/);
  assert.doesNotMatch(query, /shop|mall/);
});

test('Radius Pencarian widens 2 → 5 → 10 km and then stops', async () => {
  const empty = fixture('overpass-empty.json');
  const fetch = fakeFetch(empty, empty, empty, fixture('overpass-blok-m.json'));
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch }), { ok: true, places: [], radiusKm: 10 });
  assert.deepEqual(fetch.radii(), [2, 5, 10]);
});

test('Radius Pencarian stops at the first radius with places', async () => {
  const fetch = fakeFetch(fixture('overpass-empty.json'), fixture('overpass-blok-m.json'));
  const result = await cariTempatNongkrong(BLOK_M, { fetch });
  assert.equal(result.radiusKm, 5);
  assert.equal(result.places.length, 3);
  assert.deepEqual(fetch.radii(), [2, 5]);
});

test('errors resolve to {ok: false, error} and stop the widening', async () => {
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: offline }), { ok: false, error: 'offline' });
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: status(429) }), { ok: false, error: 'busy' });
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: status(504) }), { ok: false, error: 'busy' });
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: status(502) }), { ok: false, error: 'busy' });
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: status(400) }), { ok: false, error: 'failed' });
  const badJson = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: badJson }), { ok: false, error: 'failed' });
  const stalled = async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); };
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: stalled }), { ok: false, error: 'busy' });
  assert.deepEqual(await cariTempat(BLOK_M, 2, { fetch: fakeFetch({ elements: [null] }) }), { ok: true, places: [] });
  const timedOut = fakeFetch(fixture('overpass-timeout.json'));
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: timedOut }), { ok: false, error: 'busy' });
  assert.equal(timedOut.queries.length, 1, 'a timed-out query must not count as empty and widen');
});

test('core: Tempat Nongkrong sorted nearest first, with jarakKm from the Titik Tengah', () => {
  const far = { name: 'Jauh', lat: -6.1754, lon: 106.8272 }; // Monas, ≈ 8.3 km
  const near = { name: 'Dekat', lat: -6.2448, lon: 106.799 };
  const sorted = urutkanMenurutJarak([far, near], BLOK_M);
  assert.deepEqual(sorted.map((p) => p.name), ['Dekat', 'Jauh']);
  assert.ok(sorted[0].jarakKm < 0.1);
  assert.ok(Math.abs(sorted[1].jarakKm - 8.3) < 0.05);
});

test('core: Google Maps link points at the place coordinates, without an API key', () => {
  assert.equal(googleMapsUrl({ lat: -6.2448, lon: 106.799 }), 'https://www.google.com/maps/search/?api=1&query=-6.2448,106.799');
});
