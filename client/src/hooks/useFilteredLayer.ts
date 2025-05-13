import { useEffect, useMemo } from 'react';
import maplibregl, { Map } from 'maplibre-gl';

// Define a stable empty object for default paint/layout
const EMPTY_OBJECT = {};

export interface FilteredLayerOptions {
  type: 'circle' | 'line' | 'fill' | 'symbol';
  paint?: any;
  layout?: any;
  filter?: any[];
}

/**
 * Custom hook to add and manage a layer on the map from an existing source.
 * The layer is defined by its type, paint/layout properties, and a filter.
 */
const useFilteredLayer = (
  map: Map | null,
  sourceId: string,
  layerId: string,
  options: FilteredLayerOptions
) => {
  // Memoize options to prevent unnecessary effect runs if the object reference changes but content is the same.
  const stableOptions = useMemo(() => options, [
    options.type,
    options.filter,
    options.paint,
    options.layout
  ]);

  useEffect(() => {
    if (map && map.isStyleLoaded() && map.getSource(sourceId)) {
      const existingLayer = map.getLayer(layerId);

      if (existingLayer) {
        map.removeLayer(layerId);
      }
      
      map.addLayer({
        id: layerId,
        source: sourceId,
        type: stableOptions.type,
        paint: stableOptions.paint || EMPTY_OBJECT,
        layout: stableOptions.layout || EMPTY_OBJECT,
        filter: stableOptions.filter,
      } as maplibregl.LayerSpecification);

      return () => {
        if (map && map.getLayer(layerId)) {
          try {
            map.removeLayer(layerId);
          } catch (e) {
            console.warn(`Error removing layer ${layerId}:`, e);
          }
        }
      };
    }
  }, [map, sourceId, layerId, stableOptions]);
};

export default useFilteredLayer; 