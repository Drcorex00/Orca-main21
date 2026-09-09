# Leaflet map, Indian Ocean layers, and answers in the fisherman's own language

Three changes: rebuild the map on Leaflet, put live fishing-zone / chlorophyll / sea-temperature / restricted-area layers on it, and make ORCA reply in whatever language the question was asked in.

## 1. Map rebuilt on Leaflet

Replace the current map with Leaflet (`react-leaflet`), keeping everything that works today:

- Satellite imagery base with place labels on top, and a plain ocean base as an alternative.
- The pulsing pin and smooth fly-to when a place is resolved from a question.
- Cursor coordinates, scale bar, zoom buttons, attribution.
- The existing layer switch panel, extended with the new layers.
- Tap anywhere on the sea to load readings for that point.

## 2. Live Indian Ocean layers

Four switchable layers, all centred on the area the question is about:

**Fishing zones (PFZ)**
India's official PFZ bulletins (INCOIS) are published as daily maps and text, not as an open data feed, so the app computes its own zones from live sea-surface temperature, chlorophyll and wave data on a grid around the location — warm-cold boundaries plus chlorophyll fronts are what PFZ advisories are based on. Zones are shaded by confidence and open a card with temperature, chlorophyll, wave height and likely species. Every zone card states plainly that the official bulletin comes from INCOIS.

**Chlorophyll**
Live chlorophyll-a from NASA Ocean Color (ERDDAP), drawn as a coloured grid over the sea. Higher chlorophyll means more plankton and usually more fish.

**Sea surface temperature**
Live sea temperature drawn as a coloured grid over the same area, sourced from the marine forecast feed already in use, with NOAA/NASA satellite SST as the fallback when the forecast feed has gaps.

**Restricted areas**
Static reference outlines, drawn from published coordinates and labelled as reference only:
- India's territorial waters (12 nautical miles) and contiguous zone (24 nm) along the coast.
- The India-Sri Lanka maritime boundary line.
- Harbour approach zones and known marine parks / no-fishing patches (Gulf of Mannar, Gulf of Kachchh, Malvan, Sundarbans and similar).
Crossing lines are drawn in a warning tone with a tap-for-detail label.

Layers refresh whenever a new location is resolved, and each keeps its on/off state across refreshes. When a source is unreachable the layer switch shows "unavailable" rather than empty sea.

## 3. Answers in the language of the question

The question's language is detected — including Hindi, Marathi, Tamil, Malayalam, Telugu, Kannada, Bengali, Gujarati, Odia, and the same written in Roman letters (Hinglish) — and the answer comes back in that same language and script, using everyday fishing words rather than technical vocabulary. "Kal samudra me jana theek hai macchi pakad ne" gets a Hindi answer.

The readings table stays, with its row labels translated too, and units kept in the form fishermen use. Safety warnings are always repeated in the user's language. English is the fallback when the language is unclear.

## Technical notes

- Add `react-leaflet` + `leaflet`; remove `maplibre-gl` / `react-map-gl` usage from `MapPanel.tsx`. Map components render client-side only (dynamic import behind the existing lazy boundary) so Leaflet never runs during server render.
- New server function `getOceanLayers({ lat, lon })` in `src/lib/orca.functions.ts`, backed by `src/lib/orca.server.ts`: samples a grid (about 7x7 points) around the location via Open-Meteo Marine for SST/waves, fetches chlorophyll-a from the NOAA CoastWatch/NASA ERDDAP griddap endpoint, and returns GeoJSON for `sst`, `chlorophyll` and computed `pfz` polygons plus a `sources` list. Reuses the existing cached `getJson` helper with its retry and stale-serve behaviour.
- PFZ scoring: normalised SST-gradient + chlorophyll-gradient + chlorophyll level, penalised by wave height; contiguous high-score cells merge into polygons with a confidence value.
- Restricted areas ship as a static GeoJSON file in `src/data/` (buffered coastline offsets for 12/24 nm, boundary line, named polygons) — no network call.
- `useMapSync.applyLiveLayers` is replaced by consuming `getOceanLayers` through TanStack Query keyed on rounded coordinates, preserving per-layer visibility.
- Language: the chat system prompt in `src/routes/api/chat.ts` gains a rule to detect and mirror the user's language and script, use plain fishing vocabulary, and translate the readings table headers and safety line. No separate translation service.
