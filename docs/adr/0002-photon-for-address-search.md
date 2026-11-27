# Photon, not Nominatim, for address search

Address suggestions while typing and reverse lookup use Photon (photon.komoot.io, OSM data). Nominatim's usage policy forbids client-side autocomplete, and Tengahan has no backend to proxy it. Photon accepts a `lat`/`lon` bias, which we point at Jakarta. Typing is debounced (400 ms) and stale requests are aborted to stay within fair use. Upgrade path if traffic grows: a self-hosted Photon.
