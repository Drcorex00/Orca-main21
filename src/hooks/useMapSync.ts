import { useState, useCallback, useRef } from 'react';
import { MapViewport, GeoJSONLayer } from '../types';
import { getOceanLayers } from '../lib/orca.functions';
import { restrictedAreas } from '../data/restrictedAreas';

export const useMapSync = () => {
  const [viewport, setViewport] = useState<MapViewport>({
    latitude: 18.5,
    longitude: 73.0,
    zoom: 6,
  });

  const [layers, setLayers] = useState<GeoJSONLayer[]>([
    {
      id: 'restricted-layer',
      label: 'Restricted Areas',
      type: 'restricted',
      visible: true,
      data: restrictedAreas(),
    },
  ]);
  const [layersLoading, setLayersLoading] = useState(false);
  const requestId = useRef(0);

  /** Merge new layers in, preserving user visibility toggles. */
  const merge = useCallback((incoming: GeoJSONLayer[]) => {
    setLayers((prev) => {
      const next = [...prev];
      for (const layer of incoming) {
        const idx = next.findIndex((l) => l.id === layer.id);
        if (idx >= 0) next[idx] = { ...layer, visible: next[idx]!.visible };
        else next.push(layer);
      }
      return next;
    });
  }, []);

  const addLayer = useCallback((layer: GeoJSONLayer) => {
    setLayers(prev => [...prev.filter(l => l.id !== layer.id), layer]);
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.filter(l => l.id !== layerId));
  }, []);

  const toggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  }, []);

  /** Publish (or replace) the planned sea route and its hazard markers. */
  const setRouteLayer = useCallback((data: any | null) => {
    setLayers(prev => {
      const rest = prev.filter(l => l.id !== 'route-layer');
      if (!data) return rest;
      return [
        ...rest,
        { id: 'route-layer', label: 'Route & Hazards', type: 'route', visible: true, data },
      ];
    });
  }, []);

  /**
   * Pull real gridded sea temperature, chlorophyll and derived fishing zones
   * around a resolved location and publish them as map layers.
   */
  const refreshOceanLayers = useCallback(async (lat: number, lon: number) => {
    const id = ++requestId.current;
    setLayersLoading(true);
    try {
      const result = await getOceanLayers({ data: { lat, lon } });
      if (id !== requestId.current) return;

      const incoming: GeoJSONLayer[] = [
        {
          id: 'pfz-layer',
          label: 'Fishing Zones (PFZ)',
          type: 'pfz',
          visible: true,
          data: result.pfz,
        },
        {
          id: 'chl-layer',
          label: 'Chlorophyll-a',
          type: 'chlorophyll',
          visible: false,
          data: result.chlorophyll,
        },
        {
          id: 'sst-layer',
          label: 'Sea Temperature',
          type: 'sst',
          visible: false,
          data: result.sst,
        },
      ].filter((l) => (l.data?.features?.length ?? 0) > 0) as GeoJSONLayer[];

      merge(incoming);
      return result;
    } catch {
      return null;
    } finally {
      if (id === requestId.current) setLayersLoading(false);
    }
  }, [merge]);

  const flyTo = useCallback((lat: number, lon: number, zoom?: number) => {
    setViewport(prev => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      zoom: zoom ?? Math.max(prev.zoom, 7),
    }));
  }, []);

  const fitBounds = useCallback((bbox: [number, number, number, number]) => {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    setViewport(prev => ({
      ...prev,
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
    }));
  }, []);

  const getViewportBounds = useCallback((): [number, number, number, number] => {
    const off = 10 / viewport.zoom;
    return [
      viewport.longitude - off,
      viewport.latitude - off,
      viewport.longitude + off,
      viewport.latitude + off,
    ];
  }, [viewport]);

  const clearLayers = useCallback(() => setLayers([]), []);

  return {
    viewport,
    setViewport,
    layers,
    layersLoading,
    addLayer,
    removeLayer,
    toggleLayer,
    refreshOceanLayers,
    flyTo,
    fitBounds,
    getViewportBounds,
    clearLayers,
    setRouteLayer,
  };
};
