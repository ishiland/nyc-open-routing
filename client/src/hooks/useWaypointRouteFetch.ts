import { useCallback, useState } from "react"
import { Point } from "geojson"

import { IMapFeature, WaypointRouteResponse } from "../types/interfaces"
import { TravelMode } from "../contexts/RoutingContext"
import { MessageContextType } from "../contexts/MessageContext"

interface UseWaypointRouteFetchArgs {
  startAddress: IMapFeature | null
  endAddress: IMapFeature | null
  waypoints: IMapFeature[]
  mode: TravelMode
  useTraffic: boolean
  avoidFerries: boolean
  trafficHour: number | null
  trafficDayOfWeek: number | null
  setWaypointRoute: (route: WaypointRouteResponse | null) => void
  setRoute: (route: null) => void // To clear regular route when using waypoints
  setSelectedStreet: (street: null) => void
  displayMessage: MessageContextType["displayMessage"]
}

export const useWaypointRouteFetch = ({
  startAddress,
  endAddress,
  waypoints,
  mode,
  useTraffic,
  avoidFerries,
  trafficHour,
  trafficDayOfWeek,
  setWaypointRoute,
  setRoute,
  setSelectedStreet,
  displayMessage,
}: UseWaypointRouteFetchArgs) => {
  const [isFetchingWaypoints, setIsFetchingWaypoints] = useState<boolean>(false)

  const fetchWaypointRoute = useCallback(async () => {
    setIsFetchingWaypoints(true)
    try {
      if (!startAddress || !endAddress || waypoints.length === 0) {
        displayMessage(
          "Please select start, end, and at least one waypoint.",
          "warning",
        )
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

      // Validate all waypoint geometries
      for (const wp of waypoints) {
        const wpGeom = wp.geometry as Point
        if (wpGeom?.type !== "Point" || !wpGeom.coordinates) {
          displayMessage("Invalid waypoint geometry.", "error")
          return
        }
      }

      const startCoords = startGeom.coordinates.join(",")
      const endCoords = endGeom.coordinates.join(",")

      // Build pipe-delimited waypoints: start|wp1|...|end
      const allPoints = [
        startCoords,
        ...waypoints.map(wp => {
          const geom = wp.geometry as Point
          return geom.coordinates.join(",")
        }),
        endCoords,
      ]
      const waypointsParam = allPoints.join("|")

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        // Build URL with traffic and ferry parameters
        let url = `/api/route/waypoints?waypoints=${waypointsParam}&mode=${mode}`
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
          // Try to get error message from response body
          let errorText = response.statusText
          try {
            const errorData = await response.json()
            if (errorData && errorData.detail) {
              errorText = errorData.detail
            } else if (errorData && errorData.message) {
              errorText = errorData.message
            }
          } catch {
            // Ignore if response is not json
          }

          if (response.status === 404) {
            throw new Error(
              errorText || "No route found between these locations.",
            )
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again later.")
          } else {
            throw new Error(errorText || "Failed to calculate route.")
          }
        }

        const data: WaypointRouteResponse = await response.json()
        if (data.legs && data.legs.length > 0) {
          setWaypointRoute(data)
          setRoute(null) // Clear regular route
          setSelectedStreet(null)
        } else {
          setWaypointRoute(null)
          displayMessage(
            "Could not calculate a route. No legs returned.",
            "warning",
          )
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      setWaypointRoute(null)

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
      setIsFetchingWaypoints(false)
    }
  }, [
    startAddress,
    endAddress,
    waypoints,
    mode,
    useTraffic,
    avoidFerries,
    trafficHour,
    trafficDayOfWeek,
    setWaypointRoute,
    setRoute,
    setSelectedStreet,
    displayMessage,
  ])

  return { fetchWaypointRoute, isFetchingWaypoints }
}
