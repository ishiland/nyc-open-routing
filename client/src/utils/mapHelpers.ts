import maplibregl from "maplibre-gl"
import debug from "./debug"

/**
 * Canonical z-order for custom map layers (bottom to top).
 * Isochrone fills at the bottom, address labels on top.
 */
export const CUSTOM_LAYER_ORDER = [
  "isochroneFillLayer",
  "isochroneOutlineLayer",
  "isochroneEdgesLayer",
  "trafficLayer",
  "routeHaloLayer",
  "routeLayer",
  "waypointPointLayer",
  "waypointLabelLayer",
  "startPointLayer",
  "endPointLayer",
  "startPointLabelLayer",
  "endPointLabelLayer",
]

/**
 * Enforce the canonical layer order for all custom layers.
 * Moves existing layers to match CUSTOM_LAYER_ORDER (bottom to top).
 */
export const enforceLayerOrder = (map: maplibregl.Map): void => {
  if (!map || !map.getStyle()) return

  const existing = CUSTOM_LAYER_ORDER.filter(id => map.getLayer(id))
  if (existing.length < 2) return

  for (let i = existing.length - 2; i >= 0; i--) {
    try {
      map.moveLayer(existing[i], existing[i + 1])
    } catch {
      // Layer may have been removed between check and move
    }
  }
}

/**
 * Safely removes a layer and its source from the map
 * @param map The MapLibre map instance
 * @param layerId The ID of the layer to remove
 * @param sourceId The ID of the source to remove
 * @returns boolean indicating if the operation was successful
 */
export const removeMapLayerAndSource = (
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
): boolean => {
  if (!map || !map.getStyle()) return false

  try {
    // First remove the layer if it exists
    if (map.getStyle() && map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }

    // Then remove the source if it exists
    if (map.getStyle() && map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }

    return true
  } catch (error) {
    debug.error(
      `Error removing layer ${layerId} or source ${sourceId}:`,
      error,
    )
    return false
  }
}
