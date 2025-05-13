import { useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { IMapFeature } from '../types/interfaces';
import { removeMapLayerAndSource } from '../utils/mapHelpers';

// Type-safe layer options based on maplibregl types
interface LayerOptions {
  type: 'circle' | 'line' | 'fill' | 'symbol';
  paint: Record<string, any>;
  layout?: Record<string, any>;
}

/**
 * Custom hook to manage a GeoJSON layer on a MapLibre GL map
 */
const useGeoJsonLayer = (
  map: maplibregl.Map | null,
  sourceId: string,
  layerId: string,
  data: IMapFeature | IMapFeature[] | null,
  layerOptions: LayerOptions
) => {
  // Convert single feature to feature collection if needed
  const normalizeData = useCallback((inputData: IMapFeature | IMapFeature[] | null) => {
    if (!inputData) return null;
    
    const features = Array.isArray(inputData) ? inputData : [inputData];
    return {
      type: "FeatureCollection" as const,
      features: features.filter(f => f)
    };
  }, []);

  // Add or update layer
  useEffect(() => {
    if (!map || !map.loaded()) return;
    
    const normalizedData = normalizeData(data);
    if (!normalizedData) {
      // Remove layer and source if no data
      removeMapLayerAndSource(map, layerId, sourceId);
      return;
    }

    // If layer already exists, just update the data
    if (map.getStyle() && map.getLayer(layerId)) {
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(normalizedData as GeoJSON.FeatureCollection<GeoJSON.Geometry>);
      }
    } else {
      // Add new source and layer
      try {
        // First add the source
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: normalizedData
          });
        }
        
        // Then add the layer with the correct type casting
        const mapLayer: any = {
          id: layerId,
          type: layerOptions.type,
          source: sourceId,
          paint: layerOptions.paint
        };
        
        if (layerOptions.layout) {
          mapLayer.layout = layerOptions.layout;
        }
        
        map.addLayer(mapLayer);
      } catch (error) {
        console.error("Error adding layer or source:", error);
      }
    }
  }, [map, sourceId, layerId, data, layerOptions, normalizeData]);

  // Return a function to remove the layer and source
  const removeLayer = useCallback(() => {
    if (!map) return;
    removeMapLayerAndSource(map, layerId, sourceId);
  }, [map, layerId, sourceId]);

  return { removeLayer };
};

export default useGeoJsonLayer; 