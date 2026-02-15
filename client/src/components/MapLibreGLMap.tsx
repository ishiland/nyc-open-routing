// MapLibreGLMap.tsx
import React, { useContext, useEffect, useCallback, useMemo } from "react"
import "maplibre-gl/dist/maplibre-gl.css"

import {
  addressPointPaint,
  startPointColor,
  endPointColor,
  waypointPointColor,
  routeHaloPaint,
  getTrafficRoutePaint,
  getModeRoutePaint,
  getIsochroneFillPaint,
  getIsochroneOutlinePaint,
  getIsochroneEdgePaint,
} from "../utils/style"
import { RoutingContext } from "../contexts/RoutingContext"
import { IsochroneContext } from "../contexts/IsochroneContext"
import { TrafficLayerContext } from "../contexts/TrafficLayerContext"
import { MapInstanceContext } from "../contexts/MapInstanceContext"
import { IMapFeature } from "../types/interfaces"
import {
  NYC_DEFAULT_CENTER,
  NYC_DEFAULT_ZOOM,
  NYC_BOUNDS_PADDING,
} from "../utils/constants"
import useMapInit from "../hooks/useMapInit"
import useMapZoom from "../hooks/useMapZoom"
import useGeoJsonLayer from "../hooks/useGeoJsonLayer"
import { removeMapLayerAndSource, enforceLayerOrder } from "../utils/mapHelpers"
import debug from "../utils/debug"
import { ZoomToRouteButton } from "./controls/ZoomToRouteButton"
import { MapControls } from "./controls/MapControls"
import { TrafficLayerToggle } from "./controls/TrafficLayerToggle"
import { useTrafficLayer } from "../hooks/useTrafficLayer"
import { useTrafficStatus } from "../hooks/useTrafficStatus"

const styles: React.CSSProperties = {
  height: "100dvh",
  flex: 1,
}

