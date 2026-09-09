import React, { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatPanel from '../Chat/ChatPanel';
import MapPanel from '../Map/MapPanel';
import { TideChart } from '../Charts/TideChart';
import { OceanGrid } from '../Charts/OceanGrid';
import { OceanOverview } from '../Charts/OceanOverview';
import { ForecastStrip } from '../Charts/ForecastStrip';
import { SimpleGraph } from '../Charts/SimpleGraph';
import { FishingZonePanel } from '../Widgets/FishingZonePanel';
import type { LiveZone } from '../Widgets/FishingZonePanel';
import { RouteSection } from '../Widgets/RouteSection';
import { TideTable } from '../Widgets/TideTable';
import StatusBar from '../Widgets/StatusBar';
import { useChat } from '../../hooks/useChat';
import { useMapSync } from '../../hooks/useMapSync';
import { MarineData, GeoJSONLayer } from '../../types';
import type { WaveChartData } from '../Charts/WaveChart';
import type { OrcaQueryResult } from '../../services/orca';
import type { FishingRoute } from '../../lib/orca.functions';
import {
  mockWaveData, mockTideData, mockMarineData,
} from '../../data/mockData';

// Colour scales shared with the map layers
const sstColor = (t: number) =>
  t >= 31 ? '#dc2626' : t >= 29.5 ? '#f97316' : t >= 28 ? '#eab308' :
  t >= 26.5 ? '#a3a3a3' : t >= 25 ? '#2563eb' : '#1e3a8a';

const chlColor = (c: number) =>
  c >= 5 ? '#065f46' : c >= 2 ? '#10b981' : c >= 1 ? '#65a30d' :
  c >= 0.5 ? '#a3a370' : c >= 0.2 ? '#6b7280' : '#3f4756';

// ── Mobile breakpoint ──────────────────────────────────────────────────────────
const MOBILE_BP = 768;

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const MapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);
const DataIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

// Suppress unused import warnings for removed stat-card helpers
void mockTideData;
const SettingsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);



// ── Waves sub-tab ─────────────────────────────────────────────────────────────

