// MapLibreGLMap.tsx
import React, { useContext, useEffect, useState, useRef, useCallback } from "react";
import extent from "turf-extent";
import { featureCollection } from "@turf/helpers";
import "maplibre-gl/dist/maplibre-gl.css";
import { addressPointPaint, startPointColor, endPointColor, routePaint } from '../utils/style';
import { mapStyle } from '../utils/style';
import { AddressContext } from '../contexts/AddressContext';
import { RouteContext } from '../contexts/RouteContext';
import maplibregl from 'maplibre-gl';
import { IMapFeature, IRouteData } from '../types/interfaces';

const styles: React.CSSProperties = {
  height: '100vh',
  flex: 1
};

const center: [number, number] = [-73.978159, 40.759975];
const zoom: number = 10;

const MapLibreGLMap: React.FC = () => {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);

  const { startAddress, endAddress, toggleEnabled } = useContext(AddressContext);
  const { route, selectedStreet } = useContext(RouteContext);

  const zoomToExtent = useCallback((geom: IMapFeature[]) => {
    const features = geom.filter(item => item);
    if (features.length && map) {
      if (features.length === 1 && features[0].geometry.type === 'Point') {
        map.flyTo({
          center: features[0].geometry.coordinates as [number, number],
          zoom: 14
        });
      } else {
        const fc = featureCollection(features);
        const bounds = extent(fc);
        map.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [map]);

  const setPoint = useCallback((position: 'start' | 'end', data: IMapFeature) => {
    if (!map) return;

    const mapLayerID = `${position}PointLayer`;
    const mapSourceID = `${position}PointSource`;
    const mapLayer = map.getLayer(mapLayerID);
    if (!mapLayer) {
      map.addSource(mapSourceID, {
        type: 'geojson',
        data: data
      } as maplibregl.GeoJSONSourceOptions);
      map.addLayer({
        id: mapLayerID,
        type: 'circle',
        source: mapSourceID,
        paint: {
          ...addressPointPaint,
          "circle-color": position === 'start' ? startPointColor : endPointColor
        },
      });
    } else {
      const source = map.getSource(mapSourceID) as maplibregl.GeoJSONSource;
      source.setData(data);
    }

    const features: IMapFeature[] = [];
    if (startAddress && startAddress.geometry) {
      features.push(startAddress as IMapFeature);
    }
    if (endAddress && endAddress.geometry) {
      features.push(endAddress as IMapFeature);
    }
    zoomToExtent(features);
  }, [map, startAddress, endAddress, zoomToExtent]);

  const setRoute = useCallback((data: IRouteData) => {
    if (!map) return;
    const { features } = data;
    if (!features) return;

    const mapLayerID = `routeLayer`;
    const mapSourceID = `routeSource`;
    const mapLayer = map.getLayer(mapLayerID);
    if (!mapLayer) {
      map.addSource(mapSourceID, {
        type: 'geojson',
        data: {
          type: "FeatureCollection",
          features: features
        }
      } as maplibregl.GeoJSONSourceOptions);
      map.addLayer({
        id: mapLayerID,
        type: 'line',
        source: mapSourceID,
        paint: routePaint
      });
    } else {
      const source = map.getSource(mapSourceID) as maplibregl.GeoJSONSource;
      source.setData({
        type: "FeatureCollection",
        features: features
      });
    }
    zoomToExtent(features);
  }, [map, zoomToExtent]);

  const removeLayerandSource = useCallback((layer: string, source: string) => {
    if (!map) return;
    if (map.getLayer(layer)) {
      map.removeLayer(layer);
    }
    if (map.getSource(source)) {
      map.removeSource(source);
    }
  }, [map]);

  const clearMap = useCallback(() => {
    removeLayerandSource('startPointLayer', 'startPointSource');
    removeLayerandSource('endPointLayer', 'endPointSource');
    removeLayerandSource('routeLayer', 'routeSource');
    if (map) {
      map.flyTo({ center, zoom });
    }
  }, [map, removeLayerandSource]);

  useEffect(() => {
    const initializeMap = ({
      setMap,
      mapContainer
    }: {
      setMap: React.Dispatch<React.SetStateAction<maplibregl.Map | null>>,
      mapContainer: React.RefObject<HTMLDivElement>
    }) => {
      if (!mapContainer.current) return;

      const mapLibreMap = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://layers-api.planninglabs.nyc/v1/base/style.json",
        center,
        zoom
      });
      mapLibreMap.on("load", () => {
        setMap(mapLibreMap);
        toggleEnabled();
        mapLibreMap.resize();
      });
    };
    if (!map) {
      initializeMap({ setMap, mapContainer });
    }
  }, [map, toggleEnabled]);

  useEffect(() => {
    if (map && startAddress && startAddress.geometry) {
      console.log("startAddress", startAddress);
      setPoint('start', startAddress as IMapFeature);
    }
  }, [startAddress, map, setPoint]);

  useEffect(() => {
    if (map && endAddress && endAddress.geometry) {
      setPoint('end', endAddress as IMapFeature);
    }
  }, [endAddress, map, setPoint]);

  useEffect(() => {
    if (map && selectedStreet && selectedStreet.geometry) {
      zoomToExtent([selectedStreet as IMapFeature]);
    }
  }, [selectedStreet, map, zoomToExtent]);

  useEffect(() => {
    if (map && route && route.features && route.features.length) {
      setRoute(route);
    } else if (map && (!route || !route.features)) {
      clearMap();
    }
  }, [route, map, setRoute, clearMap]);

  return <div ref={mapContainer} style={styles} />;
};

export default MapLibreGLMap;
