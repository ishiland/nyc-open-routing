import React, { useContext } from "react"
import { Fab, Tooltip } from "@mui/material"
import { ZoomOutMap } from "@mui/icons-material"
import { RoutingContext } from "../../contexts/RoutingContext"
import { MapInstanceContext } from "../../contexts/MapInstanceContext"
import { IMapFeature } from "../../types/interfaces"
import { NYC_BOUNDS_PADDING, MAP_CONTROLS_Z_INDEX } from "../../utils/constants"
import { useResponsive } from "../../hooks/useResponsive"

/**
 * Floating action button to zoom map to fit the entire route
 * Only visible when a route is present
 */
export const ZoomToRouteButton: React.FC = () => {
  const { route } = useContext(RoutingContext)
  const { map } = useContext(MapInstanceContext)
  const { isMobile } = useResponsive()

  // Don't render if no route or no map
  if (!route?.features?.length || !map) {
    return null
  }

  const handleZoomToRoute = () => {
    if (!map || !route?.features?.length) return

    // Calculate bounding box from all route features
    const features = route.features as IMapFeature[]

    // Handle LineString coordinates (array of [lon, lat] pairs)
    const allCoords: number[][] = []
    features.forEach((feature) => {
      if (feature.geometry?.type === "LineString") {
        const geom = feature.geometry as GeoJSON.LineString
        const coords = geom.coordinates as number[][]
        allCoords.push(...coords)
      }
    })

    if (allCoords.length === 0) return

    // Find min/max bounds
    const lngs = allCoords.map(coord => coord[0])
    const lats = allCoords.map(coord => coord[1])

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ]

    // Fit map to bounds with padding
    map.fitBounds(bounds, {
      padding: NYC_BOUNDS_PADDING,
      duration: 1000,
      maxZoom: 16,
    })
  }

  return (
    <Tooltip title="Zoom to route" placement="left">
      <Fab
        color="primary"
        size="small"
        onClick={handleZoomToRoute}
        sx={{
          position: "absolute",
          bottom: isMobile ? "calc(40% + 16px)" : 24,
          right: 24,
          zIndex: MAP_CONTROLS_Z_INDEX,
          transition: "bottom 250ms ease-in-out",
        }}
      >
        <ZoomOutMap />
      </Fab>
    </Tooltip>
  )
}
