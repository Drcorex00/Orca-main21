// ORCA client service — resolves a location, pulls live marine data from the
// backend, then streams a grounded answer from the LLM endpoint.

import { getMarineBundle, getFishingRoute, type MarineBundle, type FishingRoute } from "../lib/orca.functions";
import { MarineData, SafetyAlert } from "../types";
import { matchCoastalPlace } from "../data/coastalPlaces";
import type { WaveChartData } from "../components/Charts/WaveChart";

export type QueryIntent = "wave" | "tide" | "fishing" | "safety" | "sst" | "wind" | "general";

export interface OrcaQueryResult {
  text: string;
  intent: QueryIntent;
  marineData?: MarineData;
  waveChartData?: WaveChartData[];
  tideData?: { time: string; height: number; type: "high" | "low" }[];
  safetyAlerts?: SafetyAlert[];
  locationName?: string;
  locationCoords?: { lat: number; lon: number };
  toolsUsed: string[];
  bundle?: MarineBundle;
  route?: FishingRoute | null;
}

// ─── Location + intent extraction ─────────────────────────────────────────────

export function extractLocation(query: string): string | null {
  // Known coastal places first — works for every script and for romanised
  // Indian-language questions, where the English phrase patterns never match.
  const known = matchCoastalPlace(query);
  if (known) return known;

  const patterns = [
    /near\s+([A-Za-z\s]{3,30}?)(?:\?|$|\s+coast|\s+shore|\s+bay|\s+port|\s+harbour|\s+sea|\s+waters?|\s+tomorrow|\s+today)/i,
    /off\s+(?:the\s+)?([A-Za-z\s]{3,25}?)(?:\s+coast|\s+shore|\s+waters?)/i,
    /(?:at|from|around|in)\s+([A-Za-z\s]{3,25}?)(?:\?|$|\s+port|\s+harbour)/i,
    /([A-Za-z\s]{3,25}?)\s+(?:coast|bay|harbour|port|waters?|offshore)/i,
  ];
  const skipWords = new Set([
    "the", "me", "my", "current", "safe", "nearest", "best", "good", "today",
    "tomorrow", "now", "what", "where", "how", "is", "it", "are", "sea", "ocean",
  ]);
  for (const pat of patterns) {
    const m = query.match(pat);
    if (m?.[1]) {
      const loc = m[1].trim().replace(/\s+/g, " ");
      if (loc.length >= 3 && !skipWords.has(loc.toLowerCase())) return loc;
    }
  }
  return null;
}

export function detectIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  if (/\b(wave|swell|surf|sea state|height|period)\b/.test(q)) return "wave";
  if (/\b(tide|tidal|high water|low water|water level|tides)\b/.test(q)) return "tide";
  if (/\b(fish|fishing|pfz|potential fishing|catch|trawl|net|squid|mackerel)\b/.test(q)) return "fishing";
  if (/\b(safe|danger|risk|advisory|warning|caution|venture|sail|navigate|go out)\b/.test(q)) return "safety";
  if (/\b(sst|sea surface temp|temperature|warm|cold|thermal|chloro)\b/.test(q)) return "sst";
  if (/\b(wind|gust|breeze|storm|cyclone)\b/.test(q)) return "wind";
  return "general";
}

// ─── Data gathering (backend) ─────────────────────────────────────────────────

export async function gatherContext(
  query: string,
  fallbackLocation?: { lat: number; lon: number },
): Promise<OrcaQueryResult> {
  const intent = detectIntent(query);
  const place = extractLocation(query);
  const toolsUsed: string[] = [];

  const bundle = await getMarineBundle({
    data: {
      ...(place ? { query: place } : {}),
      ...(!place && fallbackLocation
        ? { lat: fallbackLocation.lat, lon: fallbackLocation.lon }
        : {}),
    },
  });

  toolsUsed.push(...(bundle.sources ?? []));

  const result: OrcaQueryResult = { text: "", intent, toolsUsed, bundle };

  if (bundle.location) {
    result.locationName = bundle.location.name;
    result.locationCoords = { lat: bundle.location.lat, lon: bundle.location.lon };
  }

  if (bundle.current) {
    const c = bundle.current;
    result.marineData = {
      waveHeight: c.waveHeight,
      wavePeriod: c.wavePeriod,
      waveDirection: c.waveDirection,
      swellHeight: c.swellHeight,
      currentSpeed: c.currentSpeed,
      sst: c.sst,
      windSpeed: c.windSpeed,
      windDirection: c.windDirection,
      visibility: c.visibility,
      pressure: c.pressure,
    };
  }

  if (bundle.forecast?.length) {
    result.waveChartData = bundle.forecast.map((h) => ({
      time: h.time.slice(11, 16),
      waveHeight: h.waveHeight,
      wavePeriod: h.wavePeriod,
      swellHeight: h.swellHeight,
    }));
  }

  if (bundle.tides?.length) result.tideData = bundle.tides;

  if (bundle.safety && (bundle.safety.level !== "info" || intent === "safety")) {
    result.safetyAlerts = [
      {
        level: bundle.safety.level,
        title: bundle.safety.headline,
        message: bundle.safety.body,
      },
    ];
  }

  // Fishing questions also get a sea route to the best zone, with hazards.
  if (bundle.location && (intent === "fishing" || wantsRoute(query))) {
    try {
      const route = await getFishingRoute({
        data: {
          lat: bundle.location.lat,
          lon: bundle.location.lon,
          name: bundle.location.name,
        },
      });
      if (route) {
        result.route = route;
        toolsUsed.push("orca_route_planner", ...(route.sources ?? []));
        (bundle as MarineBundle & { route?: unknown }).route = {
          zone: route.zone,
          distanceNm: route.distanceNm,
          bearing: `${route.bearingDeg}°`,
          etaHours: route.etaHours,
          speedKn: route.speedKn,
          waypoints: route.waypoints.map((w) => [
            Number(w.lat.toFixed(3)),
            Number(w.lon.toFixed(3)),
          ]),
          hazards: route.hazards.map((h) => ({
            kind: h.kind,
            severity: h.severity,
            atNm: h.atNm,
            message: h.message,
          })),
          advisory: route.advisory,
          clearOfRestrictedAreas: route.clearOfRestrictedAreas,
        };
      }
    } catch {
      /* routing is best-effort */
    }
  }

  return result;
}

/** Does the question ask how to get somewhere? */
export function wantsRoute(query: string): boolean {
  return /\b(route|path|way|direction|navigate|how (do|to) (i|we) (get|reach|go)|kaise jau|raasta|rasta|vazhi|marg|दिशा|रास्ता|मार्ग|வழி)\b/i.test(
    query,
  );
}

// ─── LLM streaming ────────────────────────────────────────────────────────────

export interface StreamOptions {
  messages: { role: "user" | "assistant"; content: string }[];
  context: MarineBundle | null;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

export async function streamAnswer({ messages, context, onChunk, signal }: StreamOptions) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok || !res.body) {
    let msg = "ORCA could not reach the reasoning engine. Please try again.";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    onChunk(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
