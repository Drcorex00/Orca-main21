// Gridded Indian Ocean layer data: sea surface temperature, chlorophyll-a and
// derived potential fishing zones (PFZ).
//
// SST / waves : Open-Meteo Marine (multi-point request)
// Chlorophyll : NOAA CoastWatch ERDDAP, gap-filled DINEOF VIIRS daily, 4 km
// PFZ         : computed here from SST fronts + chlorophyll fronts + wave penalty
//               (the official Indian PFZ bulletin is issued by INCOIS)

import type { Feature, FeatureCollection } from "geojson";

export interface GridCell {
  lat: number;
  lon: number;
  sst: number | null;
  wave: number | null;
  chl: number | null;
}

const N = 8; // grid is N x N points
const HALF = 1.4; // degrees either side of centre

const UA = "ORCA-MarineIntelligence/1.0 (educational project)";
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 30 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`upstream ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const value = (await res.json()) as T;
      cache.set(url, { at: Date.now(), value });
      if (cache.size > 60) cache.delete(cache.keys().next().value as string);
      return value;
    } catch (err) {
      lastErr = err;
    }
  }
  if (hit) return hit.value as T;
  throw lastErr instanceof Error ? lastErr : new Error("upstream failed");
}

function gridPoints(lat: number, lon: number) {
  const step = (HALF * 2) / (N - 1);
  const pts: { lat: number; lon: number; i: number; j: number }[] = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      pts.push({ lat: lat - HALF + j * step, lon: lon - HALF + i * step, i, j });
    }
  }
  return { pts, step };
}

async function fetchMarineGrid(pts: { lat: number; lon: number }[]) {
  const params = new URLSearchParams({
    latitude: pts.map((p) => p.lat.toFixed(3)).join(","),
    longitude: pts.map((p) => p.lon.toFixed(3)).join(","),
    current: "wave_height,sea_surface_temperature",
    timezone: "GMT",
  });
  const data = await getJson<any>(`https://marine-api.open-meteo.com/v1/marine?${params}`);
  const arr = Array.isArray(data) ? data : [data];
  return pts.map((_, idx) => {
    const cur = arr[idx]?.current;
    const sst = cur?.sea_surface_temperature;
    const wave = cur?.wave_height;
    return {
      sst: typeof sst === "number" ? sst : null,
      wave: typeof wave === "number" ? wave : null,
    };
  });
}

async function fetchChlorophyll(lat: number, lon: number) {
  const north = (lat + HALF).toFixed(3);
  const south = (lat - HALF).toFixed(3);
  const west = (lon - HALF).toFixed(3);
  const east = (lon + HALF).toFixed(3);
  const q = `chlor_a[last][0][(${north}):6:(${south})][(${west}):6:(${east})]`;
  const url = `https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPN20VIIRSDINEOFDaily.json?${encodeURIComponent(q)}`;
  const data = await getJson<any>(url);
  const rows: any[][] = data?.table?.rows ?? [];
  const cols: string[] = data?.table?.columnNames ?? [];
  const li = cols.indexOf("latitude");
  const oi = cols.indexOf("longitude");
  const ci = cols.indexOf("chlor_a");
  const ti = cols.indexOf("time");
  const points = rows
    .map((r) => ({ lat: Number(r[li]), lon: Number(r[oi]), chl: r[ci] == null ? null : Number(r[ci]) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  return { points, time: rows[0]?.[ti] ? String(rows[0][ti]) : null };
}

function nearestChl(
  points: { lat: number; lon: number; chl: number | null }[],
  lat: number,
  lon: number,
): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const p of points) {
    if (p.chl == null) continue;
    const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p.chl;
    }
  }
  return bestD < 0.6 ? best : null;
}

function cellPolygon(lat: number, lon: number, step: number): number[][][] {
  const h = step / 2;
  return [[
    [lon - h, lat - h], [lon + h, lat - h], [lon + h, lat + h], [lon - h, lat + h], [lon - h, lat - h],
  ]];
}

export interface OceanLayerResult {
  sst: FeatureCollection;
  chlorophyll: FeatureCollection;
  pfz: FeatureCollection;
  sources: string[];
  chlorophyllDate: string | null;
  fetchedAt: string;
  unavailable: string[];
}

const SPECIES: [number, string][] = [
  [30, "Tuna, seer fish, barracuda"],
  [28.5, "Mackerel, sardine, tuna"],
  [27, "Sardine, mackerel, pomfret"],
  [0, "Pomfret, ribbon fish, prawn"],
];

