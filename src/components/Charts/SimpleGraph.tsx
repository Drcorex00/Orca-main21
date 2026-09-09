import React, { useMemo, useRef, useState } from 'react';

export interface SimpleGraphPoint {
  label: string;
  value: number;
}

interface SimpleGraphProps {
  data: SimpleGraphPoint[];
  height?: number;
  color?: string;
  unit?: string;
  title?: string;
  /** Marks a threshold line, e.g. safe-operation wave height */
  threshold?: number;
  thresholdLabel?: string;
}

const W = 600; // viewBox width — scales responsively
const PAD_T = 14;
const PAD_B = 22;

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Animated line graph: the line draws itself in, the area fill breathes,
 * and hovering reveals a crosshair with the exact reading.
 */
export const SimpleGraph: React.FC<SimpleGraphProps> = ({
  data,
  height = 200,
  color = '#c9c9c9',
  unit = 'm',
  title,
  threshold,
  thresholdLabel,
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { pts, line, area, min, max, thresholdY } = useMemo(() => {
    const vals = data.map((d) => d.value);
    const rawMin = Math.min(...vals, threshold ?? Infinity);
    const rawMax = Math.max(...vals, threshold ?? -Infinity);
    const pad = (rawMax - rawMin) * 0.2 || 0.5;
    const min = Math.max(0, rawMin - pad);
    const max = rawMax + pad;
    const span = max - min || 1;
    const innerH = height - PAD_T - PAD_B;

    const pts = data.map((d, i) => ({
      x: data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
      y: PAD_T + innerH - ((d.value - min) / span) * innerH,
    }));

    const line = smoothPath(pts);
    const area = line
      ? `${line} L ${pts[pts.length - 1]!.x} ${height - PAD_B} L ${pts[0]!.x} ${height - PAD_B} Z`
      : '';
    const thresholdY =
      threshold != null ? PAD_T + innerH - ((threshold - min) / span) * innerH : null;

    return { pts, line, area, min, max, thresholdY };
  }, [data, height, threshold]);

  if (!data.length) {
    return (
      <div style={{
        height,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--orca-text-muted)',
      }}>
        No data yet
      </div>
    );
  }

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, idx)));
  };

  const active = hover != null ? data[hover] : null;
  const activePt = hover != null ? pts[hover] : null;
  const gid = `orca-sg-${unit.replace(/\W/g, '')}-${Math.round(max * 100)}`;

  return (
    <div style={{ width: '100%' }}>
      {(title || active) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6,
        }}>
          <span style={{
            fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--orca-text-muted)', fontFamily: 'ui-monospace, monospace',
          }}>
            {title}
          </span>
          <span style={{
            fontSize: 11, fontFamily: 'ui-monospace, monospace',
            color: active ? color : 'var(--orca-text-secondary)',
          }}>
            {active
              ? `${active.label} — ${active.value.toFixed(2)} ${unit}`
              : `${min.toFixed(1)}–${max.toFixed(1)} ${unit}`}
          </span>
        </div>
      )}

      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ width: '100%', position: 'relative', cursor: 'crosshair' }}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0} x2={W}
              y1={PAD_T + f * (height - PAD_T - PAD_B)}
              y2={PAD_T + f * (height - PAD_T - PAD_B)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          ))}

          {/* Threshold */}
          {thresholdY != null && (
            <>
              <line
                x1={0} x2={W} y1={thresholdY} y2={thresholdY}
                stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeDasharray="5 4"
              />
              {thresholdLabel && (
                <text
                  x={W - 6} y={thresholdY - 5} textAnchor="end"
                  fill="rgba(245,158,11,0.75)" fontSize="9" fontFamily="ui-monospace, monospace"
                >
                  {thresholdLabel}
                </text>
              )}
            </>
          )}

          {/* Area */}
          <path d={area} fill={`url(#${gid})`} className="orca-graph-area" />

          {/* Line — draws itself in */}
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            className="orca-graph-line"
            style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
          />

          {/* Crosshair */}
          {activePt && (
            <>
              <line
                x1={activePt.x} x2={activePt.x} y1={PAD_T} y2={height - PAD_B}
                stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={activePt.x} cy={activePt.y} r="10" fill={color} opacity={0.15} />
              <circle
                cx={activePt.x} cy={activePt.y} r="3.5"
                fill="var(--orca-bg-primary)" stroke={color} strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* Time axis */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 9, fontFamily: 'ui-monospace, monospace',
          color: 'var(--orca-text-muted)', marginTop: -6,
        }}>
          <span>{data[0]?.label}</span>
          <span>{data[Math.floor(data.length / 2)]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleGraph;
