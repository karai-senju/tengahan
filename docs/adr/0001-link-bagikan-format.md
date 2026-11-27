# Link Bagikan format

A Link Bagikan is the page address plus a hash: `https://…/tengahan/#v=1&t=-6.20881,106.84568&f=kafe`.

- **Contents**: `v` (format version, always `1`), `t` (Titik Tengah as `lat,lon`) and `f` (the filter: `semua`, `kafe` or `restoran`). Nothing else.
- **Never** a Lokasi Rumah or a Peserta name, by the owner's decision: a link gets forwarded, and homes must not spread with it. `buatLinkBagikan` only receives the Titik Tengah and the filter, and a *core* test asserts no home coordinate or name appears in a link.
- **Rounding**: coordinates are rounded to 5 decimals (about 1 m). That is exact enough for a meeting point and keeps the link short. A Titik Tengah is an average, so it does not reveal the homes it came from.
- **Hash, not query**: the hash is never sent to the server, so the point stays out of server and proxy logs, and the static site needs no routing.
- **Stable**: links already pasted in WhatsApp must keep working. Never change the meaning of `v=1`, `t` or `f`. A new format gets a new `v`, and the reader keeps understanding the old ones. An unknown filter falls back to `semua`; a malformed link opens the normal page with a short message.
