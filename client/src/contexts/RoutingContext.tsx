import React, {
  createContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react"
import {
  IMapFeature,
  Route,
  RouteFeature,
  WaypointRouteResponse,
} from "../types/interfaces"
import { areAddressesDifferent } from "../utils/coordinates"

export type TravelMode = "drive" | "walk" | "bike"

export interface RoutingContextType {
  // Data state
  startAddress: IMapFeature | null
  endAddress: IMapFeature | null
  mode: TravelMode
  route: Route | null
  selectedStreet: RouteFeature | null
  useTraffic: boolean
  avoidFerries: boolean
  trafficHour: number | null
  trafficDayOfWeek: number | null

  // Waypoint state
  waypoints: IMapFeature[]
  waypointRoute: WaypointRouteResponse | null

  // UI state (related to routing inputs)
  startAddressInput: string
  endAddressInput: string
  isInputEnabled: boolean

  // Data state modifiers
  setAddress: (address: IMapFeature, type: "start" | "end") => void
  setMode: (mode: TravelMode) => void
  setRoute: (route: Route | null) => void
  setSelectedStreet: (street: RouteFeature | null) => void
  setUseTraffic: (useTraffic: boolean) => void
  setAvoidFerries: (avoidFerries: boolean) => void
  setTrafficHour: (hour: number | null) => void
  setTrafficDayOfWeek: (day: number | null) => void

  // Waypoint state modifiers
  addWaypoint: (waypoint: IMapFeature) => void
  removeWaypoint: (index: number) => void
  updateWaypoint: (index: number, waypoint: IMapFeature) => void
  clearWaypoints: () => void
  setWaypointRoute: (route: WaypointRouteResponse | null) => void

  // UI state modifiers
  setAddressInput: (value: string, type: "start" | "end") => void
  clearAddresses: () => void
  swapAddresses: () => void
  enableAddressInputs: () => void // Renamed from toggleEnabled for clarity
}

export const RoutingContext = createContext<RoutingContextType>({
  startAddress: null,
  endAddress: null,
  mode: "drive",
  route: null,
  selectedStreet: null,
  useTraffic: true,
  avoidFerries: false,
  trafficHour: null,
  trafficDayOfWeek: null,
  waypoints: [],
  waypointRoute: null,
  startAddressInput: "",
  endAddressInput: "",
  isInputEnabled: true,
  setAddress: () => {},
  setMode: () => {},
  setRoute: () => {},
  setSelectedStreet: () => {},
  setUseTraffic: () => {},
  setAvoidFerries: () => {},
  setTrafficHour: () => {},
  setTrafficDayOfWeek: () => {},
  addWaypoint: () => {},
  removeWaypoint: () => {},
  updateWaypoint: () => {},
  clearWaypoints: () => {},
  setWaypointRoute: () => {},
  setAddressInput: () => {},
  clearAddresses: () => {},
  swapAddresses: () => {},
  enableAddressInputs: () => {},
})

interface RoutingContextProviderProps {
  children: ReactNode
}

export function RoutingContextProvider({
  children,
}: RoutingContextProviderProps) {
  const [startAddress, setStartAddressState] = useState<IMapFeature | null>(
    null,
  )
  const [endAddress, setEndAddressState] = useState<IMapFeature | null>(null)
  const [mode, setModeState] = useState<TravelMode>("drive")
  const [route, setRouteState] = useState<Route | null>(null)
  const [selectedStreet, setSelectedStreetState] =
    useState<RouteFeature | null>(null)

  // Initialize useTraffic from localStorage (default: true)
  const [useTraffic, setUseTrafficState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("nyc-routing-use-traffic")
      return stored ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  // Initialize avoidFerries from localStorage (default: false)
  const [avoidFerries, setAvoidFerriesState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("nyc-routing-avoid-ferries")
      return stored ? JSON.parse(stored) : false
    } catch {
      return false
    }
  })

  // Traffic time parameters (null = use current time or static factors)
  const [trafficHour, setTrafficHourState] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("nyc-routing-traffic-hour")
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [trafficDayOfWeek, setTrafficDayOfWeekState] = useState<number | null>(
    () => {
      try {
        const stored = localStorage.getItem("nyc-routing-traffic-day")
        return stored ? JSON.parse(stored) : null
      } catch {
        return null
      }
    },
  )

  const [waypoints, setWaypointsState] = useState<IMapFeature[]>([])
  const [waypointRoute, setWaypointRouteState] =
    useState<WaypointRouteResponse | null>(null)

  const [startAddressInput, setStartAddressInputState] = useState<string>("")
  const [endAddressInput, setEndAddressInputState] = useState<string>("")
  const [isInputEnabled, setIsInputEnabledState] = useState<boolean>(false)

  const setAddress = useCallback(
    (selected: IMapFeature, type: "start" | "end") => {
      const label = String(selected.properties?.label || "")

      if (type === "start") {
        const isDifferent = areAddressesDifferent(startAddress, selected, label)

        if (isDifferent) {
          setStartAddressState(selected)
        }
        setStartAddressInputState(label) // Always update input state
      } else {
        const isDifferent = areAddressesDifferent(endAddress, selected, label)

        if (isDifferent) {
          setEndAddressState(selected)
        }
        setEndAddressInputState(label) // Always update input state
      }
    },
    [startAddress, endAddress],
  )

  const setMode = useCallback((newMode: TravelMode) => {
    setModeState(newMode)
  }, [])

  const setRoute = useCallback((newRoute: Route | null) => {
    setRouteState(newRoute)
  }, [])

  const setUseTraffic = useCallback((value: boolean) => {
    setUseTrafficState(value)
    localStorage.setItem("nyc-routing-use-traffic", JSON.stringify(value))
  }, [])

  const setAvoidFerries = useCallback((value: boolean) => {
    setAvoidFerriesState(value)
    localStorage.setItem("nyc-routing-avoid-ferries", JSON.stringify(value))
  }, [])

  const setTrafficHour = useCallback((value: number | null) => {
    setTrafficHourState(value)
    if (value === null) {
      localStorage.removeItem("nyc-routing-traffic-hour")
    } else {
      localStorage.setItem("nyc-routing-traffic-hour", JSON.stringify(value))
    }
  }, [])

  const setTrafficDayOfWeek = useCallback((value: number | null) => {
    setTrafficDayOfWeekState(value)
    if (value === null) {
      localStorage.removeItem("nyc-routing-traffic-day")
    } else {
      localStorage.setItem("nyc-routing-traffic-day", JSON.stringify(value))
    }
  }, [])

  const setSelectedStreet = useCallback(
    (newSelectedStreet: RouteFeature | null) => {
      setSelectedStreetState(newSelectedStreet)
    },
    [],
  )

  const setAddressInput = useCallback(
    (value: string, type: "start" | "end") => {
      if (type === "start") {
        setStartAddressInputState(value)
      } else {
        setEndAddressInputState(value)
      }
    },
    [],
  )

  const addWaypoint = useCallback((waypoint: IMapFeature) => {
    setWaypointsState(prev => {
      if (prev.length >= 1) return prev // Limit to 1 intermediate waypoint per backend constraint
      return [...prev, waypoint]
    })
  }, [])

  const removeWaypoint = useCallback((index: number) => {
    setWaypointsState(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateWaypoint = useCallback((index: number, waypoint: IMapFeature) => {
    setWaypointsState(prev =>
      prev.map((wp, i) => (i === index ? waypoint : wp)),
    )
  }, [])

  const clearWaypoints = useCallback(() => {
    setWaypointsState([])
    setWaypointRouteState(null)
  }, [])

  const setWaypointRoute = useCallback(
    (route: WaypointRouteResponse | null) => {
      setWaypointRouteState(route)
    },
    [],
  )

  const clearAddresses = useCallback(() => {
    setStartAddressState(null)
    setEndAddressState(null)
    setStartAddressInputState("")
    setEndAddressInputState("")
    setWaypointsState([])
    setWaypointRouteState(null)
  }, [])

  const swapAddresses = useCallback(() => {
    // Swap address states
    const tempAddress = startAddress
    const tempInput = startAddressInput

    setStartAddressState(endAddress)
    setStartAddressInputState(endAddressInput)
    setEndAddressState(tempAddress)
    setEndAddressInputState(tempInput)
  }, [startAddress, endAddress, startAddressInput, endAddressInput])

  const enableAddressInputs = useCallback(() => {
    setIsInputEnabledState(true)
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      startAddress,
      endAddress,
      mode,
      route,
      selectedStreet,
      useTraffic,
      avoidFerries,
      trafficHour,
      trafficDayOfWeek,
      waypoints,
      waypointRoute,
      startAddressInput,
      endAddressInput,
      isInputEnabled,
      setAddress,
      setMode,
      setRoute,
      setSelectedStreet,
      setUseTraffic,
      setAvoidFerries,
      setTrafficHour,
      setTrafficDayOfWeek,
      addWaypoint,
      removeWaypoint,
      updateWaypoint,
      clearWaypoints,
      setWaypointRoute,
      setAddressInput,
      clearAddresses,
      swapAddresses,
      enableAddressInputs,
    }),
    [
      startAddress,
      endAddress,
      mode,
      route,
      selectedStreet,
      useTraffic,
      avoidFerries,
      trafficHour,
      trafficDayOfWeek,
      waypoints,
      waypointRoute,
      startAddressInput,
      endAddressInput,
      isInputEnabled,
      setAddress,
      setMode,
      setRoute,
      setSelectedStreet,
      setUseTraffic,
      setAvoidFerries,
      setTrafficHour,
      setTrafficDayOfWeek,
      addWaypoint,
      removeWaypoint,
      updateWaypoint,
      clearWaypoints,
      setWaypointRoute,
      setAddressInput,
      clearAddresses,
      swapAddresses,
      enableAddressInputs,
    ],
  )

  return (
    <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>
  )
}

export default RoutingContextProvider
