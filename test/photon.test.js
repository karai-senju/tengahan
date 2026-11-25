import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchAddress, reverseAddress } from '../src/data/photon.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const status = (code) => async () => ({ ok: false, status: code, json: async () => ({}) });

test('searchAddress sends a Jakarta-biased request and parses places', async () => {
  let url;
  const r = await searchAddress('Kemang Raya', { fetch: async (u) => { url = new URL(u); return ok(fixture('photon-search.json'))(); } });
  assert.equal(url.searchParams.get('q'), 'Kemang Raya');
  assert.equal(url.searchParams.get('limit'), '5');
  assert.equal(url.searchParams.get('location_bias_scale'), '0.1');
  assert.ok(Math.abs(url.searchParams.get('lat') - -6.2) < 0.1);
  assert.ok(Math.abs(url.searchParams.get('lon') - 106.8) < 0.1);
  assert.equal(r.ok, true);
  assert.deepEqual(r.results[0], {
    label: 'Kemang Raya, Jalan Kemang Raya, Bangka, Jakarta Selatan, Daerah Khusus Ibukota Jakarta',
    lat: -6.2615,
    lon: 106.8133,
  });
  assert.equal(r.results.length, 2); // the feature without a name or address is dropped
});

test('reverseAddress returns a label for the point', async () => {
  let url;
  const r = await reverseAddress({ lat: -6.1754, lon: 106.8272 }, { fetch: async (u) => { url = new URL(u); return ok(fixture('photon-reverse.json'))(); } });
  assert.equal(url.pathname, '/reverse');
  assert.equal(url.searchParams.get('lat'), '-6.1754');
  assert.deepEqual(r, { ok: true, label: 'Jalan Medan Merdeka Barat 12, Gambir, Jakarta Pusat' });
});

test('errors resolve to {ok: false, error} and never throw', async () => {
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await searchAddress('x', { fetch: offline }), { ok: false, error: 'offline' });
  assert.deepEqual(await searchAddress('x', { fetch: status(429) }), { ok: false, error: 'busy' });
  assert.deepEqual(await searchAddress('x', { fetch: status(503) }), { ok: false, error: 'busy' });
  assert.deepEqual(await searchAddress('x', { fetch: status(400) }), { ok: false, error: 'failed' });
  assert.deepEqual(await reverseAddress({ lat: 0, lon: 0 }, { fetch: ok({ features: [] }) }), { ok: false, error: 'failed' });
  assert.deepEqual(await reverseAddress({ lat: 0, lon: 0 }, { fetch: offline }), { ok: false, error: 'offline' });
});
