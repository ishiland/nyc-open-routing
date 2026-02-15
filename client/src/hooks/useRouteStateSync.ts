import { useEffect, useCallback, useRef } from "react"
import { IMapFeature, TravelMode } from "../types/interfaces"

interface RouteState {
  startAddress: IMapFeature | null
  endAddress: IMapFeature | null
  mode: TravelMode
}

interface RouteStateSyncProps {
  startAddress: IMapFeature | null
  endAddress: IMapFeature | null
  mode: TravelMode
  useTraffic: boolean
  avoidFerries: boolean
  trafficHour: number | null
  trafficDayOfWeek: number | null
  setAddress: (feature: IMapFeature, type: "start" | "end") => void
  setMode: (mode: TravelMode) => void
  setUseTraffic: (useTraffic: boolean) => void
  setAvoidFerries: (avoidFerries: boolean) => void
  setTrafficHour: (hour: number | null) => void
  setTrafficDayOfWeek: (day: number | null) => void
}

/**
 * Hook to sync routing state with URL parameters
 * Enables deep linking and route sharing
 *
 * URL format v3: /?start=-74.0060,40.7128&startAddr=Times+Square&end=-73.9352,40.7306&endAddr=Central+Park&mode=drive&traffic=true&hour=14&day=3
 * URL format v2: /?start=-74.0060,40.7128&startAddr=Times+Square&end=-73.9352,40.7306&endAddr=Central+Park&mode=bike&traffic=true
 * Legacy format: /?start=-74.0060,40.7128&end=-73.9352,40.7306&mode=bike (still supported)
 */
export const useRouteStateSync = ({
  startAddress,
  endAddress,
  mode,
  useTraffic,
  avoidFerries,
  trafficHour,
  trafficDayOfWeek,
  setAddress,
  setMode,
  setUseTraffic,
  setAvoidFerries,
  setTrafficHour,
  setTrafficDayOfWeek,
}: RouteStateSyncProps) => {
  const isInitialized = useRef(false)

  // Initialize state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const startParam = params.get("start")
    const endParam = params.get("end")
    const startAddrParam = params.get("startAddr")
    const endAddrParam = params.get("endAddr")
    const modeParam = params.get("mode")
    const trafficParam = params.get("traffic")

    // Restore travel mode
    if (
      modeParam &&
      (modeParam === "drive" || modeParam === "bike" || modeParam === "walk")
    ) {
      setMode(modeParam)
    }

    // Restore traffic preference (only relevant for drive mode)
    if (trafficParam !== null) {
      setUseTraffic(trafficParam === "true")
    }

    // Restore traffic time parameters (optional, only for drive mode)
    const hourParam = params.get("hour")
    const dayParam = params.get("day")
    if (hourParam !== null && dayParam !== null) {
      const hour = parseInt(hourParam, 10)
      const day = parseInt(dayParam, 10)
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        setTrafficHour(hour)
      }
      if (!isNaN(day) && day >= 1 && day <= 7) {
        setTrafficDayOfWeek(day)
      }
    }

    // Restore ferry avoidance preference
    const ferryParam = params.get("avoidFerries")
    if (ferryParam !== null) {
      setAvoidFerries(ferryParam === "true")
    }

    // Restore start address
    if (startParam) {
      const feature = parseCoordinatesFromParam(
        startParam,
        startAddrParam || "Start",
      )
      if (feature) {
        setAddress(feature, "start")
      }
    }

    // Restore end address
    if (endParam) {
      const feature = parseCoordinatesFromParam(endParam, endAddrParam || "End")
      if (feature) {
        setAddress(feature, "end")
      }
    }

    // Set initialized after React processes the state batch from init
    queueMicrotask(() => {
      isInitialized.current = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Update URL when state changes
  useEffect(() => {
    if (!isInitialized.current) return

    const params = new URLSearchParams()

    // Add start coordinates and address label if available
    if (startAddress?.geometry?.type === "Point") {
      const [lon, lat] = startAddress.geometry.coordinates as [number, number]
      params.set("start", `${lon},${lat}`)

      // Add address label if it exists and isn't just coordinates
      const label = startAddress.properties?.label
      if (label && !label.match(/^\([\d\.\-,\s]+\)$/)) {
        // Clean and encode the label
        const cleanLabel = label.replace(/^(Start|End)\s*[-:]?\s*/i, "").trim()
        if (cleanLabel && cleanLabel.length > 0) {
          params.set("startAddr", cleanLabel)
        }
      }
    }

    // Add end coordinates and address label if available
    if (endAddress?.geometry?.type === "Point") {
      const [lon, lat] = endAddress.geometry.coordinates as [number, number]
      params.set("end", `${lon},${lat}`)

      // Add address label if it exists and isn't just coordinates
      const label = endAddress.properties?.label
      if (label && !label.match(/^\([\d\.\-,\s]+\)$/)) {
        // Clean and encode the label
        const cleanLabel = label.replace(/^(Start|End)\s*[-:]?\s*/i, "").trim()
        if (cleanLabel && cleanLabel.length > 0) {
          params.set("endAddr", cleanLabel)
        }
      }
    }

    // Add mode
    if (mode) {
      params.set("mode", mode)
    }

    // Add traffic preference (only for drive mode)
    if (mode === "drive") {
      params.set("traffic", String(useTraffic))

      // Add time parameters if set (only for drive mode with traffic)
      if (useTraffic && trafficHour !== null && trafficDayOfWeek !== null) {
        params.set("hour", String(trafficHour))
        params.set("day", String(trafficDayOfWeek))
      }
    }

    // Add ferry avoidance preference (only for bike/walk modes)
    if (mode === "bike" || mode === "walk") {
      params.set("avoidFerries", String(avoidFerries))
    }

    // Update URL without page reload
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname

    // Only update if URL actually changed
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, "", newUrl)
    }
  }, [
    startAddress,
    endAddress,
    mode,
    useTraffic,
    avoidFerries,
    trafficHour,
    trafficDayOfWeek,
  ])

  // Function to copy current route URL to clipboard
  const copyRouteUrl = useCallback((): Promise<boolean> => {
    const url = window.location.href
    return navigator.clipboard
      .writeText(url)
      .then(() => true)
      .catch(error => {
        console.error("Failed to copy URL:", error)
        return false
      })
  }, [])

  return {
    copyRouteUrl,
  }
}

/**
 * Parse coordinates from URL parameter
 * Format: "lon,lat" e.g., "-74.0060,40.7128"
 * Label: Optional address label from URL (e.g., "Times Square Manhattan")
 */
function parseCoordinatesFromParam(
  param: string,
  label: string,
): IMapFeature | null {
  try {
    const parts = param.split(",")
    if (parts.length !== 2) return null

    const lon = parseFloat(parts[0])
    const lat = parseFloat(parts[1])

    if (isNaN(lon) || isNaN(lat)) return null

    // Basic bounds check for NYC area
    // NYC is roughly: lon -74.3 to -73.7, lat 40.5 to 40.9
    if (lon < -74.5 || lon > -73.5 || lat < 40.3 || lat > 41.1) {
      console.warn("Coordinates outside NYC area:", lon, lat)
      return null
    }

    // Use provided label if it's not just "Start" or "End"
    // Otherwise show generic shared location message
    const isGenericLabel = label === "Start" || label === "End"
    const displayLabel = isGenericLabel
      ? `Shared Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`
      : label

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties: {
        label: displayLabel,
      },
    }
  } catch (error) {
    console.error("Failed to parse coordinates from URL:", error)
    return null
  }
}
