import maplibregl from "maplibre-gl"
import debug from "./debug"

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
  if (!map || !map.loaded()) return false

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
