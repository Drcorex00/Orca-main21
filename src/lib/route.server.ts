// Sea-route planning between two points, using only free, keyless sources.
//
// Water test + waves : Open-Meteo Marine (multi-point) — land points return no data
// Hazards            : Open-Meteo Forecast (wind, gusts, visibility, rain, weather code)
// Exclusions         : published restricted areas (harbour approaches, marine parks, IMBL)

import type { Feature, FeatureCollection, Position } from "geojson";
import { restrictedAreas } from "../data/restrictedAreas";

export interface RouteHazard {
  lat: number;
  lon: number;
  atNm: number;
  kind: "lightning" | "waves" | "wind" | "visibility" | "rain";
  severity: "warning" | "danger";
  message: string;
}

export interface RoutePlan {
  from: { lat: number; lon: number; name?: string };
  to: { lat: number; lon: number; name?: string };
  distanceNm: number;
  bearingDeg: number;
  speedKn: number;
  etaHours: number;
  waypoints: { lat: number; lon: number }[];
  hazards: RouteHazard[];
  advisory: string;
  clearOfRestrictedAreas: boolean;
  geojson: FeatureCollection;
  sources: string[];
  fetchedAt: string;
}

const GRID = 9; // GRID x GRID sample points (<= 81 locations per Open-Meteo call)
const PAD = 0.3; // degrees of padding around the direct line
const DEFAULT_SPEED_KN = 8;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 3440.065; // earth radius in nautical miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassPoint(deg: number) {
  const pts = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return pts[Math.round(deg / 22.5) % 16]!;
}

