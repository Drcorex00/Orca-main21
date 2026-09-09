import React, { useMemo, useState } from 'react';
import type { FeatureCollection, Feature } from 'geojson';

export interface OceanGridProps {
  data?: FeatureCollection | null;
  /** Feature property holding the numeric value (e.g. "sst" or "chl"). */
  valueKey: string;
  unit: string;
  title: string;
  subtitle?: string;
  colorFor: (v: number) => string;
  legend: { min: string; max: string; gradient: string };
  emptyHint: string;
  note?: string;
  decimals?: number;
}

interface Cell { lat: number; lon: number; value: number }

/** Rough centroid of a polygon ring. */
function centroid(feature: Feature): { lat: number; lon: number } | null {
  const g: any = feature.geometry;
  if (!g) return null;
  const ring: number[][] | undefined =
    g.type === 'Polygon' ? g.coordinates?.[0] :
    g.type === 'Point' ? [[g.coordinates[0], g.coordinates[1]]] : undefined;
  if (!ring || !ring.length) return null;
  let sx = 0, sy = 0, n = 0;
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) continue;
    sx += Number(p[0]); sy += Number(p[1]); n++;
  }
  if (!n) return null;
  return { lat: sy / n, lon: sx / n };
}

const label: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--orca-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'ui-monospace, monospace',
};

export const OceanGrid: React.FC<OceanGridProps> = ({
  data, valueKey, unit, title, subtitle, colorFor, legend, emptyHint, note, decimals = 1,
}) => {
  const [hovered, setHovered] = useState<Cell | null>(null);

  const { cells, lats, lons, stats } = useMemo(() => {
    const list: Cell[] = [];
    for (const f of data?.features ?? []) {
      const raw = (f.properties as any)?.[valueKey];
      const value = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
      if (!isFinite(value)) continue;
      const c = centroid(f);
      if (!c) continue;
      list.push({ lat: Number(c.lat.toFixed(3)), lon: Number(c.lon.toFixed(3)), value });
    }
    const uniq = (xs: number[]) => Array.from(new Set(xs));
    const latsDesc = uniq(list.map(c => c.lat)).sort((a, b) => b - a);
    const lonsAsc = uniq(list.map(c => c.lon)).sort((a, b) => a - b);
    const values = list.map(c => c.value);
    return {
      cells: list,
      lats: latsDesc,
      lons: lonsAsc,
      stats: values.length
        ? {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            count: values.length,
          }
        : null,
    };
  }, [data, valueKey]);

  const lookup = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of cells) m.set(c.lat + ':' + c.lon, c);
    return m;
  }, [cells]);

  if (!stats) {
    return (
      <div className="anim-fade-in" style={{
        border: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: 'var(--orca-bg-surface)',
        padding: '18px 16px',
        color: 'var(--orca-text-muted)',
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        <div style={label}>{title}</div>
        <div style={{ marginTop: 8 }}>{emptyHint}</div>
      </div>
    );
  }

  const cellSize = Math.max(9, Math.min(20, Math.floor(360 / Math.max(lons.length, 1))));

  return (
    <div className="anim-fade-in" style={{
      border: '1px solid rgba(255,255,255,0.07)',
      backgroundColor: 'var(--orca-bg-surface)',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={label}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'var(--orca-text-secondary)', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--orca-text-muted)' }}>
          {[
            ['min', stats.min],
            ['avg', stats.avg],
            ['max', stats.max],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ textAlign: 'right' }}>
              <div>{k as string}</div>
              <div style={{ color: 'var(--orca-text-primary)', fontSize: 12 }}>
                {(v as number).toFixed(decimals)}{unit}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(lons.length, 1)}, ${cellSize}px)`,
          width: 'fit-content',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {lats.map((la, r) =>
            lons.map((lo, c) => {
              const cell = lookup.get(la + ':' + lo);
              const idx = r * lons.length + c;
              return (
                <div
                  key={la + ':' + lo}
                  className="anim-scale-in"
                  onMouseEnter={() => cell && setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: cell ? colorFor(cell.value) : 'rgba(255,255,255,0.02)',
                    outline: hovered && cell === hovered ? '1px solid rgba(255,255,255,0.85)' : 'none',
                    outlineOffset: -1,
                    cursor: cell ? 'crosshair' : 'default',
                    animationDelay: Math.min(idx * 6, 400) + 'ms',
                    animationFillMode: 'both',
                    transition: 'opacity 0.2s',
                    opacity: hovered && cell !== hovered ? 0.72 : 1,
                  }}
                />
              );
            }),
          )}
        </div>

        {hovered && (
          <div style={{
            marginTop: 8,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: 'var(--orca-text-secondary)',
          }}>
            {hovered.lat.toFixed(2)}N · {hovered.lon.toFixed(2)}E ·{' '}
            <span style={{ color: colorFor(hovered.value) }}>
              {hovered.value.toFixed(decimals)}{unit}
            </span>
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--orca-text-muted)',
      }}>
        <span>{legend.min}</span>
        <div style={{ flex: 1, maxWidth: 180, height: 6, background: legend.gradient }} />
        <span>{legend.max}</span>
        <span style={{ marginLeft: 'auto' }}>{stats.count} cells</span>
      </div>

      {note && (
        <div style={{ fontSize: 10, color: 'var(--orca-text-muted)', lineHeight: 1.5 }}>{note}</div>
      )}
    </div>
  );
};

export default OceanGrid;
