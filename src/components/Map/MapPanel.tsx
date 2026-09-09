import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature } from 'geojson';
import { MapViewport, GeoJSONLayer, MarineData } from '../../types';
import LayerControls from './LayerControls';
import MapClickHandler from './MapClickHandler';

interface MapPanelProps {
  viewport?: MapViewport;
  onViewportChange?: (viewport: MapViewport) => void;
  layers?: GeoJSONLayer[];
  onToggleLayer?: (layerId: string) => void;
  onMapClick?: (lat: number, lon: number) => void;
  marineData?: MarineData;
  /** Location resolved from a question — pinned and flown to with animation. */
  focus?: { lat: number; lon: number; name?: string } | null;
}

const DEFAULT_VIEWPORT: MapViewport = { longitude: 73.0, latitude: 18.5, zoom: 6 };



const sstColor = (t: number) =>
  t >= 31 ? '#dc2626' : t >= 29.5 ? '#f97316' : t >= 28 ? '#eab308' :
  t >= 26.5 ? '#a3a3a3' : t >= 25 ? '#2563eb' : '#1e3a8a';

const chlColor = (c: number) =>
  c >= 5 ? '#065f46' : c >= 2 ? '#10b981' : c >= 1 ? '#65a30d' :
  c >= 0.5 ? '#a3a370' : c >= 0.2 ? '#6b7280' : '#3f4756';

function styleFor(layer: GeoJSONLayer, feature?: Feature): L.PathOptions {
  const p = (feature?.properties ?? {}) as Record<string, any>;
  switch (layer.type) {
    case 'pfz':
      return {
        color: p.confidence === 'High' ? '#ffffff' : 'rgba(255,255,255,0.6)',
        weight: p.confidence === 'High' ? 2 : 1,
        fillColor: '#c9c9c9',
        fillOpacity: p.confidence === 'High' ? 0.34 : p.confidence === 'Medium' ? 0.22 : 0.14,
      };
    case 'sst':
      return { color: 'rgba(0,0,0,0.15)', weight: 0.5, fillColor: sstColor(Number(p.sst ?? 27)), fillOpacity: 0.42 };
    case 'chlorophyll':
      return { color: 'rgba(0,0,0,0.15)', weight: 0.5, fillColor: chlColor(Number(p.chl ?? 0)), fillOpacity: 0.5 };
    case 'restricted':
      if (p.kind === 'boundary') return { color: '#dc2626', weight: 2.5, dashArray: '8 5', fillOpacity: 0 };
      if (p.kind === 'limit') return { color: '#f59e0b', weight: 1.6, dashArray: '4 6', fillOpacity: 0 };
      if (p.kind === 'protected') return { color: '#dc2626', weight: 1.4, fillColor: '#dc2626', fillOpacity: 0.16 };
      return { color: '#f59e0b', weight: 1.2, fillColor: '#f59e0b', fillOpacity: 0.12 };
    case 'route':
      if (p.kind === 'hazard') {
        const danger = p.severity === 'danger';
        return { color: danger ? '#dc2626' : '#f59e0b', weight: 2, fillColor: danger ? '#dc2626' : '#f59e0b', fillOpacity: 0.65 };
      }
      return { color: '#22d3ee', weight: 3, dashArray: '10 6', fillOpacity: 0 };
    case 'wave':
      return { color: '#8a8a8a', weight: 1, fillColor: '#8a8a8a', fillOpacity: 0.35 };
    default:
      return { color: '#ffffff', weight: 1, fillColor: '#ffffff', fillOpacity: 0.2 };
  }
}

const LABELS: Record<string, string> = {
  sst: 'Sea temp', chl: 'Chlorophyll', wave: 'Wave', name: 'Name',
  confidence: 'Confidence', species: 'Likely catch', chlorophyll: 'Chlorophyll',
  note: 'Note', issuer: 'Source', score: 'Score', kind: 'Type',
};

