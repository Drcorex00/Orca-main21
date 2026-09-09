import { useEffect, useRef, useState } from 'react';
import { Popup, useMap, useMapEvents } from 'react-leaflet';

interface MapClickHandlerProps {
  onLocationSelect?: (lat: number, lon: number) => void;
}

/** Pixels of pointer travel that still counts as a click rather than a pan. */
const CLICK_SLOP = 5;

export default function MapClickHandler({ onLocationSelect }: MapClickHandlerProps) {
  const [clickPos, setClickPos] = useState<{ lat: number; lon: number } | null>(null);
  const map = useMap();
  const dragging = useRef(false);
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);
  const movedTooFar = useRef(false);

  // Track pointer travel on the map container so a pan never opens the bubble.
  useEffect(() => {
    const el = map.getContainer();
    const onDown = (e: PointerEvent) => {
      downAt.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      movedTooFar.current = false;
    };
    const onMove = (e: PointerEvent) => {
      const d = downAt.current;
      if (!d) return;
      if (Math.abs(e.clientX - d.x) > CLICK_SLOP || Math.abs(e.clientY - d.y) > CLICK_SLOP) {
        movedTooFar.current = true;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClickPos(null);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [map]);

  useMapEvents({
    dragstart: () => { dragging.current = true; },
    dragend: () => {
      dragging.current = false;
      setClickPos(null);
    },
    zoomstart: () => setClickPos(null),
    movestart: () => { if (dragging.current) setClickPos(null); },
    click: (e) => {
      // Ignore pans, long presses and clicks that land on map furniture
      // (markers, zone shapes, layer buttons, the popup itself).
      if (dragging.current || movedTooFar.current) return;
      const down = downAt.current;
      if (down && Date.now() - down.t > 700) return;

      const target = (e.originalEvent as MouseEvent | undefined)?.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          '.leaflet-marker-icon, .leaflet-interactive, .leaflet-popup, .leaflet-control, button',
        )
      ) {
        return;
      }

      setClickPos({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });

  if (!clickPos) return null;

  return (
    <Popup
      position={[clickPos.lat, clickPos.lon]}
      closeButton={false}
      autoPan={false}
      className="orca-popup"
      eventHandlers={{ remove: () => setClickPos(null) }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'var(--orca-bg-surface)',
        padding: '12px',
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
        <div style={{ color: 'var(--orca-text-primary)', fontSize: '13px' }}>
          Use this location?
        </div>
        <div style={{ color: 'var(--orca-text-muted)', fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
          {clickPos.lat.toFixed(4)}, {clickPos.lon.toFixed(4)}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          <button
            onClick={() => {
              onLocationSelect?.(clickPos.lat, clickPos.lon);
              setClickPos(null);
            }}
            style={{
              backgroundColor: 'var(--orca-bg-tertiary)',
              color: 'var(--orca-text-primary)',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Confirm
          </button>
          <button
            onClick={() => setClickPos(null)}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--orca-text-secondary)',
              border: '1px solid transparent',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`
        .orca-popup .leaflet-popup-content-wrapper {
          background: transparent; border-radius: 0; box-shadow: none; padding: 0;
        }
        .orca-popup .leaflet-popup-content { margin: 0; }
        .orca-popup .leaflet-popup-tip { display: none; }
      `}</style>
    </Popup>
  );
}