function speciesFor(sst: number | null): string {
  if (sst == null) return "Mixed pelagic";
  return SPECIES.find(([t]) => sst >= t)?.[1] ?? "Mixed pelagic";
}

/** Build SST, chlorophyll and derived PFZ layers around a centre point. */
export async function buildOceanLayers(lat: number, lon: number): Promise<OceanLayerResult> {
  const { pts, step } = gridPoints(lat, lon);
  const sources: string[] = [];
  const unavailable: string[] = [];

  const [marineRes, chlRes] = await Promise.allSettled([
    fetchMarineGrid(pts),
    fetchChlorophyll(lat, lon),
  ]);

  const marine =
    marineRes.status === "fulfilled" ? marineRes.value : pts.map(() => ({ sst: null, wave: null }));
  if (marineRes.status === "fulfilled") sources.push("open_meteo_marine_grid");
  else unavailable.push("sst");

  const chl = chlRes.status === "fulfilled" ? chlRes.value : { points: [], time: null };
  if (chlRes.status === "fulfilled" && chl.points.length) sources.push("noaa_coastwatch_viirs_chlorophyll");
  else unavailable.push("chlorophyll");

  const cells: GridCell[] = pts.map((p, idx) => ({
    lat: p.lat,
    lon: p.lon,
    sst: marine[idx]?.sst ?? null,
    wave: marine[idx]?.wave ?? null,
    chl: nearestChl(chl.points, p.lat, p.lon),
  }));

  const at = (i: number, j: number) =>
    i < 0 || j < 0 || i >= N || j >= N ? undefined : cells[j * N + i];

  const gradient = (i: number, j: number, key: "sst" | "chl") => {
    const c = at(i, j);
    const v = c?.[key];
    if (v == null) return 0;
    let max = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = at(i + di, j + dj)?.[key];
      if (n != null) max = Math.max(max, Math.abs(n - v));
    }
    return max;
  };

  const sstFeatures: Feature[] = [];
  const chlFeatures: Feature[] = [];
  const scored: { cell: GridCell; i: number; j: number; score: number }[] = [];

  pts.forEach((p, idx) => {
    const c = cells[idx]!;
    if (c.sst != null) {
      sstFeatures.push({
        type: "Feature",
        properties: { sst: Number(c.sst.toFixed(1)), wave: c.wave == null ? null : Number(c.wave.toFixed(2)) },
        geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, step) },
      });
    }
    if (c.chl != null) {
      chlFeatures.push({
        type: "Feature",
        properties: { chl: Number(c.chl.toFixed(2)) },
        geometry: { type: "Polygon", coordinates: cellPolygon(c.lat, c.lon, step) },
      });
    }

    const sstFront = Math.min(gradient(p.i, p.j, "sst") / 1.2, 1);
    const chlFront = Math.min(gradient(p.i, p.j, "chl") / 1.5, 1);
    const chlLevel = c.chl == null ? 0 : Math.min(Math.log10(1 + c.chl) / Math.log10(6), 1);
    const wavePenalty = c.wave == null ? 0 : Math.min(Math.max(c.wave - 2, 0) / 3, 1);
    const score = Math.max(
      0,
      0.35 * sstFront + 0.3 * chlFront + 0.35 * chlLevel - 0.4 * wavePenalty,
    );
    if (c.sst != null) scored.push({ cell: c, i: p.i, j: p.j, score });
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0.18).slice(0, 8);

  const pfzFeatures: Feature[] = top.map((s, rank) => ({
    type: "Feature",
    properties: {
      name: `PFZ ${String.fromCharCode(65 + rank)}`,
      confidence: s.score > 0.45 ? "High" : s.score > 0.3 ? "Medium" : "Low",
      score: Number(s.score.toFixed(2)),
      sst: s.cell.sst == null ? null : `${s.cell.sst.toFixed(1)} °C`,
      chlorophyll: s.cell.chl == null ? null : `${s.cell.chl.toFixed(2)} mg/m³`,
      wave: s.cell.wave == null ? null : `${s.cell.wave.toFixed(1)} m`,
      species: speciesFor(s.cell.sst),
      issuer: "Computed by ORCA — official bulletin: INCOIS",
    },
    geometry: { type: "Polygon", coordinates: cellPolygon(s.cell.lat, s.cell.lon, step * 1.05) },
  }));

  return {
    sst: { type: "FeatureCollection", features: sstFeatures },
    chlorophyll: { type: "FeatureCollection", features: chlFeatures },
    pfz: { type: "FeatureCollection", features: pfzFeatures },
    sources,
    chlorophyllDate: chl.time,
    fetchedAt: new Date().toISOString(),
    unavailable,
  };
}
