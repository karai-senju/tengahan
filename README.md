# Tengahan

Find the Titik Tengah of every Peserta's Lokasi Rumah and hang out near it. A static site: plain HTML, CSS and JavaScript ES modules, with no build step and no dependencies. Terms are defined in [GLOSSARY.md](GLOSSARY.md).

## Run locally

```sh
python3 -m http.server --bind 127.0.0.1 8000
```

Then open http://127.0.0.1:8000/. Always bind to `127.0.0.1`, never `0.0.0.0`. The page has to be served over HTTP, because ES modules don't load from `file://`.

## Test

```sh
npm test
```

This runs Node's built-in `node --test` (Node 18 or newer). It needs no `npm install`.

## Link Bagikan

The "Bagikan" button (shown once there is a Titik Tengah) shares or copies a link such as `…/tengahan/#v=1&t=-6.20881,106.84568&f=kafe`. It holds only the Titik Tengah and the filter, never a Lokasi Rumah or a Peserta name. Opening it shows a read-only view, and "Buat tengahan sendiri" goes back to the normal page. Format and rules: [docs/adr/0001-link-bagikan-format.md](docs/adr/0001-link-bagikan-format.md).

## Public address and deployment

- Public address: https://karai-senju.github.io/tengahan/
- Deployment: GitHub Pages, "Deploy from a branch", source `main` branch, `/` (root) folder. The empty `.nojekyll` file at the root tells Pages to skip Jekyll. Every merge to `main` republishes the site, which may take a minute.
- CI: the workflow `.github/workflows/ci.yml` runs `npm test` on every pull request.

## Layout

- `index.html` loads Leaflet from a CDN (pinned version with SRI) and one `<script type="module">` per feature. Asset paths are relative, so the site also works under `/tengahan/` on GitHub Pages.
- `src/core.js` holds pure functions with no DOM, no network and no Leaflet: Titik Tengah, haversine distance, Peserta-count rules, default names and Link Bagikan encode/decode.
- `src/app.js` holds app state (`peserta`, `selectedId`, `titikTengah`, plus `tapTargetId` for the Peserta the next map tap fills and `tapMissed` after a tap that had nobody to fill). `onChange(listener)` calls the listener right away and after every change.
- `src/ui/*.js` is DOM and Leaflet wiring only. To add a feature, add a new module that subscribes with `onChange`, plus one script line in `index.html`.
- `src/data/*.js` (added in later tickets) has one file per external service, each taking an injectable `fetch`. These functions never throw. They resolve to `{ok: true, ...}` or `{ok: false, error: 'offline' | 'busy' | 'failed'}`.
- `test/*.test.js` holds the tests, with saved sample responses in `test/fixtures/` (added in later tickets).
