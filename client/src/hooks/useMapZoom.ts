import { useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import extent from "turf-extent";
import { featureCollection } from "@turf/helpers";
import { IMapFeature } from '../types/interfaces';

interface UseMapZoomOptions {
  padding?: number;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

/**
 * Hook that provides map zoom functionality
 */
const useMapZoom = (
  map: maplibregl.Map | null, 
  {
    padding = 50,
    defaultCenter = [-73.978159, 40.759975],
    defaultZoom = 10
  }: UseMapZoomOptions = {}
) => {
  
  /**
   * Zoom to fit the provided features within the map view
   */
  const zoomToExtent = useCallback((geom: IMapFeature[]) => {
    if (!map || !map.loaded()) return;
    
    const features = geom?.filter(item => item && item.geometry) || [];
    if (!features.length) return;
    
    // Single point case
    if (features.length === 1 && features[0]?.geometry?.type === 'Point') {
      map.flyTo({
        center: features[0].geometry.coordinates as [number, number],
        zoom: 14
      });
      return;
    }
    
    // Multiple features case
    try {
      const fc = featureCollection(features);
      const bounds = extent(fc);
      map.fitBounds(bounds, { padding });
    } catch (error) {
      console.error("Error in zoomToExtent:", error);
    }
  }, [map, padding]);

  /**
   * Reset the map view to the default center and zoom
   */
  const resetZoom = useCallback(() => {
    if (!map || !map.loaded()) return;
    map.flyTo({ center: defaultCenter, zoom: defaultZoom });
  }, [map, defaultCenter, defaultZoom]);

  return { zoomToExtent, resetZoom };
};

export default useMapZoom; 