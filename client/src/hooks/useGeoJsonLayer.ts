import { useEffect, useCallback } from "react"
import maplibregl from "maplibre-gl"
import { IMapFeature } from "../types/interfaces"
import { removeMapLayerAndSource } from "../utils/mapHelpers"

// Type-safe layer options based on maplibregl types
interface LayerOptions {
  type: "circle" | "line" | "fill" | "symbol"
  paint: Record<string, unknown>
  layout?: Record<string, unknown>
}

/**
 * Custom hook to manage a GeoJSON layer on a MapLibre GL map
 */
const useGeoJsonLayer = (
  map: maplibregl.Map | null,
  sourceId: string,
  layerId: string,
  data: IMapFeature | IMapFeature[] | null,
  layerOptions: LayerOptions,
  beforeId?: string,
) => {
  // Convert single feature to feature collection if needed
  const normalizeData = useCallback(
    (inputData: IMapFeature | IMapFeature[] | null) => {
      if (!inputData) return null

      const features = Array.isArray(inputData) ? inputData : [inputData]
      const validFeatures = features.filter(f => f)

      // Treat empty arrays as null to avoid creating invisible layers
      if (validFeatures.length === 0) return null

      return {
        type: "FeatureCollection" as const,
        features: validFeatures,
      }
    },
    [],
  )

  // Add or update layer
  useEffect(() => {
    if (!map) return

    const normalizedData = normalizeData(data)

    const addOrUpdateLayer = () => {
      if (!map.getStyle()) return false

      if (!normalizedData) {
        removeMapLayerAndSource(map, layerId, sourceId)
        return true
      }

      // If layer already exists, update both data and paint properties
      if (map.getLayer(layerId)) {
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource
        if (source) {
          source.setData(
            normalizedData as GeoJSON.FeatureCollection<GeoJSON.Geometry>,
          )
        }

        // Update paint properties (important for mode changes, traffic toggle, etc.)
        Object.entries(layerOptions.paint).forEach(([key, value]) => {
          // MapLibre doesn't handle null well - use undefined to properly reset properties
          // This is important for resetting line-dasharray when switching from dashed to solid lines
          const safeValue = value === null ? undefined : value
          map.setPaintProperty(layerId, key, safeValue)
        })

        // Update layout properties if provided
        if (layerOptions.layout) {
          Object.entries(layerOptions.layout).forEach(([key, value]) => {
            map.setLayoutProperty(layerId, key, value)
          })
        }

        // Note: z-order is enforced by enforceLayerOrder() in MapLibreGLMap,
        // not per-layer moveLayer calls (which can't handle all creation orderings)

        return true
      } else {
        try {
          // First add the source
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: "geojson",
              data: normalizedData,
            })
          }

          // Then add the layer (filter out null paint values — addLayer rejects them;
          // null is only meaningful for setPaintProperty resets on existing layers)
          const cleanPaint = Object.fromEntries(
            Object.entries(layerOptions.paint).filter(([, v]) => v != null),
          )
          const mapLayer: maplibregl.LayerSpecification = {
            id: layerId,
            type: layerOptions.type,
            source: sourceId,
            paint: cleanPaint,
            ...(layerOptions.layout && { layout: layerOptions.layout }),
          }

          // Validate beforeId layer exists to prevent "Cannot add layer before non-existing layer" error
          const safeBeforeId =
            beforeId && map.getLayer(beforeId) ? beforeId : undefined
          map.addLayer(mapLayer, safeBeforeId)
          return true
        } catch (error) {
          console.error(
            `[useGeoJsonLayer] ${layerId}: Error adding layer:`,
            error,
          )
          return false
        }
      }
    }

    // Try to add/update immediately
    const success = addOrUpdateLayer()

    // If style wasn't loaded, wait for it
    if (!success && !map.getStyle()) {
      const handleStyleData = () => addOrUpdateLayer()
      map.once("styledata", handleStyleData)

      // Cleanup function to remove listener if component unmounts
      return () => {
        map.off("styledata", handleStyleData)
      }
    }
  }, [map, sourceId, layerId, data, layerOptions, beforeId, normalizeData])

  // Return a function to remove the layer and source
  const removeLayer = useCallback(() => {
    if (!map) return
    removeMapLayerAndSource(map, layerId, sourceId)
  }, [map, layerId, sourceId])

  return { removeLayer }
}

export default useGeoJsonLayer
