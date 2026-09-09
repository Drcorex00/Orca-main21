import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LocationInput = z.object({
  query: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

export type MarineBundle = {
  location: { name: string; lat: number; lon: number } | null;
  current: {
    waveHeight: number;
    wavePeriod: number;
    waveDirection: number;
    swellHeight: number;
    currentSpeed: number;
    sst: number;
    windSpeed: number;
    windDirection: number;
    gustSpeed: number;
    visibility: number;
    pressure: number;
    airTemp: number;
    precipitation: number;
  } | null;
  forecast: {
    time: string;
    waveHeight: number;
    wavePeriod: number;
    swellHeight: number;
    windSpeed: number;
  }[];
  tides: { time: string; height: number; type: "high" | "low" }[];
  airQuality: { pm10: number | null; pm25: number | null; uvIndex: number | null } | null;
  safety: { level: "info" | "warning" | "danger"; headline: string; body: string } | null;
  sources: string[];
  fetchedAt: string;
  error?: string;
};

/** Resolve a place name (or coordinates) and pull every free marine data source we use. */
export const getMarineBundle = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => LocationInput.parse(data))
  .handler(async ({ data }): Promise<MarineBundle> => {
    const {
      geocodePlace,
      reverseGeocodePoint,
      fetchMarineSnapshot,
      fetchAirQuality,
      deriveTides,
      assessSafety,
    } = await import("./orca.server");

    const sources: string[] = [];
    let lat = data.lat;
    let lon = data.lon;
    let name: string | null = null;

    if (data.query && data.query.trim()) {
      const geo = await geocodePlace(data.query.trim());
      sources.push("nominatim_geocode");
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
        name = geo.shortName;
      }
    }

    if (lat == null || lon == null) {
      return {
        location: null,
        current: null,
        forecast: [],
        tides: [],
        airQuality: null,
        safety: null,
        sources,
        fetchedAt: new Date().toISOString(),
        error: "no_location",
      };
    }

    if (!name) {
      name = await reverseGeocodePoint(lat, lon);
      sources.push("nominatim_reverse");
    }

    try {
      const snap = await fetchMarineSnapshot(lat, lon);
      sources.push("open_meteo_marine", "open_meteo_forecast");
      const air = await fetchAirQuality(lat, lon);
      if (air) sources.push("open_meteo_air_quality");

      const now = Date.now();
      const forecast = snap.hourly
        .filter((h) => {
          const t = new Date(h.time).getTime();
          return t >= now && t <= now + 24 * 3600 * 1000;
        })
        .map((h, i) => ({
          time: h.time,
          waveHeight: Number(h.waveHeight.toFixed(2)),
          wavePeriod: Number(h.wavePeriod.toFixed(1)),
          swellHeight: Number(h.swellHeight.toFixed(2)),
          windSpeed: Number((snap.hourlyWeather[i]?.windSpeed ?? 0).toFixed(1)),
        }));

      const c = snap.current;
      const w = snap.currentWeather;

      return {
        location: { name, lat, lon },
        current: {
          waveHeight: Number(c.waveHeight.toFixed(2)),
          wavePeriod: Number(c.wavePeriod.toFixed(1)),
          waveDirection: Math.round(c.waveDirection),
          swellHeight: Number(c.swellHeight.toFixed(2)),
          currentSpeed: Number(c.currentSpeed.toFixed(2)),
          sst: Number(c.sst.toFixed(1)),
          windSpeed: Number(w.windSpeed.toFixed(1)),
          windDirection: Math.round(w.windDirection),
          gustSpeed: Number(w.gustSpeed.toFixed(1)),
          visibility: Number(w.visibilityKm.toFixed(1)),
          pressure: Math.round(w.pressure),
          airTemp: Number(w.temperature.toFixed(1)),
          precipitation: Number(w.precipitation.toFixed(1)),
        },
        forecast,
        tides: deriveTides(snap.hourly).map((t) => ({
          time: t.time,
          height: Number(t.height.toFixed(2)),
          type: t.type,
        })),
        airQuality: air,
        safety: assessSafety(snap),
        sources,
        fetchedAt: snap.fetchedAt,
      };
    } catch (err) {
      return {
        location: { name, lat, lon },
        current: null,
        forecast: [],
        tides: [],
        airQuality: null,
        safety: null,
        sources,
        fetchedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "upstream_error",
      };
    }
  });

/** Standalone geocoding for the location search box. */
export const searchPlace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ query: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { geocodePlace } = await import("./orca.server");
    return geocodePlace(data.query);
  });

/** Gridded SST, chlorophyll-a and derived PFZ layers around a point. */
export const getOceanLayers = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ lat: z.number(), lon: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const { buildOceanLayers } = await import("./ocean.server");
    return buildOceanLayers(data.lat, data.lon);
  });

export type FishingRoute = import("./route.server").RoutePlan & {
  zone: { name: string; confidence: string; species: string } | null;
};

/**
 * Best fishing zone near a point plus the safest sea route to it,
 * with live hazards (lightning, waves, gusts, visibility, rain) along the way.
 */
export const getFishingRoute = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lat: z.number(),
        lon: z.number(),
        name: z.string().optional(),
        speedKn: z.number().min(2).max(25).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<FishingRoute | null> => {
    const { buildOceanLayers } = await import("./ocean.server");
    const { planRoute } = await import("./route.server");

    const layers = await buildOceanLayers(data.lat, data.lon);
    const best = layers.pfz.features[0];
    if (!best || best.geometry.type !== "Polygon") return null;

    const ring = (best.geometry.coordinates[0] ?? []) as number[][];
    const pts = ring.slice(0, -1);
    if (!pts.length) return null;
    const lon = pts.reduce((s, p) => s + (p[0] ?? 0), 0) / pts.length;
    const lat = pts.reduce((s, p) => s + (p[1] ?? 0), 0) / pts.length;

    const props = (best.properties ?? {}) as Record<string, any>;
    const zoneName = String(props.name ?? "Fishing zone");

    const plan = await planRoute(
      { lat: data.lat, lon: data.lon, ...(data.name ? { name: data.name } : {}) },
      { lat, lon, name: zoneName },
      data.speedKn ?? 8,
    );

    return {
      ...plan,
      zone: {
        name: zoneName,
        confidence: String(props.confidence ?? "Medium"),
        species: String(props.species ?? "Mixed pelagic"),
      },
    };
  });
