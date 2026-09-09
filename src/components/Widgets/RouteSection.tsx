import React from 'react';
import type { FishingRoute } from '../../lib/orca.functions';

const label: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--orca-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'ui-monospace, monospace',
};

const sevColor = (s: string) =>
  s === 'danger' ? 'var(--orca-danger, #ef4444)' : s === 'warning' ? 'var(--orca-warning)' : 'var(--orca-text-muted)';

export const RouteSection: React.FC<{
  route: FishingRoute | null;
  onShowOnMap?: (() => void) | undefined;
}> = ({ route, onShowOnMap }) => {
  if (!route) {
    return (
      <div className="anim-fade-in" style={{
        border: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: 'var(--orca-bg-surface)',
        padding: '18px 16px',
        color: 'var(--orca-text-muted)',
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        <div style={label}>Route & Hazards</div>
        <div style={{ marginTop: 8 }}>
          No route planned yet. Ask something like “Where can I fish near Kochi?” and the safest sea
          path with live hazards will appear here.
        </div>
      </div>
    );
  }

  const danger = route.hazards.some(h => h.severity === 'danger');
  const stats: [string, string][] = [
    ['Distance', route.distanceNm.toFixed(1) + ' nm'],
    ['Bearing', Math.round(route.bearingDeg) + '°'],
    ['Speed', route.speedKn + ' kn'],
    ['ETA', route.etaHours.toFixed(1) + ' h'],
  ];

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        border: `1px solid ${danger ? 'var(--orca-danger, #ef4444)' : 'rgba(255,255,255,0.07)'}`,
        backgroundColor: 'var(--orca-bg-surface)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={label}>Destination</div>
            <div style={{ fontSize: 13, color: 'var(--orca-text-primary)', marginTop: 2 }}>
              {route.zone?.name ?? route.to.name ?? 'Fishing zone'}
            </div>
            {route.zone && (
              <div style={{ fontSize: 11, color: 'var(--orca-text-muted)', marginTop: 2 }}>
                {route.zone.species} · {route.zone.confidence} confidence
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className={danger ? 'anim-pulse' : undefined}
              style={{
                fontSize: 9,
                padding: '3px 7px',
                border: `1px solid ${danger ? 'var(--orca-danger, #ef4444)' : 'rgba(255,255,255,0.25)'}`,
                color: danger ? 'var(--orca-danger, #ef4444)' : 'var(--orca-success)',
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              {danger ? 'HAZARDOUS' : 'CLEAR'}
            </span>
            {onShowOnMap && (
              <button
                onClick={onShowOnMap}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'var(--orca-accent)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  fontFamily: 'ui-monospace, monospace',
                  padding: '3px 7px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'border-color 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                SHOW ON MAP
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {stats.map(([k, v], i) => (
            <div
              key={k}
              className="anim-slide-up"
              style={{
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '7px 8px',
                animationDelay: i * 60 + 'ms',
                animationFillMode: 'both',
              }}
            >
              <div style={label}>{k}</div>
              <div style={{
                fontSize: 13, color: 'var(--orca-text-primary)',
                fontFamily: 'ui-monospace, monospace', marginTop: 3,
              }}>
                {v}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          fontSize: 11,
          lineHeight: 1.5,
          color: danger ? 'var(--orca-danger, #ef4444)' : 'var(--orca-text-secondary)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 8,
        }}>
          {route.advisory}
        </div>

        {!route.clearOfRestrictedAreas && (
          <div style={{ fontSize: 11, color: 'var(--orca-warning)' }}>
            Route was adjusted to stay clear of restricted areas.
          </div>
        )}
      </div>

      <div style={{
        border: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: 'var(--orca-bg-surface)',
        padding: '10px 12px',
      }}>
        <div style={label}>Hazards along the way</div>
        {route.hazards.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--orca-text-muted)', marginTop: 8 }}>
            No lightning, gust, wave, visibility or rain hazards detected on this path.
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {route.hazards.map((h, i) => (
              <div
                key={i}
                className="anim-slide-up"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: '7px 8px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  animationDelay: i * 55 + 'ms',
                  animationFillMode: 'both',
                }}
              >
                <span
                  className={h.severity === 'danger' ? 'anim-pulse' : undefined}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                    backgroundColor: sevColor(h.severity),
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--orca-text-primary)', lineHeight: 1.45 }}>
                    {h.message}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--orca-text-muted)', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
                    {h.atNm.toFixed(0)} nm out · {h.kind}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteSection;
