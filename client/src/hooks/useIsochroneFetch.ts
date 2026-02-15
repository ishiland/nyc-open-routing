import { useCallback, useState } from "react"
import { Point } from "geojson"

import {
  IMapFeature,
  IsochroneResponse,
  IsochroneView,
} from "../types/interfaces"
import { TravelMode } from "../contexts/RoutingContext"
import { MessageContextType } from "../contexts/MessageContext"

interface UseIsochroneFetchArgs {
  startAddress: IMapFeature | null
  mode: TravelMode
  intervals: number[]
  isochroneView: IsochroneView
  useTraffic: boolean
  trafficHour: number | null
  trafficDayOfWeek: number | null
  setIsochrone: (data: IsochroneResponse | null) => void
  displayMessage: MessageContextType["displayMessage"]
}

export const useIsochroneFetch = ({
  startAddress,
  mode,
  intervals,
  isochroneView,
  useTraffic,
  trafficHour,
  trafficDayOfWeek,
  setIsochrone,
  displayMessage,
}: UseIsochroneFetchArgs) => {
  const [isFetching, setIsFetching] = useState<boolean>(false)

  const fetchIsochrone = useCallback(async () => {
    setIsFetching(true)
    try {
      if (!startAddress) {
        displayMessage("Please select an origin address.", "warning")
        return
      }

      const startGeom = startAddress.geometry as Point
      if (startGeom?.type !== "Point" || !startGeom.coordinates) {
        displayMessage(
          "Invalid address geometry. Origin must be a Point with coordinates.",
          "error",
        )
        return
      }

      const startCoords = Array.isArray(startGeom.coordinates)
        ? startGeom.coordinates.join(",")
        : ""

      if (!startCoords) {
        displayMessage("Invalid address coordinates.", "error")
        return
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        let url = `/api/isochrone?orig=${startCoords}&mode=${mode}&intervals=${intervals.join(",")}&view=${isochroneView}`
        if (mode === "drive") {
          url += `&use_traffic=${useTraffic}`
          if (useTraffic && trafficHour !== null && trafficDayOfWeek !== null) {
            url += `&hour=${trafficHour}&day_of_week=${trafficDayOfWeek}`
          }
        }

        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok) {
          let errorText = response.statusText
          try {
            const errorData = await response.json()
            if (errorData?.detail) {
              errorText = errorData.detail
            }
          } catch {
            // Ignore parse errors
          }

          if (response.status === 404) {
            throw new Error(
              errorText || "No reachable area found from this location.",
            )
          } else if (response.status >= 500) {
            throw new Error("Server error. Please try again later.")
          } else {
            throw new Error(errorText || "Failed to calculate reachability.")
          }
        }

        const data: IsochroneResponse = await response.json()
        if (data.features && data.features.length > 0) {
          setIsochrone(data)
        } else {
          setIsochrone(null)
          displayMessage("No reachability data returned.", "warning")
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      setIsochrone(null)
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          displayMessage(
            "Reachability calculation timed out. Please try again.",
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
    mode,
    intervals,
    isochroneView,
    useTraffic,
    trafficHour,
    trafficDayOfWeek,
    setIsochrone,
    displayMessage,
  ])

  return { fetchIsochrone, isFetching }
}
