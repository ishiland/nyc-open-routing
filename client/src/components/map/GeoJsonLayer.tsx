import React, { useEffect } from 'react';
import useGeoJsonLayer from '../../hooks/useGeoJsonLayer';
import { IMapFeature } from '../../types/interfaces';

interface GeoJsonLayerProps {
  map: maplibregl.Map | null;
  sourceId: string;
  layerId: string;
  data: IMapFeature | IMapFeature[] | null;
  layerType: 'circle' | 'line' | 'fill' | 'symbol';
  paintProperties: Record<string, any>;
  layoutProperties?: Record<string, any>;
  onFeatureUpdate?: (features: IMapFeature[]) => void;
}

/**
 * Generic component that manages a GeoJSON layer on the map
 */
const GeoJsonLayer: React.FC<GeoJsonLayerProps> = ({
  map,
  sourceId,
  layerId,
  data,
  layerType,
  paintProperties,
  layoutProperties,
  onFeatureUpdate
}) => {
  // Create the layer using our custom hook
  useGeoJsonLayer(map, sourceId, layerId, data, {
    type: layerType,
    paint: paintProperties,
    layout: layoutProperties
  });

  // Call onFeatureUpdate when data changes
  useEffect(() => {
    if (data && onFeatureUpdate) {
      const features = Array.isArray(data) ? data : [data];
      const validFeatures = features.filter(feature => feature && feature.geometry);
      if (validFeatures.length > 0) {
        onFeatureUpdate(validFeatures);
      }
    }
  }, [data, onFeatureUpdate]);

  // This is a non-visual component that just manages a map layer
  return null;
};

export default GeoJsonLayer; 