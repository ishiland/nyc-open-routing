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
    if (!map) {
      console.log(`[useGeoJsonLayer] ${layerId}: Map not initialized`)
      return
    }

    const normalizedData = normalizeData(data)
    console.log(`[useGeoJsonLayer] ${layerId}:`, {
      hasData: !!data,
      dataType: Array.isArray(data) ? 'array' : typeof data,
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      normalizedFeatures: normalizedData?.features?.length || 0,
      firstFeature: normalizedData?.features?.[0],
      mapLoaded: map.loaded(),
      hasStyle: !!map.getStyle()
    })

    const addOrUpdateLayer = () => {
      // Check if style is loaded before attempting to add layers
      if (!map.getStyle()) {
        console.log(`[useGeoJsonLayer] ${layerId}: Style not loaded yet, waiting...`)
        return false
      }

      if (!normalizedData) {
        // Remove layer and source if no data
        console.log(`[useGeoJsonLayer] ${layerId}: No data, removing layer`)
        removeMapLayerAndSource(map, layerId, sourceId)
        return true
      }

      // If layer already exists, update both data and paint properties
      if (map.getLayer(layerId)) {
        console.log(`[useGeoJsonLayer] ${layerId}: Updating existing layer`)
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

        // Re-order layer if beforeId is specified and the target layer exists
        // This ensures correct z-order is maintained even when layers are updated
        if (beforeId && map.getLayer(beforeId)) {
          map.moveLayer(layerId, beforeId)
        }

        return true
      } else {
        // Add new source and layer
        console.log(`[useGeoJsonLayer] ${layerId}: Adding new layer`)
        try {
          // First add the source
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: "geojson",
              data: normalizedData,
            })
          }

          // Then add the layer
          const mapLayer: maplibregl.LayerSpecification = {
            id: layerId,
            type: layerOptions.type,
            source: sourceId,
            paint: layerOptions.paint,
            ...(layerOptions.layout && { layout: layerOptions.layout }),
          }

          // Validate beforeId layer exists to prevent "Cannot add layer before non-existing layer" error
          const safeBeforeId = beforeId && map.getLayer(beforeId) ? beforeId : undefined
          map.addLayer(mapLayer, safeBeforeId)
          console.log(`[useGeoJsonLayer] ${layerId}: Layer added successfully${safeBeforeId ? ` before ${safeBeforeId}` : ' at top'}`)
          return true
        } catch (error) {
          console.error(`[useGeoJsonLayer] ${layerId}: Error adding layer:`, error)
          return false
        }
      }
    }

    // Try to add/update immediately
    const success = addOrUpdateLayer()

    // If style wasn't loaded, wait for it
    if (!success && !map.getStyle()) {
      console.log(`[useGeoJsonLayer] ${layerId}: Waiting for styledata event...`)
      const handleStyleData = () => {
        console.log(`[useGeoJsonLayer] ${layerId}: Style loaded, adding layer`)
        addOrUpdateLayer()
      }
      map.once('styledata', handleStyleData)

      // Cleanup function to remove listener if component unmounts
      return () => {
        map.off('styledata', handleStyleData)
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