const WavesSection: React.FC<{ data: WaveChartData[]; locationName?: string }> = ({ data, locationName }) => (
  <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* Animated line graph */}
    <div style={{
      border: '1px solid rgba(255,255,255,0.07)',
      backgroundColor: 'var(--orca-bg-surface)',
      padding: '12px 14px',
    }}>
      <SimpleGraph
        key={data.map(d => d.waveHeight).join(',')}
        data={data.slice(0, 24).map(d => ({ label: d.time, value: d.waveHeight }))}
        title={`Wave height · next 24 h${locationName ? ' · ' + locationName : ''}`}
        unit="m"
        threshold={2.5}
        thresholdLabel="2.5 m advisory"
        height={200}
      />
    </div>

    {/* 24-hour forecast strip (moved here from Overview) */}
    <div style={{
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <ForecastStrip data={data} height={130} locationName={locationName} />
    </div>
  </div>
);

// ── Data tab content (mobile) / Drawer content (desktop) ─────────────────────
type DataSubTab = 'overview' | 'waves' | 'tides' | 'sst' | 'chl' | 'pfz' | 'route';

interface DataContentProps {
  marineData: MarineData;
  waveChartData: WaveChartData[];
  locationName?: string;
  layers: GeoJSONLayer[];
  route: FishingRoute | null;
  origin?: { lat: number; lon: number } | null;
  onZoneSelect?: (zone: LiveZone) => void;
  onShowRouteOnMap?: () => void;
}

const DataContent: React.FC<DataContentProps> = ({
  marineData, waveChartData, locationName, layers, route, origin, onZoneSelect, onShowRouteOnMap,
}) => {
  const [tab, setTab] = useState<DataSubTab>('overview');

  const layerData = (id: string) => layers.find(l => l.id === id)?.data ?? null;

  const tabs: { id: DataSubTab; label: string }[] = [
    { id: 'overview', label: 'Overview'   },
    { id: 'waves',    label: 'Waves'      },
    { id: 'tides',    label: 'Tides'      },
    { id: 'sst',      label: 'SST'        },
    { id: 'chl',      label: 'Chlorophyll'},
    { id: 'pfz',      label: 'PFZ'        },
    { id: 'route',    label: 'Route'      },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: 'var(--orca-bg-secondary)',
        flexShrink: 0,
        padding: '0 4px',
        overflowX: 'auto',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--orca-accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
              padding: '8px 14px',
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {tab === 'overview' && (
          <OceanOverview
            marineData={marineData}
            locationName={locationName}
          />
        )}

        {tab === 'waves' && (
          <WavesSection
            data={waveChartData.length > 0 ? waveChartData : mockWaveData}
            locationName={locationName}
          />
        )}

        {tab === 'tides' && (
          <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TideTable data={mockTideData} title="Tide Heights" />
            <div style={{ height: 200 }}>
              <TideChart data={mockTideData} title="Tide Curve" />
            </div>
          </div>
        )}

        {tab === 'sst' && (
          <OceanGrid
            data={layerData('sst-layer')}
            valueKey="sst"
            unit=" °C"
            decimals={1}
            title="Sea surface temperature"
            {...(locationName ? { subtitle: 'Live grid around ' + locationName } : {})}
            colorFor={sstColor}
            legend={{
              min: '24°C',
              max: '32°C',
              gradient: 'linear-gradient(to right,#1e3a8a,#2563eb,#a3a3a3,#eab308,#f97316,#dc2626)',
            }}
            emptyHint="Ask about a place to load live sea temperature for that stretch of sea."
            note="Sharp temperature changes between neighbouring cells often mark fronts where fish gather."
          />
        )}

        {tab === 'chl' && (
          <OceanGrid
            data={layerData('chl-layer')}
            valueKey="chl"
            unit=" mg/m³"
            decimals={2}
            title="Chlorophyll-a"
            {...(locationName ? { subtitle: 'Live grid around ' + locationName } : {})}
            colorFor={chlColor}
            legend={{
              min: '0.1',
              max: '5+',
              gradient: 'linear-gradient(to right,#3f4756,#6b7280,#a3a370,#65a30d,#10b981,#065f46)',
            }}
            emptyHint="Ask about a place to load live chlorophyll readings for that stretch of sea."
            note="Greener water means more plankton — usually more bait fish, and better catch nearby."
          />
        )}

        {tab === 'pfz' && (
          <FishingZonePanel
            data={layerData('pfz-layer')}
            origin={origin ?? null}
            {...(locationName ? { locationName } : {})}
            {...(onZoneSelect ? { onZoneSelect } : {})}
          />
        )}

        {tab === 'route' && <RouteSection route={route} />}
      </div>
    </div>
  );
};

// ── Desktop data drawer ───────────────────────────────────────────────────────

const DesktopDrawer: React.FC<
  DataContentProps & { open: boolean; onToggle: () => void }
> = ({ open, onToggle, ...content }) => (
  <div style={{
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 20,
    backgroundColor: 'var(--orca-bg-secondary)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    height: open ? 320 : 32,
    transition: 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }}>
    {/* Toggle handle */}
    <button
      onClick={onToggle}
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        background: 'none',
        border: 'none',
        borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        color: 'var(--orca-text-muted)',
        cursor: 'pointer',
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        flexShrink: 0,
        width: '100%',
      }}
    >
      <svg
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
      <span>Data Panel</span>
      {!open && (
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>
          Click to expand
        </span>
      )}
    </button>

    {open && (
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataContent {...content} />
      </div>
    )}
  </div>
);

// ── Mobile bottom nav ─────────────────────────────────────────────────────────

type MobileTab = 'chat' | 'map' | 'data';