function tooltipHtml(props: Record<string, any>) {
  const rows = Object.entries(props)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const unit = k === 'sst' ? ' °C' : k === 'chl' ? ' mg/m³' : k === 'wave' && typeof v === 'number' ? ' m' : '';
      return `<div class="orca-tt-row"><span>${LABELS[k] ?? k}</span><span>${String(v)}${unit}</span></div>`;
    })
    .join('');
  return `<div class="orca-tt">${rows}</div>`;
}

/** Smooth fly-to whenever a new location is resolved. */
function FocusFlyer({ focus }: { focus?: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lon], 9, { duration: 1.6 });
  }, [focus?.lat, focus?.lon, map]);
  return null;
}

function ViewportReporter({
  onViewportChange,
  onCursor,
}: {
  onViewportChange?: (v: MapViewport) => void;
  onCursor: (p: { lat: number; lon: number } | null) => void;
}) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onViewportChange?.({ latitude: c.lat, longitude: c.lng, zoom: e.target.getZoom() });
    },
    mousemove: (e) => onCursor({ lat: e.latlng.lat, lon: e.latlng.lng }),
    mouseout: () => onCursor(null),
  });
  return null;
}

export default function MapPanel({
  viewport = DEFAULT_VIEWPORT,
  onViewportChange,
  layers = [],
  onToggleLayer,
  onMapClick,
  focus,
}: MapPanelProps) {
  const [cursorPos, setCursorPos] = useState<{ lat: number; lon: number } | null>(null);
  
  const [imageryTier, setImageryTier] = useState(0); // 0 = primary, 1 = fallback, 2 = none
  const tileErrors = useRef(0);
  const initial = useRef<MapViewport>(viewport);

  const maptilerKey = (import.meta.env['VITE_MAPTILER_KEY'] as string | undefined) ?? '';
  const imagery = maptilerKey
    ? [
        {
          url: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${maptilerKey}`,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
        },
        {
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
        },
      ]
    : [
        {
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
        },
        {
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors',
        },
      ];
  const activeImagery = imagery[imageryTier];

  const handleTileError = useCallback(() => {
    tileErrors.current += 1;
    if (tileErrors.current >= 6) {
      tileErrors.current = 0;
      setImageryTier((t) => Math.min(t + 1, 2));
    }
  }, []);

  const visible = useMemo(() => layers.filter((l) => l.visible && l.data), [layers]);

  const focusIcon = useMemo(
    () =>
      L.divIcon({
        className: 'orca-pin-icon',
        html: `<span class="orca-pin-ring"></span><span class="orca-pin-ring orca-pin-ring-delay"></span><span class="orca-pin-core"></span>${
          focus?.name ? `<span class="orca-pin-label">${focus.name}</span>` : ''
        }`,
        iconSize: [0, 0],
      }),
    [focus?.name],
  );

  const onEachFeature = useCallback((feature: Feature, layer: L.Layer) => {
    const props = (feature.properties ?? {}) as Record<string, any>;
    if (Object.keys(props).length === 0) return;
    layer.bindTooltip(tooltipHtml(props), { sticky: true, className: 'orca-tooltip', direction: 'top' });
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[initial.current.latitude, initial.current.longitude]}
        zoom={initial.current.zoom}
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%', backgroundColor: 'var(--orca-bg-primary)' }}
      >
        {activeImagery && (
          <>
            <TileLayer
              key={`imagery-${imageryTier}`}
              url={activeImagery.url}
              attribution={activeImagery.attribution}
              maxZoom={18}
              eventHandlers={{ tileerror: handleTileError }}
            />
            <TileLayer
              url="https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}@2x.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              opacity={0.85}
            />
          </>
        )}

        <ScaleControl position="bottomleft" metric imperial={false} />
        <ViewportReporter {...(onViewportChange ? { onViewportChange } : {})} onCursor={setCursorPos} />
        <FocusFlyer focus={focus ?? null} />

        {visible.map((layer) => (
          <GeoJSON
            key={`${layer.id}-${JSON.stringify(layer.data).length}`}
            data={layer.data}
            style={(feature) => styleFor(layer, feature as Feature)}
            onEachFeature={onEachFeature}
            pointToLayer={(feature, latlng) =>
              L.circleMarker(latlng, {
                radius: (feature.properties as any)?.severity === 'danger' ? 9 : 7,
                ...styleFor(layer, feature as Feature),
              })
            }
          />
        ))}

        {focus && <Marker position={[focus.lat, focus.lon]} icon={focusIcon} />}

        <MapClickHandler {...(onMapClick ? { onLocationSelect: onMapClick } : {})} />
      </MapContainer>

      {imageryTier >= 2 && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 500,
          backgroundColor: 'rgba(10,22,40,0.92)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--orca-warning)',
          padding: '4px 8px', fontSize: 10,
          fontFamily: 'ui-monospace, monospace', maxWidth: 200,
        }}>
          Satellite imagery unavailable right now.
        </div>
      )}



      {/* Cursor coordinates */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 500,
        backgroundColor: 'rgba(10,22,40,0.88)',
        border: '1px solid rgba(255,255,255,0.07)',
        color: 'var(--orca-text-muted)',
        padding: '3px 8px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        letterSpacing: '0.04em',
      }}>
        {cursorPos
          ? 'LAT ' + cursorPos.lat.toFixed(4) + '  LON ' + cursorPos.lon.toFixed(4)
          : 'LAT --  LON --'}
      </div>

      {/* Layer controls */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 500 }}>
        <LayerControls layers={layers} onToggleLayer={onToggleLayer ?? (() => {})} />
      </div>

      <style>{`
        .leaflet-container { font-family: ui-monospace, monospace; }
        .leaflet-control-attribution {
          background: rgba(10,22,40,0.7) !important;
          color: var(--orca-text-muted) !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: var(--orca-text-secondary) !important; }
        .leaflet-control-scale-line {
          background: rgba(10,22,40,0.7); color: var(--orca-text-muted);
          border-color: rgba(255,255,255,0.2); font-size: 9px;
        }
        .orca-tooltip {
          background: rgba(10,22,40,0.94) !important;
          border: 1px solid rgba(255,255,255,0.14) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: var(--orca-text-primary) !important;
          padding: 7px 9px !important;
          font-size: 11px;
        }
        .orca-tooltip::before { display: none !important; }
        .orca-tt-row { display: flex; justify-content: space-between; gap: 14px; }
        .orca-tt-row span:first-child { color: var(--orca-text-muted); }
        .orca-pin-icon { position: relative; width: 0 !important; height: 0 !important; }
        .orca-pin-core {
          position: absolute; left: -6px; top: -6px; width: 12px; height: 12px;
          border-radius: 50%; background: #c9c9c9;
          box-shadow: 0 0 12px rgba(255,255,255,0.9), 0 0 2px #0a1628;
          animation: orca-pin-drop 0.5s cubic-bezier(0.34,1.56,0.64,1);
        }
        .orca-pin-ring {
          position: absolute; left: -6px; top: -6px; width: 12px; height: 12px;
          border-radius: 50%; border: 2px solid rgba(255,255,255,0.8);
          animation: orca-radar 2.4s ease-out infinite;
        }
        .orca-pin-ring-delay { animation-delay: 1.2s; }
        .orca-pin-label {
          position: absolute; left: 14px; top: -9px; white-space: nowrap;
          font-family: ui-monospace, monospace; font-size: 10px; color: #c9c9c9;
          background: rgba(10,22,40,0.85); border: 1px solid rgba(255,255,255,0.35);
          padding: 2px 6px; letter-spacing: 0.05em;
        }
        @keyframes orca-radar {
          0%   { transform: scale(1);  opacity: 0.9; }
          100% { transform: scale(7);  opacity: 0; }
        }
        @keyframes orca-pin-drop {
          0%   { transform: scale(0) translateY(-16px); opacity: 0; }
          100% { transform: scale(1) translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
