# Run ORCA locally, fix satellite view, add safe routing

## 1. Keys you need for a local run

Only one key is needed: an AI key for the chat brain. Everything else (sea state, waves, wind, tides, chlorophyll, place search, map tiles) is open and keyless.

- **AI chat** — the app reads `LOVABLE_API_KEY`. For a laptop demo, copy the key from this project's settings into a local `.env` file, or paste an OpenAI/Gemini key instead (see below).
- Nothing else to buy or sign up for.

Work to do:
- Add `.env.example` listing `LOVABLE_API_KEY` (and optional `OPENAI_API_KEY` / `GEMINI_API_KEY` fallback).
- Let the chat route accept any one of those three keys, so an evaluator can run it with whatever key they have.
- Add a short `README-local.md`: install, add key, `bun run dev`, open localhost.
- Make the app show a clear "AI key missing" message instead of a broken screen, while maps and live sea data keep working.

## 2. Satellite view asking for a key

The satellite layer currently pulls Esri imagery, which now rejects some anonymous requests, so tiles fail or prompt for a token.

Fix:
- Switch the satellite base to keyless Esri World Imagery served through their public basemap path, with an automatic fallback to a second free imagery source if tiles fail to load.
- Keep the labels overlay and the plain ocean view as they are.
- Optional: if `VITE_MAPTILER_KEY` is present, use MapTiler satellite for sharper imagery — purely optional, app works without it.
- Show a small "imagery unavailable, showing ocean view" note instead of a grey map if both sources fail.

## 3. Route to the fishing zone, with hazard alerts

When a fishing-zone question is answered:
- Draw a sea route from the current/asked location to the chosen fishing zone: a straight leg, bent around land and around restricted areas (12/24 nm limits, harbour zones, marine parks, the India–Sri Lanka line) so it stays on water and legal.
- Show distance in nautical miles, bearing, and estimated travel time at a typical trawler speed (adjustable).
- Sample live weather along the route (waves, wind, gusts, lightning/thunderstorm probability, visibility, precipitation) at points every few nautical miles.
- Mark any risky stretch in red on the map with a hazard pin, and list it in the chat: e.g. "lightning risk 60% around 14 nm out", "waves 3.1 m near the zone", "gusts 55 km/h".
- If a leg is unsafe, propose a later departure window or a nearer alternate zone.
- Add a "Route" toggle in the layer panel; tapping a zone card recomputes the route.
- Chat presets get "Best route to the nearest fishing zone".

## Technical notes

- Route hazards use Open-Meteo Marine + Forecast (wave height, wind, gusts, CAPE/thunderstorm probability, visibility) sampled at waypoints, batched in one call per leg group.
- Land/exclusion avoidance: coarse grid over the bounding box, cells marked blocked by the existing restricted-area polygons and a coastline check, A* over open-water cells, then path smoothing — no external routing service, no key.
- Route state lives in `useMapSync` alongside ocean layers; drawn as a GeoJSON LineString plus hazard markers in `MarineOverlays`.
- Route summary is injected into the chat's LIVE DATA block so ORCA describes it in the user's own language.
