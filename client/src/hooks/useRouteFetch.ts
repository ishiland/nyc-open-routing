import { useCallback, useState } from "react"
import { Point } from "geojson"

import { IMapFeature, Route } from "../types/interfaces"
import { TravelMode } from "../contexts/RoutingContext"
import { MessageContextType } from "../contexts/MessageContext"
import debug from "../utils/debug"

interface UseRouteFetchArgs {
  startAddress: IMapFeature | null
  endAddress: IMapFeature | null
  mode: TravelMode
  setRoute: (route: Route | null) => void
  displayMessage: MessageContextType["displayMessage"]
}

export const useRouteFetch = ({
  startAddress,
  endAddress,
  mode,
  setRoute,
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
        const response = await fetch(
          `/api/route?orig=${startCoords}&dest=${endCoords}&mode=${mode}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          // Try to get error message from response body, otherwise use statusText
          let errorText = response.statusText
          try {
            const errorData = await response.json()
            if (errorData && errorData.message) {
              errorText = errorData.message
            }
          } catch (e) {
            // Ignore if response is not json or doesn't have message
          }

          // Provide user-friendly error messages based on status code
          if (response.status === 404) {
            throw new Error("Route calculation endpoint not found.")
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again later.")
          } else {
            throw new Error(errorText || "Failed to calculate route.")
          }
        }

        const data: Route = await response.json()
        if (data.features && data.features.length > 0) {
          setRoute(data)
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
          displayMessage(`Error fetching route: ${error.message}`, "error")
        }
      } else {
        displayMessage("An unexpected error occurred.", "error")
      }
    } finally {
      setIsFetching(false)
    }
  }, [startAddress, endAddress, mode, setRoute, displayMessage])

  return { fetchRoute: fetchRouteCallback, isFetching }
}
