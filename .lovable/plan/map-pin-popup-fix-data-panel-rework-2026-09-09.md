# Map pin popup fix + data panel rework

## 1. "Use this location?" popup only on a real click

Today any click the map registers opens the confirm bubble — including the small click that ends a pan, clicks on markers, zones and map controls — so it feels like it never goes away.

Changes in the map click handler:
- Ignore the click when the map was being dragged (track `dragstart`/`dragend`, and compare mouse-down and mouse-up screen position; more than a few pixels of movement = a pan, not a pick).
- Ignore clicks that land on a marker, a data zone, the popup itself, or the on-map buttons.
- Close the bubble automatically when the map is panned or zoomed, on Escape, and after Confirm/Cancel (already the case).
- Keep one bubble at a time.

## 2. Data panel tabs

Current tabs: Overview, Waves, Tides, SST, PFZ.
New tabs: Overview, Waves, Tides, SST, Chlorophyll, PFZ, Route.

**Waves** — remove the bottom "Wave & Swell Forecast (24h)" chart. Keep the wave-height graph and the 24-hour strip.

**SST** — stop using sample data. Read the live sea-temperature grid the app already fetches for the searched location and render the heat grid plus min/avg/max and the location name. Show a quiet "no data for this spot yet" state before a location is chosen.

**Chlorophyll (new)** — same treatment using the live chlorophyll grid: colour grid, legend in mg/m³, min/avg/max, and a one-line note on what high chlorophyll means for fishing.

**PFZ** — replace the hard-coded zone list with the live fishing zones for the current location: name, confidence, likely catch, distance and bearing from the searched point, sorted best-first. Clicking a zone centres the map on it.

**Route & Hazards (new)** — mirrors the on-map route card: destination zone, distance, bearing, speed, ETA, the advisory line, and the hazard list with severity colouring and distance along the route. Empty state invites the user to ask for a fishing route.

## 3. Motion, matching the existing language

Reuse the existing fade/slide utilities: tab content fades in, list rows and grid cells stagger in with a short delay, values count/transition on update, hazard dots pulse for danger. No new libraries.

## Technical notes

- `useMapSync` already publishes `pfz-layer`, `sst-layer`, `chl-layer` GeoJSON and a `route-layer`; `AppLayout` already holds `routeInfo`. Pass `layers` and `routeInfo` down into `DataContent` and derive each tab's view from those features instead of `mockSSTData` / the hard-coded zone array in `FishingZonePanel`.
- `SSTHeatmap` gains a shared grid renderer so chlorophyll can use the same component with its own colour scale and unit.
- `FishingZonePanel` takes zones as a prop, falling back to an empty state.
- New `RouteSection` component reuses the fields already on `FishingRoute`.
- Click-guard logic stays inside `MapClickHandler`; no changes to data fetching or the chat pipeline.
