import React, { useContext, useEffect, useState, useRef, useCallback } from "react";
import extent from "turf-extent";
import { featureCollection } from "@turf/helpers";
import "mapbox-gl/dist/mapbox-gl.css";
import { addressPointPaint, startPointColor, endPointColor, routePaint } from '../utils/style'
import { mapStyle } from '../utils/style'
import { AddressContext } from '../contexts/AddressContext';
import { RouteContext } from '../contexts/RouteContext';

const mapboxgl = require('mapbox-gl');

// Not needed since we are using DCP OSM tiles
// const token = 'MAPBOX-API-TOKEN' 

const styles = {
    height: '100vh',
    width: 'calc(100vw - 330px)',
    marginLeft: '330px'
};

const center = [-73.978159, 40.759975];
const zoom = 10;

const MapboxGLMap = () => {
    const [map, setMap] = useState(null);
    const mapContainer = useRef(null);

    const { startAddress, endAddress, toggleEnabled } = useContext(AddressContext);
    const { route, selectedStreet } = useContext(RouteContext);

    const zoomToExtent = useCallback((geom) => {
        const features = geom.filter(item => item); // remove undefined and empty items
        if (features.length) {
            if (features.length === 1 && features[0].geometry.type === 'Point') {
                // center on single point
                map.flyTo({
                    center: features[0].geometry.coordinates,
                    zoom: 14
                });
            }
            else {
                // zoom to bounds of updated features on map
                map.fitBounds(extent(featureCollection(features)), {
                    padding: 50 // {top:100, left:325, bottom:100, right:100},
                });
            }
        }
    }, [map]);

    const setPoint = useCallback((position, data) => {
        const mapLayerID = `${position}PointLayer`;
        const mapSourceID = `${position}PointSource`;
        const mapLayer = map.getLayer(mapLayerID);
        if (typeof mapLayer === 'undefined') {
            map.addSource(mapSourceID, {
                type: 'geojson',
                data
            });
            map.addLayer({
                id: mapLayerID,
                type: 'circle',
                source: `${position}PointSource`,
                "paint": {
                    ...addressPointPaint,
                    "circle-color": position === 'start' ? startPointColor : endPointColor
                },
            });
        }
        else {
            map.getSource(mapSourceID).setData(data)
        }

        zoomToExtent([
            startAddress.geometry && startAddress,
            endAddress.geometry && endAddress,
        ])
    }, [endAddress, map, startAddress, zoomToExtent]);

    const setRoute = useCallback((data) => {

        const { features } = data;
        const mapLayerID = `routeLayer`;
        const mapSourceID = `routeSource`;
        const mapLayer = map.getLayer(mapLayerID);
        if (typeof mapLayer === 'undefined') {
            map.addSource(mapSourceID, {
                type: 'geojson',
                data: {
                    type: "FeatureCollection",
                    features
                }
            });
            map.addLayer({
                id: mapLayerID,
                type: 'line',
                source: `routeSource`,
                paint: routePaint
            }); // , 'road-label-small' // hide under road label layer for v9 streets map
        }
        else {
            map.getSource(mapSourceID).setData({
                type: "FeatureCollection",
                features
            })
        }
        zoomToExtent(features);
    }, [map, zoomToExtent]);

    const removeLayerandSource = useCallback((layer, source) => {
        const l = map.getLayer(layer);
        if (typeof l !== 'undefined') map.removeLayer(layer);
        const s = map.getSource(source);
        if (typeof s !== 'undefined') map.removeSource(source);
    }, [map]);

    const clearMap = useCallback(() => {
        removeLayerandSource('startPointLayer', 'startPointSource');
        removeLayerandSource('endPointLayer', 'endPointSource');
        removeLayerandSource('routeLayer', 'routeSource');
        map.flyTo({ center, zoom });
    }, [map, removeLayerandSource]);

    useEffect(() => {
        // mapboxgl.accessToken = token;
        const initializeMap = ({ setMap, mapContainer }) => {
            const mapBoxMap = new mapboxgl.Map({
                container: mapContainer.current,
                // style: "mapbox://styles/mapbox/streets-v9",
                style: mapStyle,
                center,
                zoom
            });
            mapBoxMap.on("load", () => {
                setMap(mapBoxMap);
                toggleEnabled()
                mapBoxMap.resize();
            });
        };
        if (!map) initializeMap({ setMap, mapContainer });
    }, [map, toggleEnabled]);

    useEffect(() => {
        if (map && startAddress.geometry) {
            setPoint('start', startAddress, setPoint)
        }
    }, [startAddress, map, setPoint]);

    useEffect(() => {
        if (map && endAddress.geometry) {
            setPoint('end', endAddress)
        }
    }, [endAddress, map, setPoint]);

    useEffect(() => {
        if (map && selectedStreet.geometry) {
            zoomToExtent([selectedStreet])
        }
    }, [selectedStreet, map, zoomToExtent]);

    useEffect(() => {
        if (map && route.features && route.features.length) {
            setRoute(route)
        }
        else if (map && !route.features) {
            clearMap()
        }
    }, [route, map, setRoute, clearMap]);

    return <div ref={el => (mapContainer.current = el)} style={styles} />;
};

export default MapboxGLMap;