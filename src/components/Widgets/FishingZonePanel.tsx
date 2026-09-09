import React, { useMemo } from 'react';
import type { FeatureCollection, Feature } from 'geojson';

export interface LiveZone {
  id: string;
  name: string;
  confidence: string;
  species?: string;
  sst?: string;
  chlorophyll?: string;
  wave?: string;
  score?: number;
  lat: number;
  lon: number;
  distanceNm?: number;
  bearingDeg?: number;
}

function confColor(c: string): string {
  if (c === 'High') return 'var(--orca-success)';
  if (c === 'Medium') return 'var(--orca-warning)';
  return 'var(--orca-text-muted)';
}

function centroid(feature: Feature): { lat: number; lon: number } | null {
  const g: any = feature.geometry;
  const ring: number[][] | undefined =
    g?.type === 'Polygon' ? g.coordinates?.[0] :
    g?.type === 'Point' ? [[g.coordinates[0], g.coordinates[1]]] : undefined;
  if (!ring?.length) return null;
  let sx = 0, sy = 0, n = 0;
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) continue;
    sx += Number(p[0]); sy += Number(p[1]); n++;
  }
  return n ? { lat: sy / n, lon: sx / n } : null;
}

const R_NM = 3440.065;
const rad = (d: number) => (d * Math.PI) / 180;

function haversineNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.sqrt(h));
}

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg: number) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

interface FishingZonePanelProps {
  /** Live PFZ GeoJSON published by the map sync hook. */
  data?: FeatureCollection | null;
  /** The searched location, used for distance and bearing. */
  origin?: { lat: number; lon: number } | null;
  locationName?: string;
  onZoneSelect?: (zone: LiveZone) => void;
}

export const FishingZonePanel: React.FC<FishingZonePanelProps> = ({
  data, origin, locationName, onZoneSelect,
}) => {
  const zones = useMemo<LiveZone[]>(() => {
    const list: LiveZone[] = [];
    (data?.features ?? []).forEach((f, i) => {
      const c = centroid(f);
      if (!c) return;
      const p = (f.properties ?? {}) as Record<string, any>;
      list.push({
        id: String(p.name ?? 'zone-' + i),
        name: String(p.name ?? 'Zone ' + (i + 1)),
        confidence: String(p.confidence ?? 'Low'),
        species: p.species ?? undefined,
        sst: p.sst ?? undefined,
        chlorophyll: p.chlorophyll ?? undefined,
        wave: p.wave ?? undefined,
        score: typeof p.score === 'number' ? p.score : undefined,
        lat: c.lat,
        lon: c.lon,
        ...(origin
          ? { distanceNm: haversineNm(origin, c), bearingDeg: (bearing(origin, c) + 360) % 360 }
          : {}),
      });
    });
    return list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [data, origin]);

  return (
    <div className="anim-fade-in" style={{
      backgroundColor: 'var(--orca-bg-surface)',
      border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: 'system-ui, sans-serif',
      width: '100%',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--orca-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'ui-monospace, monospace' }}>
            PFZ Advisory
          </div>
          <div style={{ fontSize: 11, color: 'var(--orca-text-secondary)', marginTop: 1 }}>
            Potential Fishing Zones{locationName ? ' · ' + locationName : ''}
          </div>
        </div>
        <div style={{
          fontSize: 9,
          padding: '2px 6px',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'var(--orca-accent)',
          fontFamily: 'ui-monospace, monospace',
        }}>
          LIVE
        </div>
      </div>

      {zones.length === 0 ? (
        <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--orca-text-muted)', lineHeight: 1.6 }}>
          No fishing zones computed yet. Ask about a place — for example “Where can I fish near Kochi?”
          — and live zones for that stretch of sea will appear here.
        </div>
      ) : (
        <div style={{ padding: 6 }}>
          {zones.map((zone, i) => (
            <button
              key={zone.id}
              onClick={() => onZoneSelect?.(zone)}
              className="anim-slide-up"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '9px 10px',
                marginBottom: 4,
                background: 'none',
                border: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'left',
                cursor: 'pointer',
                animationDelay: i * 60 + 'ms',
                animationFillMode: 'both',
                transition: 'background-color 0.18s, border-color 0.18s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{
                width: 3,
                alignSelf: 'stretch',
                backgroundColor: confColor(zone.confidence),
                flexShrink: 0,
                marginTop: 2,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--orca-text-primary)' }}>{zone.name}</span>
                  <span style={{ fontSize: 10, color: confColor(zone.confidence), fontFamily: 'ui-monospace, monospace' }}>
                    {zone.confidence}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--orca-text-muted)', fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>
                  {zone.lat.toFixed(2)}N · {zone.lon.toFixed(2)}E
                  {zone.distanceNm != null && zone.bearingDeg != null
                    ? ` · ${zone.distanceNm.toFixed(1)} nm ${compass(zone.bearingDeg)} (${Math.round(zone.bearingDeg)}°)`
                    : ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--orca-text-secondary)', marginTop: 2 }}>
                  {[zone.species, zone.sst, zone.chlorophyll].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{
        padding: '6px 12px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 9,
        color: 'var(--orca-text-muted)',
        fontFamily: 'ui-monospace, monospace',
      }}>
        Computed by ORCA from live sea temperature, chlorophyll and wave data · Official bulletin: INCOIS
      </div>
    </div>
  );
};

export default FishingZonePanel;