const MobileBottomNav: React.FC<{
  activeTab: MobileTab;
  onChange: (t: MobileTab) => void;
}> = ({ activeTab, onChange }) => {
  const tabs: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat', icon: <ChatIcon /> },
    { id: 'map',  label: 'Map',  icon: <MapIcon  /> },
    { id: 'data', label: 'Data', icon: <DataIcon /> },
  ];
  return (
    <div style={{
      height: 56,
      display: 'flex',
      backgroundColor: 'var(--orca-bg-secondary)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      flexShrink: 0,
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            borderTop: activeTab === t.id ? '2px solid var(--orca-accent)' : '2px solid transparent',
            color: activeTab === t.id ? 'var(--orca-accent)' : 'var(--orca-text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {t.icon}
          <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
};

// ── Header ────────────────────────────────────────────────────────────────────

const Header: React.FC<{ isStreaming: boolean }> = ({ isStreaming }) => (
  <header style={{
    height: 44,
    backgroundColor: 'var(--orca-bg-secondary)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    flexShrink: 0,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        fontWeight: 700, color: 'var(--orca-accent)', fontSize: 16,
        fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em',
      }}>
        ORCA
      </span>
      <span style={{ fontSize: 11, color: 'var(--orca-text-muted)' }}>
        Marine Intelligence
      </span>
      <span style={{
        fontSize: 9, padding: '2px 5px',
        border: '1px solid rgba(255,255,255,0.3)',
        color: 'var(--orca-accent)',
        fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em',
      }}>
        LIVE
      </span>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: isStreaming ? 'var(--orca-warning)' : 'var(--orca-success)',
          animation: isStreaming ? 'pulse-dot 1s infinite' : 'none',
        }} />
        {isStreaming && (
          <span style={{ fontSize: 10, color: 'var(--orca-text-muted)', fontFamily: 'ui-monospace, monospace' }}>
            Fetching
          </span>
        )}
      </div>
      <button style={{ background: 'none', border: 'none', color: 'var(--orca-text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
        <SettingsIcon />
      </button>
    </div>
  </header>
);

// ── Route summary overlay ─────────────────────────────────────────────────────

const RouteSummary: React.FC<{ route: FishingRoute; onClose: () => void }> = ({ route, onClose }) => {
  const danger = route.hazards.some(h => h.severity === 'danger');
  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'absolute', top: 12, right: 12, zIndex: 500, width: 268,
        backgroundColor: 'var(--orca-bg-surface)',
        border: `1px solid ${danger ? 'var(--orca-danger, #ef4444)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        fontSize: 12, color: 'var(--orca-text-primary)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--orca-text-muted)' }}>
          Sea route
        </span>
        <button
          onClick={onClose}
          aria-label="Hide route summary"
          style={{ background: 'none', border: 'none', color: 'var(--orca-text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '10px' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          {route.zone?.name ?? route.to.name ?? 'Fishing zone'}
        </div>
        {route.zone && (
          <div style={{ color: 'var(--orca-text-muted)', marginBottom: 8 }}>
            {route.zone.species} · {route.zone.confidence} confidence
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontFamily: 'ui-monospace, monospace' }}>
          <div>Distance<br /><strong>{route.distanceNm.toFixed(1)} nm</strong></div>
          <div>Bearing<br /><strong>{Math.round(route.bearingDeg)}°</strong></div>
          <div>Speed<br /><strong>{route.speedKn} kn</strong></div>
          <div>ETA<br /><strong>{route.etaHours.toFixed(1)} h</strong></div>
        </div>

        <div style={{
          marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)',
          color: danger ? 'var(--orca-danger, #ef4444)' : 'var(--orca-text-secondary, #cbd5e1)',
          lineHeight: 1.45,
        }}>
          {route.advisory}
        </div>

        {route.hazards.length > 0 && (
          <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: 'var(--orca-text-muted)', lineHeight: 1.5 }}>
            {route.hazards.slice(0, 4).map((h, i) => (
              <li key={i}>{h.atNm.toFixed(0)} nm · {h.message}</li>
            ))}
          </ul>
        )}

        {!route.clearOfRestrictedAreas && (
          <div style={{ marginTop: 8, color: 'var(--orca-warning)' }}>
            Route was adjusted to stay clear of restricted areas.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main layout ───────────────────────────────────────────────────────────────

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [chatWidthPct, setChatWidthPct] = useState(42);
  const [isDragging, setIsDragging]     = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(true);
  const [mobileTab, setMobileTab]       = useState<MobileTab>('chat');
  const [isMobile, setIsMobile]         = useState(() => window.innerWidth < MOBILE_BP);
  const [locationName, setLocationName] = useState<string | undefined>();
  const [mapFocus, setMapFocus] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [routeInfo, setRouteInfo] = useState<FishingRoute | null>(null);
  const chatWidthRef = useRef(chatWidthPct);

  // Live data
  const [liveMarineData, setLiveMarineData] = useState<MarineData>(mockMarineData);
  const [liveWaveChart, setLiveWaveChart]   = useState<WaveChartData[]>(mockWaveData);

  const { viewport, setViewport, layers, toggleLayer, flyTo, refreshOceanLayers, setRouteLayer } = useMapSync();

  const handleMarineData = useCallback((result: OrcaQueryResult) => {
    if (result.marineData)                                        setLiveMarineData(result.marineData);
    if (result.waveChartData && result.waveChartData.length > 0) setLiveWaveChart(result.waveChartData);
    if (result.locationCoords) {
      flyTo(result.locationCoords.lat, result.locationCoords.lon, 9);
      setMapFocus({
        lat: result.locationCoords.lat,
        lon: result.locationCoords.lon,
        ...(result.locationName ? { name: result.locationName } : {}),
      });
      void refreshOceanLayers(result.locationCoords.lat, result.locationCoords.lon);
    }
    if (result.route) {
      setRouteLayer(result.route.geojson);
      setRouteInfo(result.route);
    } else {
      setRouteLayer(null);
      setRouteInfo(null);
    }
    if (result.locationName)                                      setLocationName(result.locationName);
  }, [flyTo, refreshOceanLayers, setRouteLayer]);

  const {
    sessions, activeId, messages, isStreaming,
    safetyAlerts, userLocation, setUserLocation,
    sendMessage, newSession, switchSession, deleteSession, dismissAlert,
  } = useChat({ onMarineData: handleMarineData });

  // Responsive listener
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Drag-to-resize (desktop only)
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const sidebarWidth = sidebarOpen ? 248 : 44;
      const availableWidth = window.innerWidth - sidebarWidth;
      const chatPx = e.clientX - sidebarWidth;
      const pct = (chatPx / availableWidth) * 100;
      if (pct > 20 && pct < 78) {
        chatWidthRef.current = pct;
        setChatWidthPct(pct);
      }
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, sidebarOpen]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setUserLocation({ lat, lon });
    flyTo(lat, lon);
    setMapFocus({ lat, lon });
    void refreshOceanLayers(lat, lon);
  }, [flyTo, setUserLocation, refreshOceanLayers]);

  const handleZoneSelect = useCallback((zone: LiveZone) => {
    flyTo(zone.lat, zone.lon, 9);
    setMapFocus({ lat: zone.lat, lon: zone.lon, name: zone.name });
    if (isMobile) setMobileTab('map');
  }, [flyTo, isMobile]);

  const dataProps = {
    marineData: liveMarineData,
    waveChartData: liveWaveChart,
    ...(locationName ? { locationName } : {}),
    layers,
    route: routeInfo,
    origin: mapFocus ? { lat: mapFocus.lat, lon: mapFocus.lon } : userLocation ?? null,
    onZoneSelect: handleZoneSelect,
  };

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="orca-app-shell" style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--orca-bg-primary)',
        overflow: 'hidden',
      }}>
        <Header isStreaming={isStreaming} />

        {/* Panel container */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Chat */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: mobileTab === 'chat' ? 'flex' : 'none',
            flexDirection: 'column',
          }}>
            <ChatPanel
              messages={messages}
              onSendMessage={sendMessage}
              isStreaming={isStreaming}
              safetyAlerts={safetyAlerts}
              onDismissAlert={dismissAlert}
              attachedLocation={userLocation}
              onAttachLocation={setUserLocation}
            />
          </div>

          {/* Map */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: mobileTab === 'map' ? 'block' : 'none',
          }}>
            <MapPanel
              viewport={viewport}
              onViewportChange={setViewport}
              layers={layers}
              onToggleLayer={toggleLayer}
              onMapClick={handleMapClick}
              marineData={liveMarineData}
              focus={mapFocus}
            />
            {routeInfo && <RouteSummary route={routeInfo} onClose={() => setRouteInfo(null)} />}
          </div>

          {/* Data */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: mobileTab === 'data' ? 'flex' : 'none',
            flexDirection: 'column',
            backgroundColor: 'var(--orca-bg-primary)',
            overflowY: 'auto',
          }}>
            <DataContent {...dataProps} />
          </div>
        </div>

        {/* Bottom nav */}
        <MobileBottomNav activeTab={mobileTab} onChange={setMobileTab} />
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div className="orca-app-shell" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--orca-bg-primary)',
      overflow: 'hidden',
    }}>
      <Header isStreaming={isStreaming} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          sessions={sessions}
          activeId={activeId}
          onNewSession={newSession}
          onSwitchSession={switchSession}
          onDeleteSession={deleteSession}
        />

        {/* Chat column */}
        <div style={{
          width: chatWidthPct + '%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            isStreaming={isStreaming}
            safetyAlerts={safetyAlerts}
            onDismissAlert={dismissAlert}
            attachedLocation={userLocation}
            onAttachLocation={setUserLocation}
          />
          <StatusBar
            location={locationName}
            isStreaming={isStreaming}
            lastUpdated={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={() => setIsDragging(true)}
          style={{
            width: 4,
            backgroundColor: isDragging ? 'var(--orca-accent)' : 'rgba(255,255,255,0.05)',
            cursor: 'col-resize',
            flexShrink: 0,
            transition: 'background-color 0.15s',
            zIndex: 10,
          }}
        />

        {/* Map + drawer column */}
        <div style={{
          flex: 1,
          position: 'relative',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {/* Map — height adjusts based on drawer */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: drawerOpen ? 320 : 32,
            transition: 'bottom 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <MapPanel
              viewport={viewport}
              onViewportChange={setViewport}
              layers={layers}
              onToggleLayer={toggleLayer}
              onMapClick={handleMapClick}
              marineData={liveMarineData}
              focus={mapFocus}
            />
            {routeInfo && <RouteSummary route={routeInfo} onClose={() => setRouteInfo(null)} />}
          </div>

          {/* Data drawer */}
          <DesktopDrawer
            open={drawerOpen}
            onToggle={() => setDrawerOpen(o => !o)}
            {...dataProps}
          />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