const MapLibreGLMap: React.FC = () => {
  const mapContainer = React.useRef<HTMLDivElement | null>(null)

  const {
    startAddress,
    endAddress,
    route,
    selectedStreet,
    enableAddressInputs,
    mode,
    waypoints,
    waypointRoute,
  } = useContext(RoutingContext)

  const { appMode, isochrone, isochroneView } = useContext(IsochroneContext)
  const { trafficGeoJson } = useContext(TrafficLayerContext)

  const { setMap: setMapInstance } = useContext(MapInstanceContext)

  // Use existing hooks for map initialization and zoom
  const map = useMapInit(mapContainer, {
    onMapLoad: enableAddressInputs,
  })

  // Set the map instance in context when it's initialized
  useEffect(() => {
    if (map) {
      setMapInstance(map)
    }
  }, [map, setMapInstance])

  const { zoomToExtent, resetZoom } = useMapZoom(map, {
    padding: NYC_BOUNDS_PADDING,
    defaultCenter: NYC_DEFAULT_CENTER,
    defaultZoom: NYC_DEFAULT_ZOOM,
  })

  // Determine if route has traffic data
  const hasTrafficData = route?.features?.some(
    (f) => f.properties?.traffic_factor !== undefined && f.properties?.traffic_factor !== null
  )

  // Memoize paint objects to prevent unnecessary re-renders
  const routePaintStyle = useMemo(
    () => (hasTrafficData ? getTrafficRoutePaint() : getModeRoutePaint(mode)),
    [hasTrafficData, mode]
  )

  const routeLayerOptions = useMemo(
    () => ({
      type: "line" as const,
      paint: routePaintStyle,
    }),
    [routePaintStyle]
  )

  const haloLayerOptions = useMemo(
    () => ({
      type: "line" as const,
      paint: routeHaloPaint,
    }),
    []
  )

  // Isochrone layer paint options
  const isochroneFillOptions = useMemo(
    () => ({
      type: "fill" as const,
      paint: getIsochroneFillPaint(),
    }),
    []
  )

  const isochroneOutlineOptions = useMemo(
    () => ({
      type: "line" as const,
      paint: getIsochroneOutlinePaint(),
    }),
    []
  )

  const isochroneEdgeOptions = useMemo(
    () => ({
      type: "line" as const,
      paint: getIsochroneEdgePaint(),
    }),
    []
  )

  // Polygon features: only when in polygon view
  const isochronePolygonFeatures = appMode === "isochrone" && isochroneView === "polygon" && isochrone?.features
    ? (isochrone.features as unknown as IMapFeature[])
    : null

  // Edge features: only when in edge view
  const isochroneEdgeFeatures = appMode === "isochrone" && isochroneView === "edges" && isochrone?.features
    ? (isochrone.features as unknown as IMapFeature[])
    : null

  // Route features: flatten waypoint legs or use regular route
  const routeFeatures = useMemo(() => {
    if (appMode !== "route") return null
    if (waypointRoute?.legs) {
      return waypointRoute.legs.flatMap(leg => leg.features) as unknown as IMapFeature[]
    }
    return (route?.features || null) as IMapFeature[] | null
  }, [appMode, waypointRoute, route])

  // Waypoint marker features with numbered labels
  const waypointMarkerFeatures = useMemo(() => {
    const validWaypoints = waypoints.filter(
      wp =>
        wp.geometry?.type === "Point" &&
        (wp.geometry as GeoJSON.Point).coordinates[0] !== 0,
    )
    if (validWaypoints.length === 0) return null
    return validWaypoints.map((wp, index) => ({
      ...wp,
      properties: {
        ...wp.properties,
        waypointNumber: String(index + 1),
      },
    })) as IMapFeature[]
  }, [waypoints])

  // Traffic layer (managed by hook — fetches on moveend, renders via useGeoJsonLayer)
  useTrafficLayer()
  useTrafficStatus()

  // Layer ordering: hooks are declared bottom-to-top.
  // enforceLayerOrder() (below) corrects z-order after every data change.

  // Isochrone fill layer (bottom-most custom layer)
  useGeoJsonLayer(
    map,
    "isochroneFillSource",
    "isochroneFillLayer",
    isochronePolygonFeatures,
    isochroneFillOptions,
  )

  // Isochrone outline layer
  useGeoJsonLayer(
    map,
    "isochroneOutlineSource",
    "isochroneOutlineLayer",
    isochronePolygonFeatures,
    isochroneOutlineOptions,
  )

  // Isochrone edge layer (street segments)
  useGeoJsonLayer(
    map,
    "isochroneEdgesSource",
    "isochroneEdgesLayer",
    isochroneEdgeFeatures,
    isochroneEdgeOptions,
  )

  // Route halo layer (glow effect beneath route line)
  useGeoJsonLayer(
    map,
    "routeHaloSource",
    "routeHaloLayer",
    routeFeatures,
    haloLayerOptions,
  )

  // Main route layer (above halo, beneath markers)
  useGeoJsonLayer(
    map,
    "routeSource",
    "routeLayer",
    routeFeatures,
    routeLayerOptions,
  )

  // Waypoint circle markers
  useGeoJsonLayer(
    map,
    "waypointPointSource",
    "waypointPointLayer",
    waypointMarkerFeatures,
    {
      type: "circle",
      paint: {
        ...addressPointPaint,
        "circle-color": waypointPointColor,
      },
    },
  )

  // Waypoint numbered labels
  useGeoJsonLayer(
    map,
    "waypointLabelSource",
    "waypointLabelLayer",
    waypointMarkerFeatures,
    {
      type: "symbol",
      layout: {
        "text-field": ["get", "waypointNumber"],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 14,
        "text-anchor": "center",
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": waypointPointColor,
        "text-halo-width": 1,
      },
    },
  )

  // Add markers AFTER route (so they appear on top)
  // In isochrone mode, show start marker only
  useGeoJsonLayer(
    map,
    "startPointSource",
    "startPointLayer",
    startAddress as IMapFeature | null,
    {
      type: "circle",
      paint: {
        ...addressPointPaint,
        "circle-color": startPointColor,
      },
    },
  )

  useGeoJsonLayer(
    map,
    "endPointSource",
    "endPointLayer",
    appMode === "route" ? (endAddress as IMapFeature | null) : null,
    {
      type: "circle",
      paint: {
        ...addressPointPaint,
        "circle-color": endPointColor,
      },
    },
  )

  // Add text labels on top of markers for accessibility
  useGeoJsonLayer(
    map,
    "startPointLabelSource",
    "startPointLabelLayer",
    startAddress as IMapFeature | null,
    {
      type: "symbol",
      layout: {
        "text-field": "A",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 14,
        "text-anchor": "center",
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": startPointColor,
        "text-halo-width": 1,
      },
    },
  )

  useGeoJsonLayer(
    map,
    "endPointLabelSource",
    "endPointLabelLayer",
    appMode === "route" ? (endAddress as IMapFeature | null) : null,
    {
      type: "symbol",
      layout: {
        "text-field": "B",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 14,
        "text-anchor": "center",
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": endPointColor,
        "text-halo-width": 1,
      },
    },
  )

  // Enforce canonical z-order after any layer data changes.
  // Runs after all useGeoJsonLayer effects in this render cycle.
  useEffect(() => {
    if (!map) return
    enforceLayerOrder(map)
  }, [map, isochronePolygonFeatures, isochroneEdgeFeatures, routeFeatures, startAddress, endAddress, appMode, waypointMarkerFeatures, trafficGeoJson])

  // Debug logging for address markers
  useEffect(() => {
    if (startAddress && startAddress.geometry?.type === "Point") {
      debug.log("[MapLibreGLMap] Start address set:", {
        label: startAddress.properties?.label,
        coordinates: startAddress.geometry.coordinates,
      })
    }
    if (endAddress && endAddress.geometry?.type === "Point") {
      debug.log("[MapLibreGLMap] End address set:", {
        label: endAddress.properties?.label,
        coordinates: endAddress.geometry.coordinates,
      })
    }
  }, [startAddress, endAddress])

  const clearMap = useCallback(() => {
    if (!map) return
    removeMapLayerAndSource(map, "startPointLayer", "startPointSource")
    removeMapLayerAndSource(map, "startPointLabelLayer", "startPointLabelSource")
    removeMapLayerAndSource(map, "endPointLayer", "endPointSource")
    removeMapLayerAndSource(map, "endPointLabelLayer", "endPointLabelSource")
    removeMapLayerAndSource(map, "routeLayer", "routeSource")
    removeMapLayerAndSource(map, "routeHaloLayer", "routeHaloSource")
    removeMapLayerAndSource(map, "waypointPointLayer", "waypointPointSource")
    removeMapLayerAndSource(map, "waypointLabelLayer", "waypointLabelSource")
    removeMapLayerAndSource(map, "isochroneFillLayer", "isochroneFillSource")
    removeMapLayerAndSource(map, "isochroneOutlineLayer", "isochroneOutlineSource")
    removeMapLayerAndSource(map, "isochroneEdgesLayer", "isochroneEdgesSource")
    resetZoom()
  }, [map, resetZoom])

  // Zoom to extent when addresses change
  useEffect(() => {
    if (!map) return

    const features: IMapFeature[] = []
    if (startAddress && startAddress.geometry) {
      features.push(startAddress as IMapFeature)
    }
    if (appMode === "route" && endAddress && endAddress.geometry) {
      features.push(endAddress as IMapFeature)
    }
    if (features.length > 0) {
      if (map.loaded()) {
        zoomToExtent(features)
      } else {
        const handler = () => zoomToExtent(features)
        map.once('idle', handler)
        return () => { map.off('idle', handler) }
      }
    }
  }, [startAddress, endAddress, appMode, map, zoomToExtent])

  // Zoom to extent when route changes
  useEffect(() => {
    if (!map || appMode !== "route") return

    // Determine which route features to zoom to
    const features = waypointRoute?.legs
      ? (waypointRoute.legs.flatMap(leg => leg.features) as unknown as IMapFeature[])
      : (route?.features || null)

    if (features && features.length > 0) {
      if (map.loaded()) {
        zoomToExtent(features)
      } else {
        const handler = () => zoomToExtent(features)
        map.once('idle', handler)
        return () => { map.off('idle', handler) }
      }
    } else if (!route && !waypointRoute) {
      clearMap()
    }
  }, [route, waypointRoute, appMode, map, zoomToExtent, clearMap])

  // Zoom to isochrone extent when data changes
  useEffect(() => {
    if (!map || appMode !== "isochrone") return

    if (isochrone && isochrone.features && isochrone.features.length > 0) {
      const isoFeatures = isochrone.features as unknown as IMapFeature[]
      if (map.loaded()) {
        zoomToExtent(isoFeatures)
      } else {
        const handler = () => zoomToExtent(isoFeatures)
        map.once('idle', handler)
        return () => { map.off('idle', handler) }
      }
    }
  }, [isochrone, appMode, map, zoomToExtent])

  // Zoom to selected street
  useEffect(() => {
    if (map && selectedStreet && selectedStreet.geometry) {
      zoomToExtent([selectedStreet as IMapFeature])
    }
  }, [selectedStreet, map, zoomToExtent])

  return (
    <div ref={mapContainer} style={styles}>
      <MapControls />
      <ZoomToRouteButton />
      <TrafficLayerToggle />
    </div>
  )
}

// Memoize to prevent re-renders during routing context updates
export default React.memo(MapLibreGLMap)
