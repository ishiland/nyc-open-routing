import React, { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import maplibregl from 'maplibre-gl'; // Import maplibregl for Map type
import { addressPointPaint } from '../../utils/style';
import useFilteredLayer, { FilteredLayerOptions } from '../../hooks/useFilteredLayer';

interface AddressPointLayerProps {
  map: maplibregl.Map | null;
  sourceId: string;
  featureType: 'start' | 'end';
}

/**
 * Component that manages a map layer for start or end address points
 */
const AddressPointLayer: React.FC<AddressPointLayerProps> = React.memo(({
  map,
  sourceId,
  featureType,
}) => {
  const theme = useTheme();
  const layerId = `${featureType}PointLayer`;
  
  // Get color based on point type from theme
  const color = featureType === 'start' 
    ? theme.map.startPoint.color 
    : theme.map.endPoint.color;

  const paintProperties = useMemo(() => ({
    ...addressPointPaint,
    'circle-color': color,
  }), [color, addressPointPaint]); // Added addressPointPaint to memo dependencies for stability

  const layerOptions: FilteredLayerOptions = useMemo(() => ({
    type: 'circle',
    paint: paintProperties,
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'featureType'], featureType]],
  }), [paintProperties, featureType]);

  useFilteredLayer(
    map,
    sourceId,
    layerId,
    layerOptions
  );

  return null;
});

export default AddressPointLayer; 