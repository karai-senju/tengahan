import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OVERPASS_INSTANCES, buildQuery, cariTempat, cariTempatNongkrong } from '../src/data/overpass.js';
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
  const timedOut = fakeFetch(...OVERPASS_INSTANCES.map(() => fixture('overpass-timeout.json')));
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch: timedOut }), { ok: false, error: 'busy' });
  assert.equal(new Set(timedOut.radii()).size, 1, 'a timed-out query must not count as empty and widen');
});

// Fake fetch per instance: `handlers[i]` answers the i-th OVERPASS_INSTANCES url.
// Records call order and asserts no two requests overlap.
function perInstance(...handlers) {
  const calls = [];
  let busy = false;
  const fn = async (url) => {
    assert.ok(!busy, 'requests must be sequential');
    busy = true;
    calls.push(OVERPASS_INSTANCES.indexOf(url));
    await new Promise((r) => setImmediate(r));
    busy = false;
    return handlers[OVERPASS_INSTANCES.indexOf(url)]();
  };
  fn.calls = calls;
  return fn;
}
const ok = (name) => async () => ({ ok: true, status: 200, json: async () => fixture(name) });
const down = async () => { throw new TypeError('Failed to fetch'); };
// Makes instance 0 the remembered one (it answers; others 502).
const resetKeInstansiUtama = () => cariTempat(BLOK_M, 2, { fetch: perInstance(ok('overpass-blok-m.json'), status(502)) });

test('busy instance hands over to the next one', async () => {
  await resetKeInstansiUtama();
  const fetch = perInstance(status(502), ok('overpass-blok-m.json'));
  const result = await cariTempatNongkrong(BLOK_M, { fetch });
  assert.equal(result.ok, true);
  assert.equal(result.places.length, 3);
  assert.equal(result.radiusKm, 2);
  assert.deepEqual(fetch.calls, [0, 1]);
});

test('every instance busy → busy, one after another, worst case under 45 s', async () => {
  await resetKeInstansiUtama();
  const fetch = perInstance(status(504), status(429));
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch }), { ok: false, error: 'busy' });
  assert.deepEqual(fetch.calls, [0, 1]);
  const timeout = Number(readFileSync(new URL('../src/data/overpass.js', import.meta.url), 'utf8').match(/TIMEOUT_MS = (\d+)/)[1]);
  assert.ok(timeout * OVERPASS_INSTANCES.length < 45000);
});

test('failed (bad data) does not try further instances', async () => {
  await resetKeInstansiUtama();
  const fetch = perInstance(async () => ({ ok: true, status: 200, json: async () => ({}) }), ok('overpass-blok-m.json'));
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch }), { ok: false, error: 'failed' });
  assert.deepEqual(fetch.calls, [0]);
});

test('offline tries one more instance only, then gives up', async () => {
  await resetKeInstansiUtama();
  const fetch = perInstance(down, down);
  assert.deepEqual(await cariTempatNongkrong(BLOK_M, { fetch }), { ok: false, error: 'offline' });
  assert.deepEqual(fetch.calls, [0, 1]);
});

test('the instance that answered last is tried first next time', async () => {
  await resetKeInstansiUtama();
  await cariTempat(BLOK_M, 2, { fetch: perInstance(status(502), ok('overpass-blok-m.json')) });
  const fetch = perInstance(ok('overpass-blok-m.json'), ok('overpass-blok-m.json'));
  await cariTempat(BLOK_M, 2, { fetch });
  assert.deepEqual(fetch.calls, [1]);
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
