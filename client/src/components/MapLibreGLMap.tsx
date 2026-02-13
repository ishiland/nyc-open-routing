// MapLibreGLMap.tsx
import React, { useContext, useEffect, useCallback, useMemo } from "react"
import "maplibre-gl/dist/maplibre-gl.css"

import {
  addressPointPaint,
  startPointColor,
  endPointColor,
  routePaint,
  routeHaloPaint,
  getTrafficRoutePaint,
  getModeRoutePaint,
} from "../utils/style"
import { RoutingContext } from "../contexts/RoutingContext"
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
import { removeMapLayerAndSource } from "../utils/mapHelpers"
import debug from "../utils/debug"
import { ZoomToRouteButton } from "./controls/ZoomToRouteButton"
import { MapControls } from "./controls/MapControls"

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
  } = useContext(RoutingContext)

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
  const routePaint = useMemo(
    () => (hasTrafficData ? getTrafficRoutePaint() : getModeRoutePaint(mode)),
    [hasTrafficData, mode]
  )

  const routeLayerOptions = useMemo(
    () => ({
      type: "line" as const,
      paint: routePaint,
    }),
    [routePaint]
  )

  const haloLayerOptions = useMemo(
    () => ({
      type: "line" as const,
      paint: routeHaloPaint,
    }),
    []
  )

  // Add route halo layer FIRST (creates glow effect beneath route)
  // Place it before routeLayer to ensure halo appears beneath the main route line
  useGeoJsonLayer(
    map,
    "routeHaloSource",
    "routeHaloLayer",
    route?.features || null,
    haloLayerOptions,
    "routeLayer", // Halo goes before (beneath) route layer
  )

  // Add main route layer on top of halo (but beneath markers)
  // Place it before startPointLayer to ensure route appears beneath markers
  useGeoJsonLayer(
    map,
    "routeSource",
    "routeLayer",
    route?.features || null,
    routeLayerOptions,
    "startPointLayer", // Route goes before (beneath) marker layers
  )

  // Add markers AFTER route (so they appear on top)
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
    endAddress as IMapFeature | null,
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
    endAddress as IMapFeature | null,
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
    resetZoom()
  }, [map, resetZoom])

  // Zoom to extent when addresses change
  useEffect(() => {
    if (!map) return

    const features: IMapFeature[] = []
    if (startAddress && startAddress.geometry) {
      features.push(startAddress as IMapFeature)
    }
    if (endAddress && endAddress.geometry) {
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
  }, [startAddress, endAddress, map, zoomToExtent])

  // Zoom to extent when route changes
  useEffect(() => {
    if (!map) return

    if (route && route.features && route.features.length > 0) {
      if (map.loaded()) {
        zoomToExtent(route.features)
      } else {
        const handler = () => zoomToExtent(route.features)
        map.once('idle', handler)
        return () => { map.off('idle', handler) }
      }
    } else if (!route || !route.features) {
      clearMap()
    }
  }, [route, map, zoomToExtent, clearMap])

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
    </div>
  )
}

// Memoize to prevent re-renders during routing context updates
export default React.memo(MapLibreGLMap)