function pointInRing(lon: number, lat: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(p1: Position, p2: Position, p3: Position, p4: Position) {
  const d = (a: Position, b: Position, c: Position) =>
    (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

interface Exclusions {
  polygons: { name: string; ring: Position[] }[];
  barriers: { name: string; line: Position[] }[];
}

function buildExclusions(): Exclusions {
  const polygons: Exclusions["polygons"] = [];
  const barriers: Exclusions["barriers"] = [];
  for (const f of restrictedAreas().features as Feature[]) {
    const kind = (f.properties as any)?.kind;
    const name = String((f.properties as any)?.name ?? "restricted area");
    if (f.geometry.type === "Polygon" && (kind === "port" || kind === "protected")) {
      polygons.push({ name, ring: f.geometry.coordinates[0] as Position[] });
    }
    if (f.geometry.type === "LineString" && kind === "boundary") {
      barriers.push({ name, line: f.geometry.coordinates as Position[] });
    }
  }
  return { polygons, barriers };
}

function inExclusion(lon: number, lat: number, ex: Exclusions) {
  return ex.polygons.find((p) => pointInRing(lon, lat, p.ring))?.name ?? null;
}

function crossesBarrier(a: { lat: number; lon: number }, b: { lat: number; lon: number }, ex: Exclusions) {
  for (const barrier of ex.barriers) {
    for (let i = 0; i < barrier.line.length - 1; i++) {
      if (segmentsCross([a.lon, a.lat], [b.lon, b.lat], barrier.line[i]!, barrier.line[i + 1]!)) {
        return barrier.name;
      }
    }
  }
  return null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "ORCA-MarineIntelligence/1.0" } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return (await res.json()) as T;
}

/** Sample sea state on a grid; a point with no marine data is treated as land. */
async function sampleWaterGrid(pts: { lat: number; lon: number }[]) {
  const params = new URLSearchParams({
    latitude: pts.map((p) => p.lat.toFixed(3)).join(","),
    longitude: pts.map((p) => p.lon.toFixed(3)).join(","),
    current: "wave_height,sea_surface_temperature",
    timezone: "GMT",
  });
  const data = await getJson<any>(`https://marine-api.open-meteo.com/v1/marine?${params}`);
  const arr = Array.isArray(data) ? data : [data];
  return pts.map((_, i) => {
    const cur = arr[i]?.current;
    const wave = cur?.wave_height;
    const sst = cur?.sea_surface_temperature;
    const water = typeof wave === "number" || typeof sst === "number";
    return { water, wave: typeof wave === "number" ? wave : null };
  });
}

async function sampleWeather(pts: { lat: number; lon: number }[]) {
  const params = new URLSearchParams({
    latitude: pts.map((p) => p.lat.toFixed(3)).join(","),
    longitude: pts.map((p) => p.lon.toFixed(3)).join(","),
    current: "wind_speed_10m,wind_gusts_10m,precipitation,visibility,weather_code",
    wind_speed_unit: "kmh",
    timezone: "GMT",
  });
  const data = await getJson<any>(`https://api.open-meteo.com/v1/forecast?${params}`);
  const arr = Array.isArray(data) ? data : [data];
  return pts.map((_, i) => {
    const c = arr[i]?.current ?? {};
    return {
      wind: typeof c.wind_speed_10m === "number" ? c.wind_speed_10m : null,
      gust: typeof c.wind_gusts_10m === "number" ? c.wind_gusts_10m : null,
      rain: typeof c.precipitation === "number" ? c.precipitation : null,
      visibilityKm: typeof c.visibility === "number" ? c.visibility / 1000 : null,
      code: typeof c.weather_code === "number" ? c.weather_code : null,
    };
  });
}

/** Plan a sea route from `from` to `to`, avoiding land and published restrictions. */
export async function planRoute(
  from: { lat: number; lon: number; name?: string },
  to: { lat: number; lon: number; name?: string },
  speedKn = DEFAULT_SPEED_KN,
): Promise<RoutePlan> {
  const sources: string[] = [];
  const ex = buildExclusions();

  const minLat = Math.min(from.lat, to.lat) - PAD;
  const maxLat = Math.max(from.lat, to.lat) + PAD;
  const minLon = Math.min(from.lon, to.lon) - PAD;
  const maxLon = Math.max(from.lon, to.lon) + PAD;
  const stepLat = (maxLat - minLat) / (GRID - 1);
  const stepLon = (maxLon - minLon) / (GRID - 1);

  const cellAt = (i: number, j: number) => ({ lat: minLat + j * stepLat, lon: minLon + i * stepLon });
  const pts: { lat: number; lon: number }[] = [];
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) pts.push(cellAt(i, j));

  let grid: { water: boolean; wave: number | null }[];
  try {
    grid = await sampleWaterGrid(pts);
    sources.push("open_meteo_marine_route_grid");
  } catch {
    grid = pts.map(() => ({ water: true, wave: null }));
  }

  const idx = (i: number, j: number) => j * GRID + i;
  const nearestCell = (p: { lat: number; lon: number }) => ({
    i: Math.min(GRID - 1, Math.max(0, Math.round((p.lon - minLon) / stepLon))),
    j: Math.min(GRID - 1, Math.max(0, Math.round((p.lat - minLat) / stepLat))),
  });

  const start = nearestCell(from);
  const goal = nearestCell(to);
  const startKey = idx(start.i, start.j);
  const goalKey = idx(goal.i, goal.j);

  const passable = (i: number, j: number) => {
    const k = idx(i, j);
    if (k === startKey || k === goalKey) return true;
    if (!grid[k]?.water) return false;
    const c = cellAt(i, j);
    return !inExclusion(c.lon, c.lat, ex);
  };

  // A* over the water grid
  const key = (i: number, j: number) => `${i},${j}`;
  const open = new Map<string, { i: number; j: number; g: number; f: number }>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const h = (i: number, j: number) => distanceNm(cellAt(i, j), to);

  open.set(key(start.i, start.j), { i: start.i, j: start.j, g: 0, f: h(start.i, start.j) });
  gScore.set(key(start.i, start.j), 0);

  let found = false;
  while (open.size) {
    let bestKey = "";
    let best = { i: 0, j: 0, g: 0, f: Infinity };
    for (const [k, v] of open) if (v.f < best.f) { best = v; bestKey = k; }
    if (best.i === goal.i && best.j === goal.j) { found = true; break; }
    open.delete(bestKey);

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = best.i + di, nj = best.j + dj;
        if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID) continue;
        if (!passable(ni, nj)) continue;
        const a = cellAt(best.i, best.j);
        const b = cellAt(ni, nj);
        if (crossesBarrier(a, b, ex)) continue;
        const wave = grid[idx(ni, nj)]?.wave ?? 0;
        const penalty = wave > 2.5 ? (wave - 2.5) * 4 : 0;
        const tentative = best.g + distanceNm(a, b) + penalty;
        const nk = key(ni, nj);
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, tentative);
          cameFrom.set(nk, key(best.i, best.j));
          open.set(nk, { i: ni, j: nj, g: tentative, f: tentative + h(ni, nj) });
        }
      }
    }
  }

  let waypoints: { lat: number; lon: number }[] = [];
  if (found) {
    const path: { i: number; j: number }[] = [];
    let cur: string | undefined = key(goal.i, goal.j);
    const guard = GRID * GRID + 5;
    let steps = 0;
    while (cur && steps++ < guard) {
      const [i, j] = cur.split(",").map(Number) as [number, number];
      path.unshift({ i, j });
      if (i === start.i && j === start.j) break;
      cur = cameFrom.get(cur);
    }
    waypoints = path.map((p) => cellAt(p.i, p.j));
  }

  // Straight line fallback when no water path was found
  if (waypoints.length < 2) waypoints = [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }];

  waypoints[0] = { lat: from.lat, lon: from.lon };
  waypoints[waypoints.length - 1] = { lat: to.lat, lon: to.lon };

  // Smooth: drop a waypoint whose neighbours can see each other over water
  const visible = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    if (crossesBarrier(a, b, ex)) return false;
    const n = Math.max(2, Math.ceil(distanceNm(a, b) / 4));
    for (let s = 1; s < n; s++) {
      const lat = a.lat + ((b.lat - a.lat) * s) / n;
      const lon = a.lon + ((b.lon - a.lon) * s) / n;
      const c = nearestCell({ lat, lon });
      if (!passable(c.i, c.j)) return false;
      if (inExclusion(lon, lat, ex)) return false;
    }
    return true;
  };
  for (let i = 1; i < waypoints.length - 1; ) {
    if (visible(waypoints[i - 1]!, waypoints[i + 1]!)) waypoints.splice(i, 1);
    else i++;
  }

  let total = 0;
  const legNm: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    total += distanceNm(waypoints[i - 1]!, waypoints[i]!);
    legNm.push(total);
  }

  // Hazard sampling along the route (max 8 points)
  const sampleIdx: number[] = [];
  const stride = Math.max(1, Math.ceil(waypoints.length / 8));
  for (let i = 0; i < waypoints.length; i += stride) sampleIdx.push(i);
  if (sampleIdx[sampleIdx.length - 1] !== waypoints.length - 1) sampleIdx.push(waypoints.length - 1);

  const samples = sampleIdx.map((i) => waypoints[i]!);
  let weather: Awaited<ReturnType<typeof sampleWeather>> = [];
  try {
    weather = await sampleWeather(samples);
    sources.push("open_meteo_forecast_route");
  } catch {
    weather = [];
  }

  const hazards: RouteHazard[] = [];
  sampleIdx.forEach((wpIndex, n) => {
    const p = waypoints[wpIndex]!;
    const at = Number((legNm[wpIndex] ?? 0).toFixed(1));
    const w = weather[n];
    const cell = nearestCell(p);
    const wave = grid[idx(cell.i, cell.j)]?.wave ?? null;

    if (w?.code != null && [95, 96, 99].includes(w.code)) {
      hazards.push({ ...p, atNm: at, kind: "lightning", severity: "danger", message: `Thunderstorm with lightning around ${at} nm out` });
    }
    if (wave != null && wave >= 2.5) {
      hazards.push({ ...p, atNm: at, kind: "waves", severity: wave >= 3.5 ? "danger" : "warning", message: `Waves ${wave.toFixed(1)} m around ${at} nm out` });
    }
    if (w?.gust != null && w.gust >= 50) {
      hazards.push({ ...p, atNm: at, kind: "wind", severity: w.gust >= 65 ? "danger" : "warning", message: `Gusts ${w.gust.toFixed(0)} km/h around ${at} nm out` });
    }
    if (w?.visibilityKm != null && w.visibilityKm < 2) {
      hazards.push({ ...p, atNm: at, kind: "visibility", severity: "warning", message: `Poor visibility ${w.visibilityKm.toFixed(1)} km around ${at} nm out` });
    }
    if (w?.rain != null && w.rain >= 5) {
      hazards.push({ ...p, atNm: at, kind: "rain", severity: "warning", message: `Heavy rain ${w.rain.toFixed(1)} mm/h around ${at} nm out` });
    }
  });

  const danger = hazards.some((hz) => hz.severity === "danger");
  const advisory = danger
    ? "Do not sail this route now — a dangerous stretch is on the way. Wait for conditions to ease or pick a nearer zone."
    : hazards.length
      ? "Route is workable but has rough patches — keep watch and be ready to turn back."
      : "No hazards detected on this route from the current forecast. Keep monitoring VHF Ch.16.";

  const line: Feature = {
    type: "Feature",
    properties: {
      name: `Route to ${to.name ?? "fishing zone"}`,
      kind: "route",
      distance: `${total.toFixed(1)} nm`,
      eta: `${(total / speedKn).toFixed(1)} h at ${speedKn} kn`,
      note: advisory,
    },
    geometry: { type: "LineString", coordinates: waypoints.map((p) => [p.lon, p.lat]) },
  };

  const hazardFeatures: Feature[] = hazards.map((hz) => ({
    type: "Feature",
    properties: { kind: "hazard", severity: hz.severity, name: hz.kind, note: hz.message },
    geometry: { type: "Point", coordinates: [hz.lon, hz.lat] },
  }));

  const clear = !waypoints.some((p) => inExclusion(p.lon, p.lat, ex));

  return {
    from,
    to,
    distanceNm: Number(total.toFixed(1)),
    bearingDeg: Math.round(bearingDeg(from, to)),
    speedKn,
    etaHours: Number((total / speedKn).toFixed(1)),
    waypoints,
    hazards,
    advisory,
    clearOfRestrictedAreas: clear,
    geojson: { type: "FeatureCollection", features: [line, ...hazardFeatures] },
    sources,
    fetchedAt: new Date().toISOString(),
  };
}
