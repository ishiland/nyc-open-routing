import React, { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import maplibregl from 'maplibre-gl'; // Import maplibregl for Map type
import useFilteredLayer, { FilteredLayerOptions } from '../../hooks/useFilteredLayer';

interface RouteLayerProps {
  map: maplibregl.Map | null;
  sourceId: string;
}

const RouteLayer: React.FC<RouteLayerProps> = React.memo(({
  map,
  sourceId,
}) => {
  const theme = useTheme();
  const layerId = 'routeLayer';

  const paintProperties = useMemo(() => ({
    'line-width': theme.map.route.width,
    'line-color': theme.map.route.color,
  }), [theme.map.route.width, theme.map.route.color]);

  const layerOptions: FilteredLayerOptions = useMemo(() => ({
    type: 'line',
    paint: paintProperties,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'featureType'], 'routeSegment']],
  }), [paintProperties]);

  useFilteredLayer(
    map,
    sourceId,
    layerId,
    layerOptions
  );

  return null;
});

export default RouteLayer; 