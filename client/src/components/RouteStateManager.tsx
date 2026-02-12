import { useContext, useEffect, useRef } from "react"
import { RoutingContext } from "../contexts/RoutingContext"
import { MessageContext } from "../contexts/MessageContext"
import { useRouteStateSync } from "../hooks/useRouteStateSync"
import { useRouteFetch } from "../hooks/useRouteFetch"

/**
 * Component that manages URL synchronization for routing state
 * Place this inside RoutingContextProvider to enable deep linking
 * Also handles auto-calculation of routes when loaded from shared URLs
 */
export const RouteStateManager: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { startAddress, endAddress, mode, useTraffic, avoidFerries, trafficHour, trafficDayOfWeek, setAddress, setMode, setUseTraffic, setAvoidFerries, setTrafficHour, setTrafficDayOfWeek, setRoute } =
    useContext(RoutingContext)

  const { displayMessage } = useContext(MessageContext)

  // Track if we've already auto-calculated on mount to prevent infinite loops
  const hasAutoCalculated = useRef(false)

  // Sync routing state with URL parameters
  useRouteStateSync({
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
  })

  // Get route fetching capability
  const { fetchRoute, isFetching } = useRouteFetch({
    startAddress,
    endAddress,
    mode,
    useTraffic,
    avoidFerries,
    trafficHour,
    trafficDayOfWeek,
    setRoute,
    displayMessage,
  })

  // Auto-calculate route when both addresses are available from URL
  // This enables shared URLs to automatically show the calculated route
  useEffect(() => {
    // Only auto-calculate once on initial load if both addresses exist
    if (
      !hasAutoCalculated.current &&
      startAddress?.geometry &&
      endAddress?.geometry &&
      !isFetching
    ) {
      hasAutoCalculated.current = true
      // Small delay to ensure map is fully loaded before calculating
      setTimeout(() => {
        fetchRoute()
      }, 500)
    }
  }, [startAddress, endAddress, fetchRoute, isFetching])

  return <>{children}</>
}
