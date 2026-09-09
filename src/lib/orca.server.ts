// ORCA backend data layer — free marine / weather / geo APIs (no keys required).
// Open-Meteo Marine, Open-Meteo Forecast, Open-Meteo Air Quality, Nominatim geocoding.

export interface MarinePoint {
  time: string;
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  swellHeight: number;
  swellPeriod: number;
  currentSpeed: number;
  sst: number;
  seaLevel: number;
}

export interface WeatherPoint {
  time: string;
  windSpeed: number;
  windDirection: number;
  gustSpeed: number;
  pressure: number;
  visibilityKm: number;
  precipitation: number;
  temperature: number;
}

export interface MarineSnapshot {
  location: { lat: number; lon: number };
  current: MarinePoint;
  currentWeather: WeatherPoint;
  hourly: MarinePoint[];
  hourlyWeather: WeatherPoint[];
  fetchedAt: string;
}

export interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
  shortName: string;
  type: string;
}

const UA = "ORCA-MarineIntelligence/1.0 (educational project)";

// Short-lived in-memory cache: upstream free APIs rate-limit shared server IPs
// hard, so repeat lookups for the same place must not hit them again.
const cache = new Map<string, { at: number; value: any }>();
const TTL_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, headers?: Record<string, string>) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, ...(headers ?? {}) } });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Upstream ${new URL(url).host} responded ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Upstream ${new URL(url).host} responded ${res.status}`);
      const value = await res.json();
      cache.set(url, { at: Date.now(), value });
      if (cache.size > 200) cache.delete(cache.keys().next().value as string);
      return value as any;
    } catch (err) {
      lastErr = err;
    }
  }
  // Serve stale data rather than failing outright.
  if (hit) return hit.value;
  throw lastErr instanceof Error ? lastErr : new Error("Upstream request failed");
}


// ORCA serves Indian and neighbouring waters, so place names resolve in this
// region first (otherwise "Kochi" can resolve to Kochi, Japan).
const REGION_COUNTRIES = "in,lk,bd,pk,mm,mv";

async function nominatimSearch(query: string, countryCodes?: string): Promise<any[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    "accept-language": "en",
  });
  if (countryCodes) params.set("countrycodes", countryCodes);
  const results = await getJson(`https://nominatim.openstreetmap.org/search?${params}`);
  return Array.isArray(results) ? results : [];
}

export async function geocodePlace(query: string): Promise<GeoResult | null> {
  try {
    let results = await nominatimSearch(query, REGION_COUNTRIES);
    if (!results.length) results = await nominatimSearch(query);
    if (!results.length) return null;
    const preferred =
      results.find((r) =>
        ["sea", "ocean", "bay", "harbour", "port", "water", "cape", "peninsula"].includes(r.type),
      ) ?? results.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];
    const parts = String(preferred.display_name).split(",");
    return {
      lat: parseFloat(preferred.lat),
      lon: parseFloat(preferred.lon),
      displayName: preferred.display_name,
      shortName: parts.slice(0, 2).join(",").trim(),
      type: preferred.type ?? "place",
    };
  } catch {
    return null;
  }
}

