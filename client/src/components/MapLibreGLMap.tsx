// MapLibreGLMap.tsx
import React, { useContext, useEffect, useCallback } from "react"
import "maplibre-gl/dist/maplibre-gl.css"

import {
  addressPointPaint,
  startPointColor,
  endPointColor,
  routePaint,
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

const styles: React.CSSProperties = {
  height: "100vh",
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

  // Use GeoJSON layer hooks for start point, end point, and route
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

  useGeoJsonLayer(
    map,
    "routeSource",
    "routeLayer",
    route?.features || null,
    {
      type: "line",
      paint: routePaint,
    },
  )

  const clearMap = useCallback(() => {
    if (!map) return
    removeMapLayerAndSource(map, "startPointLayer", "startPointSource")
    removeMapLayerAndSource(map, "endPointLayer", "endPointSource")
    removeMapLayerAndSource(map, "routeLayer", "routeSource")
    resetZoom()
  }, [map, resetZoom])

  // Zoom to extent when addresses change
  useEffect(() => {
    if (!map || !map.loaded()) return

    const features: IMapFeature[] = []
    if (startAddress && startAddress.geometry) {
      features.push(startAddress as IMapFeature)
    }
    if (endAddress && endAddress.geometry) {
      features.push(endAddress as IMapFeature)
    }
    if (features.length > 0) {
      zoomToExtent(features)
    }
  }, [startAddress, endAddress, map, zoomToExtent])

  // Zoom to extent when route changes
  useEffect(() => {
    if (!map || !map.loaded()) return

    if (route && route.features && route.features.length > 0) {
      zoomToExtent(route.features)
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

  return <div ref={mapContainer} style={styles} />
}

// Memoize to prevent re-renders during routing context updates
export default React.memo(MapLibreGLMap)
