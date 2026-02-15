import { useContext, useEffect, useRef, useCallback } from "react"
import maplibregl from "maplibre-gl"
import { TrafficLayerContext } from "../contexts/TrafficLayerContext"
import { MapInstanceContext } from "../contexts/MapInstanceContext"
import useGeoJsonLayer from "./useGeoJsonLayer"
import { getTrafficLayerPaint } from "../utils/style"
import debug from "../utils/debug"

const MIN_ZOOM = 12
const DEBOUNCE_MS = 400

export function useTrafficLayer() {
  const { map } = useContext(MapInstanceContext)
  const {
    showTrafficLayer,
    trafficGeoJson,
    setTrafficGeoJson,
    setIsLoading,
    lastRefresh,
  } = useContext(TrafficLayerContext)

  const abortRef = useRef<AbortController | null>(null)

  // Fetch traffic data for current viewport
  const fetchTraffic = useCallback(
    async (mapInstance: maplibregl.Map) => {
      if (mapInstance.getZoom() < MIN_ZOOM) {
        setTrafficGeoJson(null)
        return
      }
      const bounds = mapInstance.getBounds()
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

      // Abort previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsLoading(true)
      try {
        const res = await fetch(`/api/traffic/layer?bbox=${bbox}`, {
          signal: controller.signal,
        })
        if (!res.ok)
          throw new Error(`Traffic layer fetch failed: ${res.status}`)
        const data = await res.json()
        setTrafficGeoJson(data)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          debug.error("[useTrafficLayer] Fetch error:", err)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [setTrafficGeoJson, setIsLoading],
  )

  // Subscribe to moveend with debounce when layer is enabled
  useEffect(() => {
    if (!map || !showTrafficLayer) return

    let timeoutId: ReturnType<typeof setTimeout>

    const handleMoveEnd = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => fetchTraffic(map), DEBOUNCE_MS)
    }

    // Fetch immediately on enable
    fetchTraffic(map)

    map.on("moveend", handleMoveEnd)
    return () => {
      clearTimeout(timeoutId)
      map.off("moveend", handleMoveEnd)
      abortRef.current?.abort()
    }
  }, [map, showTrafficLayer, fetchTraffic])

  // Re-fetch when lastRefresh changes (background refresh completed) and layer is visible
  useEffect(() => {
    if (!map || !showTrafficLayer || !lastRefresh) return
    fetchTraffic(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefresh]) // Intentionally narrow deps — only trigger on timestamp change

  // Render the layer using useGeoJsonLayer
  const layerData = showTrafficLayer
    ? ((trafficGeoJson?.features ?? null) as any)
    : null
  useGeoJsonLayer(map, "trafficSource", "trafficLayer", layerData, {
    type: "line",
    paint: getTrafficLayerPaint(),
  })
}
