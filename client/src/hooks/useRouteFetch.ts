import { useCallback, useState } from "react"
import { Point } from "geojson"

import { IMapFeature, Route, RouteFeature } from "../types/interfaces"
import { TravelMode } from "../contexts/RoutingContext"
import { MessageContextType } from "../contexts/MessageContext"

interface UseRouteFetchArgs {
  startAddress: IMapFeature | null
  endAddress: IMapFeature | null
  mode: TravelMode
  useTraffic: boolean
  avoidFerries: boolean
  trafficHour: number | null
  trafficDayOfWeek: number | null
  setRoute: (route: Route | null) => void
  setSelectedStreet: (street: RouteFeature | null) => void
  displayMessage: MessageContextType["displayMessage"]
}

export const useRouteFetch = ({
  startAddress,
  endAddress,
  mode,
  useTraffic,
  avoidFerries,
  trafficHour,
  trafficDayOfWeek,
  setRoute,
  setSelectedStreet,
  displayMessage,
}: UseRouteFetchArgs) => {
  const [isFetching, setIsFetching] = useState<boolean>(false)

  const fetchRouteCallback = useCallback(async () => {
    setIsFetching(true)
    try {
      if (!startAddress || !endAddress) {
        displayMessage("Please select start and end addresses.", "warning")
        return
      }

      const startGeom = startAddress.geometry as Point
      const endGeom = endAddress.geometry as Point

      if (
        startGeom?.type !== "Point" ||
        endGeom?.type !== "Point" ||
        !startGeom.coordinates ||
        !endGeom.coordinates
      ) {
        displayMessage(
          "Invalid address geometry. Start and end must be Points with coordinates.",
          "error",
        )
        return
      }

      const startCoords = Array.isArray(startGeom.coordinates)
        ? startGeom.coordinates.join(",")
        : ""
      const endCoords = Array.isArray(endGeom.coordinates)
        ? endGeom.coordinates.join(",")
        : ""

      if (!startCoords || !endCoords) {
        displayMessage("Invalid address coordinates string.", "error")
        return
      }
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        // Build URL with traffic and time parameters (only for drive mode)
        let url = `/api/route?orig=${startCoords}&dest=${endCoords}&mode=${mode}`
        if (mode === "drive") {
          url += `&use_traffic=${useTraffic}`
          if (useTraffic && trafficHour !== null && trafficDayOfWeek !== null) {
            url += `&hour=${trafficHour}&day_of_week=${trafficDayOfWeek}`
          }
        }
        if (mode === "bike" || mode === "walk") {
          url += `&avoid_ferries=${avoidFerries}`
        }
        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok) {
          // Try to get error message from response body, otherwise use statusText
          let errorText = response.statusText
          try {
            const errorData = await response.json()
            // Backend returns error messages in 'detail' field (FastAPI standard)
            if (errorData && errorData.detail) {
              errorText = errorData.detail
            } else if (errorData && errorData.message) {
              errorText = errorData.message
            }
          } catch (e) {
            // Ignore if response is not json or doesn't have detail/message
          }

          // Provide user-friendly error messages based on status code
          if (response.status === 404) {
            // 404 means no route found between locations (not endpoint missing)
            throw new Error(
              errorText || "No route found between these locations.",
            )
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again later.")
          } else {
            throw new Error(errorText || "Failed to calculate route.")
          }
        }

        const data: Route = await response.json()
        if (data.features && data.features.length > 0) {
          setRoute(data)
          setSelectedStreet(null)
        } else {
          setRoute(null)
          displayMessage(
            "Could not calculate a route. No features returned.",
            "warning",
          )
        }
      } finally {
        // Clear timeout after all async operations complete (fetch + json parsing)
        clearTimeout(timeoutId)
      }
    } catch (error) {
      setRoute(null)

      // Handle different error types with user-friendly messages
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          displayMessage(
            "Route calculation timed out. Please try again.",
            "error",
          )
        } else if (error.message.includes("Failed to fetch")) {
          displayMessage(
            "Network error. Please check your connection and try again.",
            "error",
          )
        } else {
          displayMessage(error.message, "error")
        }
      } else {
        displayMessage("An unexpected error occurred.", "error")
      }
    } finally {
      setIsFetching(false)
    }
  }, [
    startAddress,
    endAddress,
    mode,
    useTraffic,
    avoidFerries,
    trafficHour,
    trafficDayOfWeek,
    setRoute,
    setSelectedStreet,
    displayMessage,
  ])

  return { fetchRoute: fetchRouteCallback, isFetching }
}
