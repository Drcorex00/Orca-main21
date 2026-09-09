// Static maritime reference boundaries for Indian waters.
// Sources: published limits (UNCLOS 12 nm territorial sea / 24 nm contiguous zone
// measured from the coast) and the 1974/1976 India-Sri Lanka maritime boundary.
// Reference only — always confirm with official charts and INCOIS/Coast Guard notices.

import type { Feature, FeatureCollection, Position } from "geojson";

/** Coarse Indian coastline, ordered so the open sea is always on the RIGHT. */
const COASTLINE: Position[] = [
  // Gujarat (Kutch) heading south along the west coast
  [68.95, 23.75], [69.6, 22.45], [70.6, 22.35], [72.1, 21.6], [72.65, 21.05],
  [72.85, 20.4], [72.75, 19.85], [72.85, 19.2], [72.85, 18.9], [73.1, 18.3],
  [73.25, 17.6], [73.45, 16.9], [73.7, 16.2], [74.0, 15.4], [74.1, 14.7],
  [74.55, 13.9], [74.85, 13.2], [75.2, 12.5], [75.6, 11.8], [75.9, 11.2],
  [76.2, 10.5], [76.35, 9.9], [76.6, 9.3], [77.0, 8.6], [77.55, 8.08],
  // Kanyakumari, then north-east up the east coast
  [78.1, 8.4], [78.35, 9.1], [79.25, 9.6], [79.5, 10.2], [79.85, 10.75],
  [79.85, 11.4], [80.0, 12.1], [80.25, 12.9], [80.15, 13.6], [80.3, 14.3],
  [80.6, 15.0], [81.2, 15.7], [81.9, 16.35], [82.6, 16.9], [83.3, 17.5],
  [84.1, 18.2], [84.9, 19.0], [85.6, 19.6], [86.3, 20.1], [86.9, 20.6],
  [87.4, 21.1], [88.2, 21.55], [88.9, 21.75],
];

const NM = 1 / 60; // 1 nautical mile in degrees of latitude

/** Offset the coastline seaward (right-hand side) by `nm` nautical miles. */
function seawardOffset(nm: number): Position[] {
  const d = nm * NM;
  return COASTLINE.map((pt, i) => {
    const prev = COASTLINE[Math.max(0, i - 1)]!;
    const next = COASTLINE[Math.min(COASTLINE.length - 1, i + 1)]!;
    const lat = pt[1]!;
    const cos = Math.cos((lat * Math.PI) / 180) || 1;
    const dx = (next[0]! - prev[0]!) * cos;
    const dy = next[1]! - prev[1]!;
    const len = Math.hypot(dx, dy) || 1;
    // Right-hand normal of the travel direction points out to sea.
    const nx = dy / len;
    const ny = -dx / len;
    return [pt[0]! + (nx * d) / cos, lat + ny * d] as Position;
  });
}

/** India-Sri Lanka International Maritime Boundary Line (Palk Bay / Gulf of Mannar). */
const IMBL: Position[] = [
  [80.6, 10.05], [80.03, 9.9], [79.62, 9.72], [79.4, 9.45], [79.32, 9.05],
  [79.15, 8.6], [78.9, 8.0], [78.55, 7.3],
];

function circle(lon: number, lat: number, km: number, steps = 28): Position[] {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const ring: Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

const PORTS: { name: string; lon: number; lat: number; km: number }[] = [
  { name: "Kandla / Deendayal port approach", lon: 70.22, lat: 22.93, km: 12 },
  { name: "Mumbai port approach", lon: 72.75, lat: 18.92, km: 14 },
  { name: "Mormugao port approach", lon: 73.77, lat: 15.4, km: 10 },
  { name: "New Mangalore port approach", lon: 74.79, lat: 12.92, km: 10 },
  { name: "Kochi port approach", lon: 76.22, lat: 9.95, km: 12 },
  { name: "Tuticorin port approach", lon: 78.18, lat: 8.75, km: 10 },
  { name: "Chennai port approach", lon: 80.32, lat: 13.1, km: 12 },
  { name: "Visakhapatnam port approach", lon: 83.31, lat: 17.68, km: 12 },
  { name: "Paradip port approach", lon: 86.68, lat: 20.26, km: 12 },
  { name: "Haldia / Sandheads approach", lon: 88.1, lat: 21.15, km: 16 },
];

const PROTECTED: { name: string; note: string; ring: Position[] }[] = [
  {
    name: "Gulf of Mannar Marine National Park",
    note: "Marine national park — trawling and net fishing prohibited",
    ring: [[78.95, 9.28], [79.35, 9.28], [79.35, 8.85], [78.55, 8.9], [78.6, 9.15], [78.95, 9.28]],
  },
  {
    name: "Marine National Park, Gulf of Kachchh",
    note: "Marine national park and sanctuary — fishing restricted",
    ring: [[69.35, 22.65], [70.4, 22.65], [70.4, 22.25], [69.35, 22.3], [69.35, 22.65]],
  },
  {
    name: "Malvan Marine Sanctuary",
    note: "Marine sanctuary — restricted fishing zone",
    ring: [[73.4, 16.09], [73.52, 16.09], [73.52, 15.96], [73.4, 15.96], [73.4, 16.09]],
  },
  {
    name: "Sundarban core area",
    note: "Biosphere core zone — entry and fishing prohibited",
    ring: [[88.55, 21.95], [89.05, 21.95], [89.05, 21.45], [88.55, 21.5], [88.55, 21.95]],
  },
  {
    name: "Gahirmatha Marine Sanctuary",
    note: "Turtle nesting sanctuary — seasonal fishing ban",
    ring: [[86.85, 20.85], [87.15, 20.85], [87.15, 20.5], [86.85, 20.5], [86.85, 20.85]],
  },
];

let cached: FeatureCollection | null = null;

/** Reference boundaries drawn on the map: limits, IMBL, port approaches, protected areas. */
export function restrictedAreas(): FeatureCollection {
  if (cached) return cached;

  const features: Feature[] = [
    {
      type: "Feature",
      properties: {
        kind: "limit",
        name: "Territorial waters limit (12 nm)",
        note: "Indian territorial sea. Foreign vessels restricted.",
      },
      geometry: { type: "LineString", coordinates: seawardOffset(12) },
    },
    {
      type: "Feature",
      properties: {
        kind: "limit",
        name: "Contiguous zone limit (24 nm)",
        note: "Customs, immigration and sanitary enforcement zone.",
      },
      geometry: { type: "LineString", coordinates: seawardOffset(24) },
    },
    {
      type: "Feature",
      properties: {
        kind: "boundary",
        name: "India - Sri Lanka maritime boundary (IMBL)",
        note: "Do not cross. Crossing risks arrest and boat seizure.",
      },
      geometry: { type: "LineString", coordinates: IMBL },
    },
    ...PORTS.map<Feature>((p) => ({
      type: "Feature",
      properties: { kind: "port", name: p.name, note: "Harbour approach — keep clear of shipping channel." },
      geometry: { type: "Polygon", coordinates: [circle(p.lon, p.lat, p.km)] },
    })),
    ...PROTECTED.map<Feature>((p) => ({
      type: "Feature",
      properties: { kind: "protected", name: p.name, note: p.note },
      geometry: { type: "Polygon", coordinates: [p.ring] },
    })),
  ];

  cached = { type: "FeatureCollection", features };
  return cached;
}
