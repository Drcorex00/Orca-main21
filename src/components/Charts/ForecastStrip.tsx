import React, { useMemo, useState } from 'react';
import type { WaveChartData } from './WaveChart';

interface ForecastStripProps {
  data: WaveChartData[];
  /** Height of the strip in px */
  height?: number;
  locationName?: string;
}

function barColor(h: number): string {
  if (h >= 4) return '#ef4444';
  if (h >= 2.5) return '#f59e0b';
  return '#c9c9c9';
}

/**
 * 24-hour wave-height forecast strip.
 * Bars grow in on data change (so a new answer is visibly reflected), colour-coded
 * by sea-state risk, with the safe-operation threshold marked at 2.5 m.
 */
export const ForecastStrip: React.FC<ForecastStripProps> = ({
  data,
  height = 150,
  locationName,
}) => {
  const [hover, setHover] = useState<number | null>(null);

  const { bars, max, peak } = useMemo(() => {
    const bars = data.slice(0, 24);
    const max = Math.max(1, ...bars.map((b) => b.waveHeight)) * 1.15;
    const peak = bars.reduce(
      (a, b) => (b.waveHeight > (a?.waveHeight ?? -1) ? b : a),
      bars[0],
    );
    return { bars, max, peak };
  }, [data]);

  if (!bars.length) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11,
          color: 'var(--orca-text-muted)',
        }}
      >
        Ask ORCA about a location to load a 24-hour forecast
      </div>
    );
  }

  const thresholdPct = Math.min(100, (2.5 / max) * 100);
  const active = hover != null ? bars[hover] : null;

  return (
    <div style={{ padding: '10px 12px 8px', position: 'relative' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--orca-text-muted)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          Wave height · next 24 h {locationName ? `· ${locationName}` : ''}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            color: active ? 'var(--orca-accent)' : 'var(--orca-text-secondary)',
          }}
        >
          {active
            ? `${active.time} — ${active.waveHeight.toFixed(2)} m`
            : `peak ${peak?.waveHeight.toFixed(2)} m @ ${peak?.time}`}
        </span>
      </div>

      {/* Bars */}
      <div
        style={{
          position: 'relative',
          height,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Safe-operation threshold */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `${thresholdPct}%`,
            borderTop: '1px dashed rgba(245,158,11,0.45)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: -12,
              fontSize: 8,
              color: 'rgba(245,158,11,0.7)',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            2.5 m advisory
          </span>
        </div>

        {bars.map((b, i) => {
          const pct = Math.max(3, (b.waveHeight / max) * 100);
          const color = barColor(b.waveHeight);
          return (
            <div
              key={`${b.time}-${i}`}
              onMouseEnter={() => setHover(i)}
              style={{
                flex: 1,
                height: `${pct}%`,
                backgroundColor: hover === i ? color : `${color}b3`,
                boxShadow: hover === i ? `0 0 10px ${color}` : 'none',
                transformOrigin: 'bottom',
                animation: `orca-bar-grow 0.5s cubic-bezier(0.22,1,0.36,1) both`,
                animationDelay: `${i * 22}ms`,
                transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>

      {/* Time axis */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 5,
          fontSize: 9,
          fontFamily: 'ui-monospace, monospace',
          color: 'var(--orca-text-muted)',
        }}
      >
        <span>{bars[0]?.time}</span>
        <span>{bars[Math.floor(bars.length / 2)]?.time}</span>
        <span>{bars[bars.length - 1]?.time}</span>
      </div>

      <style>{`
        @keyframes orca-bar-grow {
          from { transform: scaleY(0.04); opacity: 0.2; }
          to   { transform: scaleY(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ForecastStrip;