export async function reverseGeocodePoint(lat: number, lon: number): Promise<string> {
  try {
    const data = await getJson(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json`,
    );
    const parts = String(data.display_name ?? "").split(",");
    return parts.slice(0, 3).join(",").trim() || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  } catch {
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  }
}

export async function fetchMarineSnapshot(lat: number, lon: number): Promise<MarineSnapshot> {
  const marineParams = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: [
      "wave_height",
      "wave_direction",
      "wave_period",
      "swell_wave_height",
      "swell_wave_period",
      "ocean_current_velocity",
      "sea_surface_temperature",
      "sea_level_height_msl",
    ].join(","),
    timezone: "auto",
    forecast_days: "3",
  });

  const weatherParams = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: [
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "surface_pressure",
      "visibility",
      "precipitation",
      "temperature_2m",
    ].join(","),
    wind_speed_unit: "kmh",
    timezone: "auto",
    forecast_days: "3",
  });

  const [mRes, wRes] = await Promise.allSettled([
    getJson(`https://marine-api.open-meteo.com/v1/marine?${marineParams}`),
    getJson(`https://api.open-meteo.com/v1/forecast?${weatherParams}`),
  ]);

  if (mRes.status === "rejected" && wRes.status === "rejected") throw mRes.reason;

  const m = mRes.status === "fulfilled" ? mRes.value : { hourly: null };
  const w = wRes.status === "fulfilled" ? wRes.value : { hourly: null };

  const hourly: MarinePoint[] = ((m.hourly?.time as string[]) ?? []).map((t, i) => ({
    time: t,
    waveHeight: m.hourly.wave_height?.[i] ?? 0,
    wavePeriod: m.hourly.wave_period?.[i] ?? 0,
    waveDirection: m.hourly.wave_direction?.[i] ?? 0,
    swellHeight: m.hourly.swell_wave_height?.[i] ?? 0,
    swellPeriod: m.hourly.swell_wave_period?.[i] ?? 0,
    currentSpeed: m.hourly.ocean_current_velocity?.[i] ?? 0,
    sst: m.hourly.sea_surface_temperature?.[i] ?? 0,
    seaLevel: m.hourly.sea_level_height_msl?.[i] ?? 0,
  }));


  const hourlyWeather: WeatherPoint[] = ((w.hourly?.time as string[]) ?? []).map((t, i) => ({
    time: t,
    windSpeed: w.hourly.wind_speed_10m?.[i] ?? 0,
    windDirection: w.hourly.wind_direction_10m?.[i] ?? 0,
    gustSpeed: w.hourly.wind_gusts_10m?.[i] ?? 0,
    pressure: w.hourly.surface_pressure?.[i] ?? 1013,
    visibilityKm: (w.hourly.visibility?.[i] ?? 10000) / 1000,
    precipitation: w.hourly.precipitation?.[i] ?? 0,
    temperature: w.hourly.temperature_2m?.[i] ?? 0,
  }));

  const nowStr = new Date().toISOString().slice(0, 13);
  const ci = Math.max(0, hourly.findIndex((h) => h.time.slice(0, 13) >= nowStr));
  const cwi = Math.max(0, hourlyWeather.findIndex((h) => h.time.slice(0, 13) >= nowStr));

  const emptyMarine: MarinePoint = {
    time: new Date().toISOString(),
    waveHeight: 0, wavePeriod: 0, waveDirection: 0, swellHeight: 0,
    swellPeriod: 0, currentSpeed: 0, sst: 0, seaLevel: 0,
  };
  const emptyWeather: WeatherPoint = {
    time: new Date().toISOString(),
    windSpeed: 0, windDirection: 0, gustSpeed: 0, pressure: 1013,
    visibilityKm: 10, precipitation: 0, temperature: 0,
  };

  return {
    location: { lat, lon },
    current: hourly[ci] ?? hourly[0] ?? emptyMarine,
    currentWeather: hourlyWeather[cwi] ?? hourlyWeather[0] ?? emptyWeather,
    hourly,
    hourlyWeather,
    fetchedAt: new Date().toISOString(),
  };
}


export interface TideExtreme {
  time: string;
  height: number;
  type: "high" | "low";
}

/** Derive tidal extremes from the hourly sea-level (MSL) series. */
export function deriveTides(hourly: MarinePoint[]): TideExtreme[] {
  const series = hourly.slice(0, 48);
  const out: TideExtreme[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    const prev = series[i - 1].seaLevel;
    const cur = series[i].seaLevel;
    const next = series[i + 1].seaLevel;
    if (cur > prev && cur >= next) out.push({ time: series[i].time, height: cur, type: "high" });
    else if (cur < prev && cur <= next) out.push({ time: series[i].time, height: cur, type: "low" });
  }
  return out.slice(0, 8);
}

export type SafetyLevel = "info" | "warning" | "danger";

export function assessSafety(snap: MarineSnapshot): {
  level: SafetyLevel;
  headline: string;
  body: string;
} {
  const wave = snap.current?.waveHeight ?? 0;
  const wind = snap.currentWeather?.windSpeed ?? 0;
  const gust = snap.currentWeather?.gustSpeed ?? 0;
  if (wave >= 4.5 || wind >= 60 || gust >= 80) {
    return {
      level: "danger",
      headline: "Severe Sea Conditions",
      body: `Wave height ${wave.toFixed(1)} m, wind ${wind.toFixed(0)} km/h. All small vessels advised to remain in port.`,
    };
  }
  if (wave >= 2.5 || wind >= 35 || gust >= 50) {
    return {
      level: "warning",
      headline: "Small Craft Advisory",
      body: `Wave height ${wave.toFixed(1)} m, wind ${wind.toFixed(0)} km/h (gusts ${gust.toFixed(0)} km/h). Exercise caution.`,
    };
  }
  return {
    level: "info",
    headline: "Conditions Favorable",
    body: `Wave height ${wave.toFixed(1)} m, wind ${wind.toFixed(0)} km/h. Suitable for most coastal operations.`,
  };
}

/** Marine air quality / UV support data (free, no key). */
export async function fetchAirQuality(lat: number, lon: number) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: "pm10,pm2_5,uv_index",
      timezone: "auto",
    });
    const d = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    return {
      pm10: d.current?.pm10 ?? null,
      pm25: d.current?.pm2_5 ?? null,
      uvIndex: d.current?.uv_index ?? null,
    };
  } catch {
    return null;
  }
}
