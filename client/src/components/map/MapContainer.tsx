// MapContainer.tsx
import React, { useRef, useCallback, useEffect, useContext } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl'; // Import maplibregl for types
import useMapInit from '../../hooks/useMapInit';
import useMapZoom from '../../hooks/useMapZoom';
import { MapContext } from '../../contexts/MapContext';
import AddressPointLayer from './AddressPointLayer';
import RouteLayer from './RouteLayer';
import { IMapFeature, RouteFeature } from '../../types/interfaces'; // Keep RouteFeature if selectedStreet uses it

const defaultCenter: [number, number] = [-73.978159, 40.759975];
const defaultZoom: number = 10;
const COMMON_SOURCE_ID = 'common-geojson-source';

/**
 * Main map container component that coordinates all map layers
 */
const MapContainer: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  
  // Get context data from the consolidated MapContext
  const { 
    startAddress, 
    endAddress, 
    enableAddressInputs,
    route,
    selectedStreet
  } = useContext(MapContext);
  
  // Initialize map with the onMapLoad callback to enable address input
  const map = useMapInit(mapContainer, {
    initialCenter: defaultCenter,
    initialZoom: defaultZoom,
    onMapLoad: () => {
      enableAddressInputs();
    }
  });
    
  // Setup map zoom utilities
  const { zoomToExtent, resetZoom } = useMapZoom(map, {
    defaultCenter,
    defaultZoom
  });
  
  // Handler for when features are updated
  const handleFeaturesUpdate = useCallback((features: IMapFeature[]) => {
    if (features && features.length > 0) {
      zoomToExtent(features);
    }
  }, [zoomToExtent]);
  
  // Effect to add the common source once the map is loaded
  useEffect(() => {
    if (!map) return;

    const addSourceWhenReady = () => {
      if (map.isStyleLoaded() && !map.getSource(COMMON_SOURCE_ID)) {
        map.addSource(COMMON_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
    };

    if (map.isStyleLoaded()) {
      addSourceWhenReady();
    } else {
      map.once('load', addSourceWhenReady);
    }
  }, [map]);
  
  // Effect to update the source data and trigger zoom
  useEffect(() => {
    if (!map || !map.getSource(COMMON_SOURCE_ID)) return;

    const source = map.getSource(COMMON_SOURCE_ID) as maplibregl.GeoJSONSource;
    const currentFeatures: IMapFeature[] = [];

    if (startAddress && startAddress.geometry) {
      currentFeatures.push({
        ...startAddress,
        properties: { ...(startAddress.properties || {}), featureType: 'start' }
      });
    }
    if (endAddress && endAddress.geometry) {
      currentFeatures.push({
        ...endAddress,
        properties: { ...(endAddress.properties || {}), featureType: 'end' }
      });
    }
    if (route && route.features) {
      route.features.forEach(f => {
        if (f && f.geometry) {
          const routeFeature = f as unknown as IMapFeature;
          currentFeatures.push({
            ...routeFeature,
            properties: { ...(routeFeature.properties || {}), featureType: 'routeSegment' }
          });
        }
      });
    }

    const geoJsonDataPayload: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: currentFeatures
    };

    source.setData(geoJsonDataPayload);

    const validFeaturesForZoom = currentFeatures.filter(f => f && f.geometry);
    if (validFeaturesForZoom.length > 0) {
      handleFeaturesUpdate(validFeaturesForZoom);
    }
  }, [map, startAddress, endAddress, route, handleFeaturesUpdate]);
  
  // Effect for when the selected street changes
  useEffect(() => {
    if (selectedStreet && map && selectedStreet.geometry) {
      const streetFeature = selectedStreet as unknown as IMapFeature;
      zoomToExtent([streetFeature]);
    }
  }, [selectedStreet, map, zoomToExtent]);
  
  // Effect for when the route is cleared
  useEffect(() => {
    if (!route || !route.features || route.features.length === 0) {
      resetZoom();
    }
  }, [route, resetZoom]);
    
  return (
    <div 
      ref={mapContainer} 
      style={{
        height: '100vh',
        flex: 1,
        position: 'relative'
      }}
    >
      {map && map.getSource(COMMON_SOURCE_ID) && (
        <>
          <AddressPointLayer 
            map={map}
            sourceId={COMMON_SOURCE_ID}
            featureType="start"
          />
          
          <AddressPointLayer 
            map={map}
            sourceId={COMMON_SOURCE_ID}
            featureType="end"
          />
          
          <RouteLayer
            map={map}
            sourceId={COMMON_SOURCE_ID}
          />
        </>
      )}
    </div>
  );
};

export default MapContainer; 